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
  content: string | pulumi.Output<string>;
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
  private static readonly SECRET_VARIABLE_PREFIX = 'SECRET_';
  private static readonly TEMPLATE_EXTENSIONS = ['.hbs', '.handlebars'];
  private static readonly TEMPLATE_PATTERN = () => /\.(hbs|handlebars)\..+$/;

  static discoverTemplateFiles(
    directory: string,
    recursive: boolean = true,
  ): string[] {
    const templateFiles: string[] = [];

    function scanDirectory(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && recursive) {
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          if (TemplateProcessor.isTemplateFile(entry.name)) {
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
    serviceName: string,
    hostname?: string,
  ): RenderedTemplateFile {
    const templateContent = fs.readFileSync(templatePath, 'utf-8');

    const variables = TemplateProcessor.discoverVariables(templateContent);

    const context = EnvUtils.assembleVariableMapFromConfig(
      new pulumi.Config(hostname ? `${hostname}#${serviceName}` : serviceName),
      variables,
    );

    const template =
      Handlebars.compile<Record<string, string>>(templateContent);
    const renderedContent = pulumi.all(context).apply(template);

    const finalOutputPath = TemplateProcessor.getRemoteOutputPath(
      templatePath,
      serviceName,
    );

    return {
      idSafeName: TemplateProcessor.buildSanitizedNameForId(templatePath),
      templatePath,
      remoteOutputPath: finalOutputPath,
      content: renderedContent,
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

  private static getRemoteOutputPath(
    templatePath: string,
    serviceName: string,
  ): string {
    const pathWithoutTemplateExt = templatePath.replaceAll(
      TemplateProcessor.FILENAME_REPLACE_PATTERN(),
      '',
    );

    const stackRelativePath = pathWithoutTemplateExt.slice(
      pathWithoutTemplateExt.indexOf(serviceName),
    );

    return `/etc/pulumi/${stackRelativePath}`;
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
