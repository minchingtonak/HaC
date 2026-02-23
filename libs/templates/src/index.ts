export {
  TemplateProcessor,
  type TemplateProcessorBase,
  type RenderedTemplateFile,
  type TemplateProcessorOptions,
} from "./template-processor";

export { TemplateContext } from "./template-context";

export {
  type VariableResolver,
  type ResolvedVariable,
  ObjectVariableResolver,
} from "./variable-resolver";

export {
  registerBuiltinHelpers,
  BUILTIN_HELPERS,
  rawHelper,
  ifeqHelper,
  ifnoteqHelper,
  partialHelper,
  helperMissingHelper,
} from "./helpers";

import * as Handlebars from "handlebars";
export { Handlebars };
