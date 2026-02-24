import * as fs from "node:fs";
import * as path from "node:path";

import {
  type TemplateProcessorBase,
  type RenderedTemplateFile,
} from "./template-processor-interface";
import { type VariableResolver } from "./variable-resolver";
import { HandlebarsInstance } from "./handlebars-instance";

// Re-export for backwards compatibility
export type { RenderedTemplateFile, TemplateProcessorBase };

/**
 * Options for template processing.
 */
export interface TemplateProcessorOptions {
  /**
   * Maximum depth for recursive variable resolution.
   * Prevents infinite loops from circular references.
   * @default 10
   */
  maxDepth?: number;

  /**
   * Custom Handlebars instance. If not provided, a new one is created.
   * Use this to share an instance between processors or to pre-register
   * custom helpers before processing.
   */
  handlebars?: HandlebarsInstance;
}

/**
 * Core template processor for Handlebars templates with pluggable variable resolution.
 *
 * This class handles:
 * - Template file discovery
 * - Variable extraction from templates using AST parsing
 * - Recursive variable resolution (variables can reference other variables)
 * - Template rendering with Handlebars
 *
 * The variable resolution is pluggable via the `VariableResolver` interface,
 * allowing different backends (plain objects, Pulumi Config, environment variables, etc.)
 *
 * Each processor uses an isolated Handlebars instance with builtin helpers
 * pre-registered. Custom helpers can be registered via the `instance` property.
 *
 * @example
 * ```typescript
 * import { TemplateProcessor } from "@hac/templates/template-processor";
 * import { ObjectVariableResolver } from "@hac/templates/variable-resolver";
 *
 * const resolver = new ObjectVariableResolver({
 *   DOMAIN: "example.com",
 *   API_URL: "https://{{DOMAIN}}/api",
 * });
 *
 * const processor = new TemplateProcessor(resolver);
 * const result = processor.renderTemplateString("Endpoint: {{API_URL}}");
 * // Result: "Endpoint: https://example.com/api"
 * ```
 */
export class TemplateProcessor<T = string> implements TemplateProcessorBase<T> {
  private static readonly TEMPLATE_PATTERN = () =>
    /^.*\.(hbs|handlebars)\..+(\.(hbs|handlebars))?$/;

  private static readonly FILENAME_REPLACE_PATTERN = () =>
    /\.(hbs|handlebars)/g;

  private resolver: VariableResolver<T>;
  private options: Required<Pick<TemplateProcessorOptions, "maxDepth">>;
  public readonly handlebars: HandlebarsInstance;

  constructor(
    resolver: VariableResolver<T>,
    options?: TemplateProcessorOptions,
  ) {
    this.resolver = resolver;
    this.options = { maxDepth: options?.maxDepth ?? 10 };
    this.handlebars = options?.handlebars ?? new HandlebarsInstance();
  }

  /**
   * Discover and return paths of all template files in a directory.
   *
   * Template files are identified by having `.hbs.` or `.handlebars.` in their name.
   * For example: `config.hbs.toml`, `docker-compose.handlebars.yaml`
   *
   * @param directory - Relative path to the directory containing template files
   * @param options - Discovery options
   * @returns List of paths to all discovered template files
   */
  static discoverTemplateFiles(
    directory: string,
    options?: {
      /** Whether to search subdirectories recursively (default: true) */
      recursive?: boolean;
      /** Custom function to determine if a file is a template */
      isTemplateOverride?: (filePath: string, filename: string) => boolean;
    },
  ): string[] {
    if (path.isAbsolute(directory)) {
      throw new Error(`Directory must be relative, was given: '${directory}'`);
    }

    const templateFiles: string[] = [];

    const isTemplate =
      options?.isTemplateOverride ??
      ((filePath: string, _filename: string) =>
        TemplateProcessor.isTemplateFile(filePath));

    function scanDirectory(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && (options?.recursive ?? true)) {
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

  /**
   * Render a template string with variable resolution.
   *
   * Variables are discovered, resolved (including nested references),
   * and then the template is rendered.
   *
   * @param templateContent - The template string to render
   * @param dataVariables - Additional data to pass to the template context
   * @returns The rendered template string
   */
  renderTemplateString(templateContent: string, dataVariables?: object): T {
    const variables = this.handlebars.discoverVariables(templateContent);

    if (variables.length === 0) {
      return templateContent as T;
    }

    const resolvedVariables = this.resolveAllVariables(variables);
    return this.renderWithVariables(
      resolvedVariables,
      templateContent,
      dataVariables,
    );
  }

  /**
   * Process a template file with variable resolution.
   *
   * @param templatePath - Path to the template file
   * @param dataVariables - Additional data to pass to the template context
   * @returns The processed template result
   */
  processTemplateFile(
    templatePath: string,
    dataVariables?: object,
  ): RenderedTemplateFile<T> {
    const templateContent = fs.readFileSync(templatePath, "utf-8");

    const variables = this.handlebars.discoverVariables(templateContent);

    if (variables.length === 0) {
      return { content: templateContent as T, templatePath };
    }

    const resolvedVariables = this.resolveAllVariables(variables);
    const content = this.renderWithVariables(
      resolvedVariables,
      templateContent,
      dataVariables,
    );

    return { content, templatePath };
  }

  /**
   * Render a template with pre-resolved variables.
   *
   * @param resolvedVariables - Map of variable names to resolved values
   * @param templateContent - The template string to render
   * @param dataVariables - Additional data to pass to the template context
   * @returns The rendered template string
   */
  renderWithVariables(
    resolvedVariables: Record<string, string>,
    templateContent: string,
    dataVariables?: object,
  ): T {
    const template = this.handlebars.compile<Record<string, string>>(
      templateContent,
      {},
    );

    const content = template(resolvedVariables, {
      data: { ...dataVariables, resolvedVariables },
    });

    return content as T;
  }

  /**
   * Resolve all variables, including recursive/nested references.
   *
   * This method:
   * 1. Resolves the initial set of variables
   * 2. Parses resolved values to discover nested variable references
   * 3. Recursively resolves until no new variables are found (or max depth)
   * 4. Expands all variable references in the final merged map
   *
   * @param variables - Initial list of variable names to resolve
   * @returns Map of variable names to fully resolved values
   */
  resolveAllVariables(variables: string[]): Record<string, string> {
    const allResolved = new Map<string, string>();
    let currentVariables = [...variables];
    let depth = 0;

    // Phase 1: Recursive discovery and resolution
    while (currentVariables.length > 0 && depth < this.options.maxDepth) {
      const newlyDiscovered: string[] = [];

      for (const varName of currentVariables) {
        if (allResolved.has(varName)) continue;

        const resolved = this.resolver.resolve(varName);
        if (resolved && typeof resolved.value === "string") {
          allResolved.set(varName, resolved.value);

          // Parse the resolved value to find nested variables
          const nestedVars = this.handlebars.discoverVariables(resolved.value);
          for (const nested of nestedVars) {
            if (!allResolved.has(nested)) {
              newlyDiscovered.push(nested);
            }
          }
        }
      }

      currentVariables = newlyDiscovered;
      depth++;
    }

    if (depth >= this.options.maxDepth && currentVariables.length > 0) {
      throw new Error(
        `Maximum variable resolution depth (${this.options.maxDepth}) exceeded. ` +
          `Possible circular reference. Unresolved: ${currentVariables.join(", ")}`,
      );
    }

    // Phase 2: Expand all variable references
    return this.expandVariableReferences(
      Object.fromEntries(allResolved),
      depth,
    );
  }

  /**
   * Expand all variable references in the resolved variable map.
   *
   * This iterates multiple times to handle nested references where
   * one variable's value contains another variable reference.
   */
  private expandVariableReferences(
    variables: Record<string, string>,
    maxIterations: number,
  ): Record<string, string> {
    const result = { ...variables };

    for (let i = 0; i < maxIterations; i++) {
      let changed = false;

      for (const [varName, varValue] of Object.entries(variables)) {
        const template =
          this.handlebars.compile<Record<string, string>>(varValue);
        const newValue = template(result, {
          data: { resolvedVariables: result },
        });

        if (newValue !== result[varName]) {
          result[varName] = newValue;
          changed = true;
        }
      }

      if (!changed) break;
    }

    return result;
  }

  /**
   * Remove template extensions (.hbs, .handlebars) from a file path.
   *
   * @param templatePath - The template file path
   * @returns The path with template extensions removed
   */
  static removeTemplateExtensions(templatePath: string): string {
    return templatePath.replaceAll(
      TemplateProcessor.FILENAME_REPLACE_PATTERN(),
      "",
    );
  }
}
