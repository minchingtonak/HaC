// Pulumi-specific template processing components
// Import via: import { ... } from "@hac/templates/pulumi"

import * as Handlebars from "handlebars";

export { PulumiVariableResolver } from "./pulumi-variable-resolver";

export {
  PulumiTemplateProcessor,
  type PulumiTemplateProcessorOptions,
} from "./pulumi-template-processor";

export {
  HandlebarsTemplateFile,
  type HandlebarsTemplateFileArgs,
} from "./handlebars-template-file";

export {
  HandlebarsTemplateDirectory,
  type HandlebarsTemplateDirectoryArgs,
} from "./handlebars-template-directory";

// Re-export Handlebars for helper registration
export { Handlebars };
