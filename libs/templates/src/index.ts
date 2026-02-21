// @hac/templates - Handlebars templating library with pluggable variable resolution
//
// Core exports (no Pulumi dependency):
//   import { TemplateProcessor, TemplateContext, ... } from "@hac/templates"
//
// Pulumi-specific exports:
//   import { PulumiTemplateProcessor, ... } from "@hac/templates/pulumi"

// Core template processing
export {
  TemplateProcessor,
  type RenderedTemplateFile,
  type TemplateProcessorOptions,
} from "./template-processor";

// Type-safe context management
export { TemplateContext } from "./template-context";

// Variable resolution interface and implementations
export {
  type VariableResolver,
  type ResolvedVariable,
  ObjectVariableResolver,
} from "./variable-resolver";

// Built-in Handlebars helpers
export {
  registerBuiltinHelpers,
  BUILTIN_HELPERS,
  rawHelper,
  ifeqHelper,
  ifnoteqHelper,
  partialHelper,
  helperMissingHelper,
} from "./helpers";
