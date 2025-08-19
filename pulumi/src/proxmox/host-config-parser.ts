import * as fs from 'fs';
import * as path from 'path';
import * as toml from '@iarna/toml';
import { z } from 'zod';

const CpuConfigSchema = z.object({
  architecture: z.string().optional(),
  cores: z.number().positive().optional(),
  units: z.number().positive().optional(),
});

const MemoryConfigSchema = z.object({
  dedicated: z.number().positive().optional(),
  swap: z.number().positive().optional(),
});

const DiskConfigSchema = z.object({
  datastoreId: z.string().optional(),
  size: z.number().positive().optional(),
});

const OsConfigSchema = z.object({
  templateFileId: z.string(),
  type: z.string().optional(),
});

const MountPointSchema = z.object({
  volume: z.string().min(1),
  mountPoint: z.string().min(1),
  size: z.number().positive().optional(),
  acl: z.boolean().optional(),
  backup: z.boolean().optional(),
  quota: z.boolean().optional(),
  replicate: z.boolean().optional(),
  shared: z.boolean().optional(),
});

const HostConfigSchema = z.object({
  id: z.number().positive().int(),
  hostname: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  tags: z.array(z.string()).optional(),
  os: OsConfigSchema.optional(),
  cpu: CpuConfigSchema.optional(),
  memory: MemoryConfigSchema.optional(),
  disk: DiskConfigSchema.optional(),
  services: z.array(z.string()).optional(),
  mountPoints: z.array(MountPointSchema).optional(),
});

export type HostConfigToml = z.infer<typeof HostConfigSchema>;

export class HostConfigParser {
  private static readonly HOST_CONFIG_FILENAME = 'host.toml';

  private static validateHostConfig(config: unknown): HostConfigToml {
    try {
      return HostConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues
          .map(
            (err: z.core.$ZodIssue) => `${err.path.join('.')}: ${err.message}`,
          )
          .join('; ');
        throw new Error(`Invalid TOML structure: ${errorMessages}`);
      }
      throw error;
    }
  }

  static parseHostConfigFile(filePath: string): HostConfigToml {
    const tomlContent = fs.readFileSync(filePath, 'utf-8');

    const parsed = toml.parse(tomlContent);

    const validatedConfig = HostConfigParser.validateHostConfig(parsed);

    return validatedConfig;
  }

  static parseHostConfigString(tomlContent: string): HostConfigToml {
    const parsed = toml.parse(tomlContent);

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
