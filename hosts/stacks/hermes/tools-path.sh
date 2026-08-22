# Bind-mounted to /etc/profile.d/zz-hermes-tools.sh in every container that
# runs an agent process.
#
# Why this exists: /etc/profile hard-resets PATH to the system default, so any
# LOGIN shell (bash -l, which the terminal tool uses) throws away the PATH set
# in compose — taking kubectl, flux, helm, gh, jq, yq, sops and gitleaks with
# it. The agent then reports "gh: command not found" while the binary sits
# right there in the shared bin dir.
#
# profile.d is sourced *after* that reset, so re-prepending here wins. The
# "zz-" prefix keeps it last among the drop-ins.
#
# Resolved dynamically rather than hardcoded: the same shared volume is
# ~/.hermes for the `hermes` user in hermes-agent/hermes-dashboard and for
# `hermeswebui` in hermes-webui, so the absolute path differs per container.

for _hermes_dir in \
    "${HERMES_HOME:-}" \
    "${HOME:-}/.hermes" \
    /home/hermes/.hermes \
    /home/hermeswebui/.hermes
do
    [ -n "${_hermes_dir}" ] || continue
    [ -d "${_hermes_dir}/bin" ] || continue
    case ":${PATH}:" in
        *":${_hermes_dir}/bin:"*) ;;
        *) PATH="${_hermes_dir}/bin:${PATH}" ;;
    esac
    export PATH
    break
done
unset _hermes_dir

# Hermes' own venv, which the image ships on PATH but /etc/profile drops.
# Without it `python3` resolves to /usr/bin/python3, which has no PyYAML, and
# `python3 scripts/lint-k8s.py` — the exact command CI runs — dies with
# ModuleNotFoundError. The venv interpreter already has PyYAML, so restoring
# the path is the fix; installing a second copy of the library is not.
#
# These must be PREPENDED, ahead of /usr/bin, or the system python still wins.
# The image's own PATH orders them this way for the same reason.
for _venv_bin in /opt/hermes/bin /opt/hermes/.venv/bin; do
    [ -d "${_venv_bin}" ] || continue
    case ":${PATH}:" in
        *":${_venv_bin}:"*) ;;
        *) PATH="${_venv_bin}:${PATH}" ;;
    esac
done
export PATH
unset _venv_bin
