import { z } from "zod";

export const StackSchema = z
  .object({ subdomain_prefixes: z.record(z.string(), z.string()).optional() })
  .strict()
  .readonly();

export const StackSchemaMap = z.record(z.string(), StackSchema);
