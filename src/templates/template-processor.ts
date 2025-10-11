import * as pulumi from "@pulumi/pulumi";
import * as fs from "node:fs";
import * as path from "node:path";
import * as Handlebars from "handlebars";
import { EnvUtils } from "../utils/env-utils";
import { LxcHostConfigToml } from "../hosts/lxc-host-config-schema";
import { PveHostConfigToml } from "../hosts/pve-host-config-schema";

export interface TemplateContext {
  [key: string]: string | pulumi.Output<string>;
}

export interface RenderedTemplateFile {
  idSafeName: string;
  templatePath: string;
  content: pulumi.Output<string>;
}

export type ASTNode =
  | hbs.AST.MustacheStatement
  | hbs.AST.BlockStatement
  | hbs.AST.PartialStatement
  | hbs.AST.PartialBlockStatement
  | hbs.AST.ContentStatement
  | hbs.AST.CommentStatement
  | hbs.AST.SubExpression
  | hbs.AST.PathExpression
  | hbs.AST.StringLiteral
  | hbs.AST.BooleanLiteral
  | hbs.AST.NumberLiteral
  | hbs.AST.UndefinedLiteral
  | hbs.AST.NullLiteral
  | hbs.AST.Hash
  | hbs.AST.HashPair;

export class TemplateProcessor {
  public static readonly REMOTE_OUTPUT_FOLDER_ROOT = "/etc/pulumi";

  public static readonly LOCAL_STACKS_FOLDER_ROOT_NAME = "stacks";

  public static readonly REMOTE_STACK_DIRECTORY_ROOT = path.join(
    TemplateProcessor.REMOTE_OUTPUT_FOLDER_ROOT,
    TemplateProcessor.LOCAL_STACKS_FOLDER_ROOT_NAME,
  );

  private static readonly TEMPLATE_PATTERN = () =>
    /^.*\.(hbs|handlebars)\..+(\.(hbs|handlebars))?$/;

  private static readonly FILENAME_REPLACE_PATTERN = () =>
    /\.(hbs|handlebars)/g;

  /**
   * Discover and return a list containing the paths of all template files in
   * the given directory.
   *
   * @param directory relative path to the directory containing template files
   * @param options
   * @returns list of paths of all template files in the given directory
   */
  static discoverTemplateFiles(
    directory: string,
    options?: {
      recursive?: boolean;
      isTemplateOverride?: (filePath: string, filename: string) => boolean;
    },
  ): string[] {
    if (path.isAbsolute(directory)) {
      throw new Error(`Directory must be relative, was given: '${directory}'`);
    }

    const templateFiles: string[] = [];

    const isTemplate =
      options?.isTemplateOverride ?
        options.isTemplateOverride
      : TemplateProcessor.isTemplateFile;

    function scanDirectory(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (
          entry.isDirectory() &&
          (options?.recursive === undefined || options.recursive)
        ) {
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          if (isTemplate(fullPath, entry.name)) {
            templateFiles.push(fullPath);
          }
        }
      }
    }

    scanDirectory(directory);
    return templateFiles;
  }

  private static isTemplateFile(filename: string): boolean {
    return TemplateProcessor.TEMPLATE_PATTERN().test(filename);
  }

  static processTemplate(
    templatePath: string,
    config: pulumi.Config,
    dataVariables?: unknown,
  ): RenderedTemplateFile {
    const templateContent = fs.readFileSync(templatePath, "utf-8");

    const variables = TemplateProcessor.discoverVariables(templateContent);

    const idSafeName = TemplateProcessor.buildSanitizedNameForId(templatePath);

    if (variables.length === 0) {
      return {
        content: pulumi.output(templateContent),
        idSafeName,
        templatePath,
      };
    }

    const initialVarValueMap = EnvUtils.assembleVariableMapFromConfig(
      config,
      variables,
    );

    let maxVariableDepth = 1;
    // process variables referenced within other variables
    function processRecursiveVariables(
      varValues: string[],
    ): pulumi.Output<Record<string, string | pulumi.Output<string>>> {
      const discoveredVars = TemplateProcessor.discoverVariables(
        varValues.join("\n"),
      );

      if (discoveredVars.length === 0) {
        return pulumi.output({} as Record<string, string>);
      }

      // increment variable depth only if we've discovered any variables
      maxVariableDepth++;

      const varMap = EnvUtils.assembleVariableMapFromConfig(
        config,
        discoveredVars,
      );

      return pulumi
        .all(Object.values(varMap))
        .apply(processRecursiveVariables)
        .apply((processedVars) => ({ ...processedVars, ...varMap }));
    }

    const recursiveVariableValueMap = pulumi
      .all(Object.values(initialVarValueMap))
      .apply(processRecursiveVariables);

    const mergedVariables = pulumi
      .all(initialVarValueMap)
      .apply((initialVars) =>
        pulumi
          .all(recursiveVariableValueMap)
          .apply((recursiveVars) => ({ ...initialVars, ...recursiveVars })),
      );

    // iterate over the map of merged variables. compile each value as a template and set the value of the rendered template to the variable in the map
    // after this process all variables in the map will have been expanded
    const resolvedVariables = mergedVariables.apply((merged) => {
      const result = structuredClone(merged);

      // only need maxDepth - 1 iterations since top-level vars are handled
      // in the final template render below
      for (let i = 0; i < maxVariableDepth - 1; ++i) {
        for (const [varName, varValue] of Object.entries(merged)) {
          const template = Handlebars.compile<Record<string, string>>(varValue);

          const newVariableValue = template(result, { data: dataVariables });

          result[varName] = newVariableValue;
        }
      }

      return result;
    });

    const template =
      Handlebars.compile<Record<string, string>>(templateContent);

    const content = resolvedVariables.apply((vars) =>
      template(vars, { data: dataVariables }),
    );

    return { content, idSafeName, templatePath };
  }

  private static discoverVariables(templateContent: string): string[] {
    const ast = Handlebars.parse(templateContent);
    const variables = new Set<string>();

    function walkAST(node: ASTNode): void;
    function walkAST(node: hbs.AST.Expression | hbs.AST.Expression[]): void;
    function walkAST(node: hbs.AST.Statement | hbs.AST.Statement[]): void {
      if (Array.isArray(node)) {
        for (const element of node) {
          walkAST(element);
        }
        return;
      }

      if (!node) return;

      const astNode = node as ASTNode;

      switch (astNode.type) {
        case "PathExpression": {
          variables.add(astNode.original);
          break;
        }

        case "MustacheStatement": {
          walkAST(astNode.path);
          if (astNode.params.length > 0) {
            walkAST(astNode.params);
          }
          if (astNode.hash) {
            walkAST(astNode.hash);
          }
          break;
        }

        case "BlockStatement": {
          walkAST(astNode.path);
          if (astNode.params.length > 0) {
            walkAST(astNode.params);
          }
          if (astNode.hash) {
            walkAST(astNode.hash);
          }
          if (astNode.program) {
            walkAST(astNode.program.body);
          }
          if (astNode.inverse) {
            walkAST(astNode.inverse.body);
          }
          break;
        }

        case "SubExpression": {
          walkAST(astNode.path);
          if (astNode.params.length > 0) {
            walkAST(astNode.params);
          }
          if (astNode.hash) {
            walkAST(astNode.hash);
          }
          break;
        }

        case "PartialStatement": {
          walkAST(astNode.name);
          if (astNode.params.length > 0) {
            walkAST(astNode.params);
          }
          if (astNode.hash) {
            walkAST(astNode.hash);
          }
          break;
        }

        case "PartialBlockStatement": {
          walkAST(astNode.name);
          if (astNode.params.length > 0) {
            walkAST(astNode.params);
          }
          if (astNode.hash) {
            walkAST(astNode.hash);
          }
          if (astNode.program) {
            walkAST(astNode.program.body);
          }
          break;
        }

        case "Hash": {
          walkAST(astNode.pairs);
          break;
        }

        case "HashPair": {
          walkAST(astNode.value);
          break;
        }

        // Terminal nodes
        case "ContentStatement":
        case "CommentStatement":
        case "StringLiteral":
        case "BooleanLiteral":
        case "NumberLiteral":
        case "UndefinedLiteral":
        case "NullLiteral":
          break;
      }
    }

    walkAST(ast.body);

    return Array.from(variables);
  }

  public static removeTemplateExtensions(templatePath: string) {
    return templatePath.replaceAll(
      TemplateProcessor.FILENAME_REPLACE_PATTERN(),
      "",
    );
  }

  static buildSanitizedNameForId(templatePath: string): string {
    let filename = path.basename(templatePath);

    if (filename.startsWith(".")) {
      filename = `dot-${filename.substring(1)}`;
      templatePath = path.join(path.dirname(templatePath), filename);
    }

    return templatePath
      .replaceAll(".", "-")
      .replaceAll(path.sep, "-")
      .replaceAll(/[^a-zA-Z0-9_-]/g, "");
  }

  static registerTemplateHelper(name: string, fn: Handlebars.HelperDelegate) {
    Handlebars.registerHelper(name, fn);
    EnvUtils.addIgnoredVariable(name);

    return () => {
      EnvUtils.removeIgnoredVariable(name);
      Handlebars.unregisterHelper(name);
    };
  }
}

TemplateProcessor.registerTemplateHelper(
  "raw",
  (options: Handlebars.HelperOptions) => {
    return options.fn({});
  },
);

export type ComposeStackTemplateContext = {
  stackName: string;
  templateDirectory: string;
  lxc: LxcHostConfigToml;
  pve: PveHostConfigToml;
};

function buildBaseDomain(context: ComposeStackTemplateContext): string {
  return `${context.lxc.hostname}.pulumi.${context.pve.node}.${context.pve.lxc.network.domain}`;
}

TemplateProcessor.registerTemplateHelper(
  "domainForApp",
  (appName: string, options: Handlebars.HelperOptions) => {
    const context = options.data as ComposeStackTemplateContext;
    const subdomainPrefix =
      context.lxc.stacks?.[context.stackName].domainPrefixes?.[appName] ??
      appName;

    return `${subdomainPrefix}.${buildBaseDomain(context)}`;
  },
);

TemplateProcessor.registerTemplateHelper(
  "domainForContainer",
  (options: Handlebars.HelperOptions) => {
    const context = options.data as ComposeStackTemplateContext;

    return buildBaseDomain(context);
  },
);

TemplateProcessor.registerTemplateHelper("helperMissing", function (...args) {
  const options = args[args.length - 1];
  const helperArgs = args.slice(0, args.length - 1);
  return new Handlebars.SafeString(
    "helperMissing: " + options.name + "(" + helperArgs + ")",
  );
});
