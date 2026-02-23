import { registerBuiltinHelpers } from "@hac/templates";
import { deployHomelab } from "./src/proxmox/homelab-orchestrator";

registerBuiltinHelpers();

function main() {
  deployHomelab();
}

main();
