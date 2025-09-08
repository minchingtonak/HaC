import * as fs from 'fs';
import * as path from 'path';
import TOML from 'smol-toml';
import { z } from 'zod';
import { HostConfigSchema, HostConfigToml } from './host-config-schema';
import { EnvUtils } from '../utils/env-utils';

export class HostConfigParser {
  private static readonly HOST_CONFIG_FILENAME = 'host.toml';

  private static validateHostConfig(config: any): HostConfigToml {
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

  static parseHostConfigFile(filePath: string): HostConfigToml {
    const tomlContent = fs.readFileSync(filePath, 'utf-8');

    return HostConfigParser.parseHostConfigString(tomlContent);
  }

  static parseHostConfigString(tomlContent: string): HostConfigToml {
    const parsed = TOML.parse(tomlContent);

    const validatedConfig = HostConfigParser.validateHostConfig(parsed);

    return validatedConfig;
  }

  static discoverHostConfigFiles(hostsDir: string): string[] {
    const configFiles: string[] = [];

    const hostDirs = fs
      .readdirSync(hostsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const hostDir of hostDirs) {
      const configPath = path.join(
        hostsDir,
        hostDir,
        HostConfigParser.HOST_CONFIG_FILENAME,
      );

      if (fs.existsSync(configPath)) {
        configFiles.push(configPath);
      }
    }

    return configFiles;
  }

  static loadAllHostConfigs(hostsDir: string): HostConfigToml[] {
    const configs: HostConfigToml[] = [];
    const configFiles = HostConfigParser.discoverHostConfigFiles(hostsDir);

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

  static validateConfig(config: unknown): HostConfigToml {
    return HostConfigParser.validateHostConfig(config);
  }
}
