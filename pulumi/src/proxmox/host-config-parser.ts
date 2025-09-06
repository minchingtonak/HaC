import * as fs from 'fs';
import * as path from 'path';
import TOML from 'smol-toml';
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

const ConnectionOverrideSchema = z.object({
  host: z.string().optional(),
  user: z.string().optional(),
  port: z.number().positive().optional(),
  privateKey: z.string().optional(),
});

const ScriptProvisionerSchema = z.object({
  type: z.literal('script'),
  name: z.string().min(1),
  script: z.string().min(1),
  workingDirectory: z.string().default('/tmp'),
  runAs: z.string().default('root'),
  environment: z.record(z.string(), z.string()).optional(),
  timeout: z.number().positive().default(600),
  connection: ConnectionOverrideSchema.optional(),
  runOn: z
    .array(z.enum(['create', 'update', 'delete']))
    .optional()
    .default(['create']),
});

const AnsibleProvisionerSchema = z.object({
  type: z.literal('ansible'),
  name: z.string().min(1),
  playbook: z.string().min(1),
  variables: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.string().optional(),
  timeout: z.number().positive().default(600),
  connection: ConnectionOverrideSchema.optional(),
});

const ProvisionerSchema = z.discriminatedUnion('type', [
  ScriptProvisionerSchema,
  AnsibleProvisionerSchema,
]);

export const HostConfigSchema = z.object({
  id: z.number().positive().int(),
  hostname: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true).optional(),
  tags: z.array(z.string()).optional(),
  os: OsConfigSchema.optional(),
  cpu: CpuConfigSchema.optional(),
  memory: MemoryConfigSchema.optional(),
  disk: DiskConfigSchema.optional(),
  services: z.array(z.string()).optional(),
  mountPoints: z.array(MountPointSchema).optional(),
  provisioners: z.array(ProvisionerSchema).optional(),
});

export type HostConfigToml = z.infer<typeof HostConfigSchema>;
export type Provisioner = z.infer<typeof ProvisionerSchema>;
export type ScriptProvisioner = z.infer<typeof ScriptProvisionerSchema>;
export type AnsibleProvisioner = z.infer<typeof AnsibleProvisionerSchema>;

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
