import { registerBuiltinHelpers } from "@hac/templates/helpers";
import { deployHomelab } from "./src/proxmox/homelab-orchestrator";

registerBuiltinHelpers();

function main() {
  deployHomelab();
}

main();
