import { z } from "zod";
import type { CamelCasedPropertiesDeep } from "type-fest";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { remote } from "@pulumi/command/types/input";
import { LXC_DEFAULTS } from "./pve";
import { ScriptProvisionerRunOn } from "../../constants";

/**
 * @see {@link remote.ConnectionArgs}
 */
export const AnsibleConnectionOverrideSchema = z
  .object({
    host: z.string().optional(),
    user: z.string().optional(),
    port: z.number().positive().optional(),
    /**
     * Path to private key file. Required to invoke Ansible
     */
    private_key_path: z.string().optional(),
  })
  .strict()
  .readonly();

/**
 * @see {@link remote.ConnectionArgs}
 */
export const ScriptConnectionOverrideSchema = z
  .object({
    host: z.string().optional(),
    user: z.string().optional(),
    port: z.number().positive().optional(),
    private_key: z.string().optional(),
  })
  .strict()
  .readonly();

export const ScriptProvisionerSchema = z
  .object({
    type: z.literal("script"),
    script: z.string().min(1),
    working_directory: z
      .string()
      .default(LXC_DEFAULTS.PROVISIONER.WORKING_DIRECTORY),
    run_as: z.string().default(LXC_DEFAULTS.SSH_USER),
    environment: z.record(z.string(), z.string()).optional(),
    timeout: z
      .number()
      .positive()
      .default(LXC_DEFAULTS.PROVISIONER.TIMEOUT_SECONDS),
    connection: ScriptConnectionOverrideSchema.optional(),
    run_on: z
      .array(z.enum(Object.values(ScriptProvisionerRunOn)))
      .optional()
      // @ts-expect-error allowing use of readonly type since LXC_DEFAULTS uses `as const`
      .default(LXC_DEFAULTS.PROVISIONER.RUN_ON),
  })
  .strict()
  .readonly();

/**
 * @see {@link PlaybookArgs}
 */
export const AnsibleProvisionerSchema = z
  .object({
    type: z.literal("ansible"),
    playbook: z.string().min(1),
    variables: z.record(z.string(), z.unknown()).optional(),
    tags: z.array(z.string()).optional(),
    limit: z.string().optional(),
    timeout: z
      .number()
      .positive()
      .default(LXC_DEFAULTS.PROVISIONER.TIMEOUT_SECONDS),
    replayable: z
      .boolean()
      .default(LXC_DEFAULTS.PROVISIONER.ANSIBLE_REPLAYABLE),
    connection: AnsibleConnectionOverrideSchema.optional(),
  })
  .strict()
  .readonly();

export const ProvisionerSchema = z.discriminatedUnion("type", [
  ScriptProvisionerSchema,
  AnsibleProvisionerSchema,
]);

export type Provisioner = CamelCasedPropertiesDeep<
  z.infer<typeof ProvisionerSchema>
>;
export type ScriptProvisioner = CamelCasedPropertiesDeep<
  z.infer<typeof ScriptProvisionerSchema>
>;
export type AnsibleProvisioner = CamelCasedPropertiesDeep<
  z.infer<typeof AnsibleProvisionerSchema>
>;
