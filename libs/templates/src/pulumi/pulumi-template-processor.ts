import * as pulumi from "@pulumi/pulumi";
import * as fs from "node:fs";
import * as Handlebars from "handlebars";

import {
  type TemplateProcessorBase,
  type RenderedTemplateFile,
} from "../template-processor-interface";
import {
  TemplateProcessor,
  type TemplateProcessorOptions,
} from "../template-processor";
import { type VariableResolver } from "../variable-resolver";
import { PulumiVariableResolver } from "./pulumi-variable-resolver";

/**
 * Options for Pulumi template processing.
 */
export type PulumiTemplateProcessorOptions = TemplateProcessorOptions;

/**
 * Pulumi-aware template processor that handles `Output<string>` values.
 *
 * This processor extends the base template functionality to work with
 * Pulumi's async Output system, allowing templates to reference
 * configuration values that may be secrets or computed values.
 *
 * The recursive variable resolution is handled through `Output.apply()`
 * chains to properly track dependencies.
 *
 * @example
 * ```typescript
 * import { PulumiTemplateProcessor, PulumiVariableResolver } from "@hac/templates/pulumi";
 *
 * const resolver = new PulumiVariableResolver(new pulumi.Config("myapp"));
 * const processor = new PulumiTemplateProcessor(resolver);
 *
 * const result = processor.processTemplateFile("config.hbs.toml");
 * // result.content is pulumi.Output<string>
 * ```
 */
export class PulumiTemplateProcessor implements TemplateProcessorBase<
  pulumi.Output<string>
> {
  private resolver: VariableResolver<string | pulumi.Output<string>>;
  private maxDepth: number;

  constructor(
    resolver: VariableResolver<string | pulumi.Output<string>>,
    options?: PulumiTemplateProcessorOptions,
  ) {
    this.resolver = resolver;
    this.maxDepth = options?.maxDepth ?? 10;
  }

  /**
   * Create a processor from a Pulumi config namespace.
   *
   * @param configNamespace - The Pulumi config namespace
   * @param options - Processor options
   */
  static fromConfig(
    configNamespace: string,
    options?: PulumiTemplateProcessorOptions,
  ): PulumiTemplateProcessor {
    const resolver = new PulumiVariableResolver(
      new pulumi.Config(configNamespace),
    );
    return new PulumiTemplateProcessor(resolver, options);
  }

  /**
   * Process a template file with Pulumi Output support.
   *
   * @param templatePath - Path to the template file
   * @param dataVariables - Additional data to pass to the template context
   * @returns Processed template with Output<string> content
   */
  processTemplateFile(
    templatePath: string,
    dataVariables?: object,
  ): RenderedTemplateFile<pulumi.Output<string>> {
    const templateContent = fs.readFileSync(templatePath, "utf-8");

    const variables = TemplateProcessor.discoverVariables(templateContent);

    if (variables.length === 0) {
      return { content: pulumi.output(templateContent), templatePath };
    }

    const resolvedVariables = this.resolveAllVariables(
      variables,
      dataVariables,
    );

    const content = this.renderTemplate(
      resolvedVariables,
      templateContent,
      dataVariables,
    );

    return { content, templatePath };
  }

  /**
   * Render a template string with Pulumi Output support.
   *
   * @param templateContent - The template string to render
   * @param dataVariables - Additional data to pass to the template context
   * @returns The rendered template as a Pulumi Output
   */
  renderTemplateString(
    templateContent: string,
    dataVariables?: object,
  ): pulumi.Output<string> {
    const variables = TemplateProcessor.discoverVariables(templateContent);

    if (variables.length === 0) {
      return pulumi.output(templateContent);
    }

    const resolvedVariables = this.resolveAllVariables(
      variables,
      dataVariables,
    );

    return this.renderTemplate(
      resolvedVariables,
      templateContent,
      dataVariables,
    );
  }

  /**
   * Render a template with pre-resolved variables.
   */
  private renderTemplate(
    resolvedVariables: pulumi.Output<Record<string, string>>,
    templateContent: string,
    dataVariables?: object,
  ): pulumi.Output<string> {
    const template = Handlebars.compile<Record<string, string>>(
      templateContent,
      {},
    );

    return resolvedVariables.apply((vars) =>
      template(vars, { data: { ...dataVariables, resolvedVariables: vars } }),
    );
  }

  /**
   * Resolve all variables with recursive discovery through Output.apply() chains.
   *
   * This method:
   * 1. Resolves initial variables via the resolver
   * 2. Uses Output.apply() to discover nested variable references
   * 3. Recursively resolves until no new variables found (or max depth)
   * 4. Expands all variable references in the final merged map
   */
  private resolveAllVariables(
    variables: string[],
    dataVariables?: object,
  ): pulumi.Output<Record<string, string>> {
    // Initial resolution
    const initialVarMap = this.resolveVariableList(variables);

    let maxVariableDepth = 1;

    // Recursive discovery function
    const processRecursiveVariables = (
      varValues: string[],
    ): pulumi.Output<Record<string, string | pulumi.Output<string>>> => {
      const discoveredVars = TemplateProcessor.discoverVariables(
        varValues.join("\n"),
      );

      if (discoveredVars.length === 0) {
        return pulumi.output({} as Record<string, string>);
      }

      // Increment depth for each level of nesting
      maxVariableDepth++;

      if (maxVariableDepth > this.maxDepth) {
        throw new Error(
          `Maximum variable resolution depth (${this.maxDepth}) exceeded. ` +
            `Possible circular reference.`,
        );
      }

      const varMap = this.resolveVariableList(discoveredVars);

      return pulumi
        .all(Object.values(varMap))
        .apply(processRecursiveVariables)
        .apply((processedVars) => ({ ...processedVars, ...varMap }));
    };

    // Chain recursive resolution
    const recursiveVariableValueMap = pulumi
      .all(Object.values(initialVarMap))
      .apply(processRecursiveVariables);

    // Merge initial and recursively discovered variables
    const mergedVariables = pulumi
      .all(initialVarMap)
      .apply((initialVars) =>
        pulumi
          .all(recursiveVariableValueMap)
          .apply((recursiveVars) => ({ ...initialVars, ...recursiveVars })),
      );

    // Expand all variable references
    const resolvedVariables = mergedVariables.apply((merged) => {
      const result = structuredClone(merged);

      // Iterate to expand nested references
      // Only need maxDepth - 1 iterations since top-level vars are handled
      // in the final template render
      for (let i = 0; i < maxVariableDepth - 1; ++i) {
        for (const [varName, varValue] of Object.entries(merged)) {
          const template = Handlebars.compile<Record<string, string>>(varValue);

          const newVariableValue = template(result, {
            data: { ...dataVariables, resolvedVariables: result },
          });

          result[varName] = newVariableValue;
        }
      }

      return result;
    });

    return resolvedVariables;
  }

  /**
   * Resolve a list of variable names using the resolver.
   */
  private resolveVariableList(
    variables: string[],
  ): Record<string, string | pulumi.Output<string>> {
    const result: Record<string, string | pulumi.Output<string>> = {};

    for (const varName of variables) {
      if (this.resolver.shouldIgnore?.(varName)) {
        continue;
      }

      const resolved = this.resolver.resolve(varName);
      if (resolved) {
        result[varName] = resolved.value;
      }
    }

    return result;
  }
}
