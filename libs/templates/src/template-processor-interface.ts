/**
 * Result of processing a template file.
 *
 * @typeParam T - The type of the content (string for sync, Output<string> for Pulumi)
 */
export interface RenderedTemplateFile<T = string> {
  /** The original template file path */
  templatePath: string;
  /** The rendered content with all variables resolved */
  content: T;
}

/**
 * Common interface for template processors.
 *
 * This interface defines the core template processing operations that both
 * synchronous and async (Pulumi) processors must implement.
 *
 * @typeParam T - The type of rendered content. Use `string` for synchronous
 *                processing or `pulumi.Output<string>` for Pulumi integration.
 *
 * @example
 * ```typescript
 * // Synchronous processing
 * const syncProcessor: TemplateProcessorBase<string> = new TemplateProcessor(resolver);
 * const result: string = syncProcessor.renderTemplateString("Hello {{NAME}}");
 *
 * // Pulumi processing
 * const pulumiProcessor: TemplateProcessorBase<pulumi.Output<string>> =
 *   new PulumiTemplateProcessor(resolver);
 * const result: pulumi.Output<string> = pulumiProcessor.renderTemplateString("Hello {{NAME}}");
 * ```
 */
export interface TemplateProcessorBase<T> {
  /**
   * Render a template string with variable resolution.
   *
   * Variables are discovered, resolved (including nested references),
   * and then the template is rendered.
   *
   * @param templateContent - The template string to render
   * @param dataVariables - Additional data to pass to the template context
   * @returns The rendered template content
   */
  renderTemplateString(templateContent: string, dataVariables?: object): T;

  /**
   * Process a template file with variable resolution.
   *
   * @param templatePath - Path to the template file
   * @param dataVariables - Additional data to pass to the template context
   * @returns The processed template result including metadata
   */
  processTemplateFile(
    templatePath: string,
    dataVariables?: object,
  ): RenderedTemplateFile<T>;
}
