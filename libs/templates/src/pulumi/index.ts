export { PulumiVariableResolver } from "./pulumi-variable-resolver";

export {
  PulumiTemplateProcessor,
  type PulumiTemplateProcessorOptions,
} from "./pulumi-template-processor";

export { TemplateFile, type TemplateFileArgs } from "./resources/template-file";

export {
  TemplateDirectory,
  type TemplateDirectoryArgs,
} from "./resources/template-directory";

export { pathToResourceId } from "./path-utils";
