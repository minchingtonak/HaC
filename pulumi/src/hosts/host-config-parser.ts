import * as fs from 'node:fs';
import * as pulumi from '@pulumi/pulumi';
import TOML from 'smol-toml';
import { z } from 'zod';
import {
  HostConfigSchema,
  HostConfigToml,
  HostnameSchema,
} from './host-config-schema';
import { TemplateProcessor } from '../templates/template-processor';

export class HostConfigParser {
  static loadAllHostConfigs(
    hostsDir: string,
  ): (HostConfigToml | pulumi.Output<HostConfigToml>)[] {
    const configs: (HostConfigToml | pulumi.Output<HostConfigToml>)[] = [];
    const configFiles = TemplateProcessor.discoverTemplateFiles(hostsDir, {
      isTemplateOverride: (_, filename) =>
        /^host\.(hbs|handlebars)\.toml$/.test(filename),
    });

    for (const configPath of configFiles) {
      try {
        const config = HostConfigParser.parseHostConfigFile(configPath);
        configs.push(config);
      } catch (error) {
        console.warn(
          `Warning: Failed to load config from ${configPath}:`,
          error,
        );
      }
    }

    return configs;
  }

  static parseHostConfigFile(
    filePath: string,
  ): HostConfigToml | pulumi.Output<HostConfigToml> {
    const hostname = HostConfigParser.getHostnameFromConfigFile(filePath);
    const renderedTemplate = TemplateProcessor.processTemplate(
      filePath,
      new pulumi.Config(hostname),
    );

    return HostConfigParser.parseHostConfigString(renderedTemplate.content);
  }

  // TODO find more efficient way of getting this info that avoids reading/parsing/validating twice
  private static getHostnameFromConfigFile(filePath: string) {
    const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
    const parsed = TOML.parse(fileContent);

    try {
      const { hostname } = HostnameSchema.parse(parsed);
      return hostname;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues
          .map((err: z.core.$ZodIssue) => {
            return JSON.stringify(err); // FIXME this may crash when err.path contains symbol values
          })
          .join('\n;\n');
        throw new Error(`Invalid TOML structure: ${errorMessages}`);
      }
      throw error;
    }
  }

  static parseHostConfigString(
    tomlContent: pulumi.Output<string>,
  ): pulumi.Output<HostConfigToml> {
    function parseAndValidate(tomlContent: string) {
      const parsed = TOML.parse(tomlContent);
      return HostConfigParser.validateHostConfig(parsed);
    }

    return tomlContent.apply(parseAndValidate);
  }

  private static validateHostConfig(config: unknown): HostConfigToml {
    try {
      return HostConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues
          .map((err: z.core.$ZodIssue) => {
            return JSON.stringify(err); // FIXME this may crash when err.path contains symbol values
          })
          .join('\n;\n');
        throw new Error(`Invalid TOML structure: ${errorMessages}`);
      }
      throw error;
    }
  }
}
