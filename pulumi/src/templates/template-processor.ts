import * as pulumi from '@pulumi/pulumi';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as Handlebars from 'handlebars';
import { EnvUtils } from '../utils/env-utils';

export interface TemplateContext {
  [key: string]: string | pulumi.Output<string>;
}

export interface RenderedTemplateFile {
  idSafeName: string;
  templatePath: string;
  remoteOutputPath: string;
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
  private static readonly TEMPLATE_EXTENSIONS = ['.hbs', '.handlebars'];
  private static readonly TEMPLATE_PATTERN = () => /\.(hbs|handlebars)\..+$/;

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

    const isTemplate = options?.isTemplateOverride
      ? options.isTemplateOverride
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
    const ext = path.extname(filename);
    if (TemplateProcessor.TEMPLATE_EXTENSIONS.includes(ext)) {
      return true;
    }

    return TemplateProcessor.TEMPLATE_PATTERN().test(filename);
  }

  static processTemplate(
    templatePath: string,
    config: pulumi.Config,
  ): RenderedTemplateFile {
    const templateContent = fs.readFileSync(templatePath, 'utf-8');

    const variables = TemplateProcessor.discoverVariables(templateContent);

    const context = EnvUtils.assembleVariableMapFromConfig(config, variables);

    const idSafeName = TemplateProcessor.buildSanitizedNameForId(templatePath);

    const template =
      Handlebars.compile<Record<string, string>>(templateContent);
    const content = pulumi.all(context).apply(template);

    const remoteOutputPath =
      TemplateProcessor.getRemoteOutputPath(templatePath);

    return {
      content,
      idSafeName,
      templatePath,
      remoteOutputPath,
    };
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
        case 'PathExpression': {
          variables.add(astNode.original);
          break;
        }

        case 'MustacheStatement': {
          walkAST(astNode.path);
          if (astNode.params.length > 0) {
            walkAST(astNode.params);
          }
          if (astNode.hash) {
            walkAST(astNode.hash);
          }
          break;
        }

        case 'BlockStatement': {
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

        case 'SubExpression': {
          walkAST(astNode.path);
          if (astNode.params.length > 0) {
            walkAST(astNode.params);
          }
          if (astNode.hash) {
            walkAST(astNode.hash);
          }
          break;
        }

        case 'PartialStatement': {
          walkAST(astNode.name);
          if (astNode.params.length > 0) {
            walkAST(astNode.params);
          }
          if (astNode.hash) {
            walkAST(astNode.hash);
          }
          break;
        }

        case 'PartialBlockStatement': {
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

        case 'Hash': {
          walkAST(astNode.pairs);
          break;
        }

        case 'HashPair': {
          walkAST(astNode.value);
          break;
        }

        // Terminal nodes
        case 'ContentStatement':
        case 'CommentStatement':
        case 'StringLiteral':
        case 'BooleanLiteral':
        case 'NumberLiteral':
        case 'UndefinedLiteral':
        case 'NullLiteral':
          break;
      }
    }

    walkAST(ast.body);

    return Array.from(variables);
  }

  private static readonly FILENAME_REPLACE_PATTERN = () =>
    /\.(hbs|handlebars)/g;
  private static readonly REMOTE_OUTPUT_FOLDER_ROOT = '/etc/pulumi';

  private static getRemoteOutputPath(templatePath: string): string {
    const pathWithoutTemplateExt = templatePath.replaceAll(
      TemplateProcessor.FILENAME_REPLACE_PATTERN(),
      '',
    );

    return path.join(
      TemplateProcessor.REMOTE_OUTPUT_FOLDER_ROOT,
      pathWithoutTemplateExt,
    );
  }

  static buildSanitizedNameForId(templatePath: string): string {
    const filename = path.basename(templatePath);
    return filename.replaceAll('.', '-').replaceAll(/[^a-zA-Z0-9_-]/g, '');
  }
}

Handlebars.registerHelper('helperMissing', function (/* dynamic arguments */) {
  const options = arguments[arguments.length - 1];
  const args = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
  return new Handlebars.SafeString(
    'helperMissing: ' + options.name + '(' + args + ')',
  );
});
