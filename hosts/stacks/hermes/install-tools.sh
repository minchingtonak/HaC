#!/usr/bin/env bash
#
# Provisions the Hermes agent's toolchain into the persisted Hermes home volume.
#
# Runs as the "hermes-tools" one-shot service in compose.yaml, which the agent,
# dashboard and webui services gate on via service_completed_successfully. It
# reuses the already-digest-pinned hermes-agent image rather than introducing
# another one, so there is no extra image for Renovate to track.
#
# Binaries are managed by aqua (see aqua.yaml next to this script) rather than
# hand-rolled curl+checksum blocks. Two reasons that matter:
#
#   1. Renovate already maintains aqua pins, so tool bumps arrive as reviewed
#      PRs instead of someone hand-editing SHA256 constants.
#   2. `aqua cp -a` is run from inside the k3s-homelab checkout, so aqua reads
#      BOTH this stack's aqua.yaml and the repo's. Tools that CI enforces
#      (dprint) come from the repo's pin, making the agent's formatter version
#      identical to CI's by construction. Duplicating that pin here is exactly
#      how the agent ends up failing `dprint check` for reasons it cannot see.
#
# `aqua cp` copies real executables rather than shims, so the agent containers
# need neither aqua nor AQUA_ROOT_DIR at runtime — just the bin dir on PATH.
#
# Idempotent: a stamp records the aqua version, a hash of the config files and
# a setup revision. Unchanged inputs make this a no-op.

set -euo pipefail

# Keep in step with the aqua version CI installs (see .github/workflows in
# k3s-homelab) so the agent and CI resolve packages identically.
AQUA_VERSION="v2.62.3"
AQUA_SHA256="89cb081adb19e425b1dca6b16d912c349a43535ce88d8713050738c9263618d0"

# Bump when this script gains work not tied to a version change (venv,
# wrappers, gh auth). It is part of the stamp, so raising it forces a re-run.
SETUP_REVISION="9"

# Bind-mounted Hermes home. Same volume the agent sees at ~/.hermes.
TARGET="${HERMES_TOOLS_TARGET:-/target}"
BIN_DIR="${TARGET}/bin"
STAMP="${BIN_DIR}/.tools-version"

# Agent's checkout, mounted so aqua can read the repo's own aqua.yaml.
REPO_DIR="${HERMES_TOOLS_REPO:-/workspace/k3s-homelab}"
AGENT_AQUA_CONFIG="${HERMES_TOOLS_AQUA_CONFIG:-/opt/aqua.yaml}"

# The agent, dashboard and webui containers all run as uid/gid 10000.
OWNER_UID="${HERMES_TOOLS_UID:-10000}"
OWNER_GID="${HERMES_TOOLS_GID:-10000}"

log() { printf '[hermes-tools] %s\n' "$*"; }

config_hash() {
  local h=""
  [ -f "${AGENT_AQUA_CONFIG}" ] && h="${h}$(sha256sum "${AGENT_AQUA_CONFIG}" | cut -d' ' -f1)"
  [ -f "${REPO_DIR}/aqua.yaml" ] && h="${h}$(sha256sum "${REPO_DIR}/aqua.yaml" | cut -d' ' -f1)"
  printf '%s' "${h}" | sha256sum | cut -c1-12
}

WANT="aqua=${AQUA_VERSION} cfg=$(config_hash) setup=${SETUP_REVISION}"

if [ -f "${STAMP}" ] && [ "$(cat "${STAMP}")" = "${WANT}" ]; then
  log "already provisioned, nothing to do"
  log "${WANT}"
  exit 0
fi

log "provisioning toolchain into ${BIN_DIR}"
mkdir -p "${BIN_DIR}"

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

# --- bootstrap aqua ---------------------------------------------------------
# The one download still verified by hand; everything else inherits aqua's own
# checksum verification.
log "fetching aqua ${AQUA_VERSION}"
curl -fsSL --retry 3 --retry-delay 2 -o "${WORK}/aqua.tgz" \
  "https://github.com/aquaproj/aqua/releases/download/${AQUA_VERSION}/aqua_linux_amd64.tar.gz"
got="$(sha256sum "${WORK}/aqua.tgz" | cut -d' ' -f1)"
if [ "${got}" != "${AQUA_SHA256}" ]; then
  log "CHECKSUM MISMATCH for aqua"
  log "  expected ${AQUA_SHA256}"
  log "  got      ${got}"
  exit 1
fi
tar -xzf "${WORK}/aqua.tgz" -C "${WORK}" aqua
chmod +x "${WORK}/aqua"

export AQUA_ROOT_DIR="${WORK}/aquaroot"
export AQUA_GLOBAL_CONFIG="${AGENT_AQUA_CONFIG}"

# Run from inside the checkout when it exists so aqua also picks up the repo's
# aqua.yaml (dprint). Without it the agent has no formatter and every PR it
# opens fails CI's required `dprint check` job.
if [ -f "${REPO_DIR}/aqua.yaml" ]; then
  cd "${REPO_DIR}"
  log "using repo config ${REPO_DIR}/aqua.yaml for CI-shared tools"
else
  cd "${WORK}"
  log "WARNING: ${REPO_DIR}/aqua.yaml not found — CI-shared tools (dprint) will"
  log "         be missing. Is the workspace mounted and the repo cloned?"
fi

log "installing packages"
"${WORK}/aqua" install -a

log "copying executables into ${BIN_DIR}"
"${WORK}/aqua" cp -a -o "${BIN_DIR}"

chown -R "${OWNER_UID}:${OWNER_GID}" "${BIN_DIR}"
for f in "${BIN_DIR}"/*; do
  [ -f "${f}" ] && chmod 0755 "${f}"
done
log "installed: $(cd "${BIN_DIR}" && ls | grep -v '^\.' | tr '\n' ' ')"

# --- python deps for hermes itself ------------------------------------------
# web_search is configured to use the ddgs backend but the image does not ship
# the package, so the tool fails with "ddgs package is not installed". Install
# it into hermes' own venv, which lives in the hermes-agent-src volume and so
# persists. That venv has no pip, hence uv.
AGENT_VENV="${HERMES_TOOLS_AGENT_VENV:-/opt/hermes-src/.venv}"
if [ -x "${AGENT_VENV}/bin/python" ]; then
  if "${AGENT_VENV}/bin/python" -c 'import ddgs' 2>/dev/null; then
    log "ddgs already present in the agent venv"
  else
    log "installing ddgs into ${AGENT_VENV}"
    uv pip install --quiet --python "${AGENT_VENV}/bin/python" ddgs \
      || log "WARNING: ddgs install failed — web_search will not work"
  fi
else
  log "WARNING: agent venv not found at ${AGENT_VENV}; skipping ddgs"
fi

# --- enable the repo's git hooks -------------------------------------------
# Equivalent to the repo's `make hooks` (the git-config half of `make setup`);
# the toolchain half is already done above by aqua. Without core.hooksPath the
# hooks in .githooks/ never run, and the absence of a hook is silent — commits
# simply stop being checked, which is how unformatted work reached a PR.
#
# `-c safe.directory` is required: this container runs as root while the clone
# is owned by uid 10000, and git refuses to operate on it otherwise. It fails
# by producing nothing rather than by erroring loudly, so without this the step
# quietly does nothing. stderr is deliberately not suppressed.
if [ -d "${REPO_DIR}/.git" ]; then
  if git -C "${REPO_DIR}" -c safe.directory="${REPO_DIR}" \
    config core.hooksPath .githooks; then
    log "enabled repo git hooks (core.hooksPath=.githooks)"
    chown "${OWNER_UID}:${OWNER_GID}" "${REPO_DIR}/.git/config"
  else
    log "WARNING: could not set core.hooksPath — see the git error above"
  fi
else
  log "WARNING: no git repo at ${REPO_DIR}; git hooks not enabled"
fi

# --- gh authentication via config file, not env -----------------------------
# Hermes strips recognised provider credentials (GH_TOKEN is a Copilot key)
# from every shell the model runs, by design — so `gh` can never pick up the
# token from the environment. Writing gh's own config instead sidesteps that;
# the agent reads it via GH_CONFIG_DIR, which is not secret-shaped and so
# survives sanitisation.
if [ -n "${GH_TOKEN:-}" ]; then
  GH_DIR="${TARGET}/gh"
  mkdir -p "${GH_DIR}"
  # `env -u GH_TOKEN` is required, not cosmetic: gh refuses to persist
  # credentials while that variable is set, exiting 1 with "The value of the
  # GH_TOKEN environment variable is being used for authentication. To have
  # GitHub CLI store credentials instead, first clear the value from the
  # environment." The token is piped in on stdin instead.
  #
  # stderr is deliberately NOT suppressed — hiding it once turned this exact
  # failure into a vague "check the token" warning that took a day to run down.
  if printf '%s' "${GH_TOKEN}" \
    | env -u GH_TOKEN GH_CONFIG_DIR="${GH_DIR}" "${BIN_DIR}/gh" auth login --with-token; then
    log "gh authenticated via ${GH_DIR}"
  else
    log "WARNING: gh auth login failed — see the gh error above"
  fi
  chown -R "${OWNER_UID}:${OWNER_GID}" "${GH_DIR}"
  chmod 0700 "${GH_DIR}"
else
  log "WARNING: GH_TOKEN not set; gh will be unauthenticated and PRs will fail"
fi

printf '%s' "${WANT}" >"${STAMP}"
chown "${OWNER_UID}:${OWNER_GID}" "${STAMP}"

log "done"
log "${WANT}"
