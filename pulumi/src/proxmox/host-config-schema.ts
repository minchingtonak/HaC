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
  variables: z.record(z.string(), z.unknown()).optional(),
  user: z.string().default('root'),
  privateKeyFile: z.string().default('~/.ssh/lxc_ed25519'),
  tags: z.array(z.string()).optional(),
  limit: z.string().optional(),
  timeout: z.number().positive().default(600),
  replayable: z.boolean().default(true),
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
  enabled: z.boolean().default(true),
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
