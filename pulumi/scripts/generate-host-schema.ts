import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { HostConfigSchema } from '../src/proxmox/host-config-parser';

function generateHostConfigJsonSchema() {
  try {
    const jsonSchema = z.toJSONSchema(HostConfigSchema);

    const outputDir = join(process.cwd(), 'schemas');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = join(outputDir, 'host-config.schema.json');
    writeFileSync(outputPath, JSON.stringify(jsonSchema, null, 2));

    console.log(
      `✅ Host config JSON schema generated successfully at: ${outputPath}`,
    );
    console.log(
      `📄 Schema contains ${
        Object.keys(jsonSchema.properties || {}).length
      } top-level properties`,
    );
  } catch (error) {
    console.error('❌ Error generating JSON schema:', error);
    process.exit(1);
  }
}

generateHostConfigJsonSchema();
