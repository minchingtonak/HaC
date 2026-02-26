import * as Handlebars from "handlebars";

import { BUILTIN_HELPERS } from "./helpers/register";

export type HandlebarsCompileOptions = Parameters<typeof Handlebars.compile>[1];

/**
 * An isolated Handlebars environment with builtin helpers pre-registered.
 *
 * Each instance maintains its own helpers and partials, independent of
 * the global Handlebars singleton. This enables:
 * - No global state pollution
 * - Different helper sets for different processors
 * - Better testability and isolation
 *
 * @example
 * ```typescript
 * const hbs = new HandlebarsInstance();
 *
 * // Register a custom helper
 * hbs.registerHelper("myHelper", (arg) => arg.toUpperCase());
 *
 * // Compile and render
 * const template = hbs.compile("Hello {{myHelper name}}!");
 * const result = template({ name: "world" }); // "Hello WORLD!"
 * ```
 */
export class HandlebarsInstance {
  readonly hbs: ReturnType<typeof Handlebars.create>;

  constructor(options?: { skipBuiltins?: boolean }) {
    this.hbs = Handlebars.create();

    if (!options?.skipBuiltins) {
      this.registerBuiltins();
    }
  }

  private registerBuiltins(): void {
    for (const [name, entry] of Object.entries(BUILTIN_HELPERS)) {
      const helper = entry.requiresInstance ? entry.factory(this) : entry.fn;
      this.hbs.registerHelper(name, helper);
    }
  }

  /**
   * Register a custom helper on this instance.
   */
  registerHelper(name: string, helper: Handlebars.HelperDelegate): void {
    this.hbs.registerHelper(name, helper);
  }

  /**
   * Register a partial template on this instance.
   */
  registerPartial(name: string, partial: Handlebars.Template): void {
    this.hbs.registerPartial(name, partial);
  }

  /**
   * Compile a template string into a reusable template function.
   */
  compile<T = unknown>(
    template: string,
    options?: HandlebarsCompileOptions,
  ): Handlebars.TemplateDelegate<T> {
    return this.hbs.compile<T>(template, options);
  }

  /**
   * Create a SafeString that won't be escaped when rendered.
   */
  SafeString(value: string): Handlebars.SafeString {
    return new this.hbs.SafeString(value);
  }

  /**
   * Discover all variable names referenced in a template string.
   *
   * Uses Handlebars AST parsing to find all variable references,
   * including those inside block statements and helpers.
   *
   * @param templateContent - The template string to parse
   * @returns Array of unique variable names found
   */
  discoverVariables(templateContent: string): string[] {
    const ast = this.hbs.parse(templateContent);
    const variables = new Set<string>();

    type ASTNode =
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

        // Terminal nodes - no action needed
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
}
