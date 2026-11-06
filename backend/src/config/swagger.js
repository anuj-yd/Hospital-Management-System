import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsPath = path.resolve(__dirname, '../../docs/openapi.yaml');

/**
 * Mount Swagger UI on the given Express app.
 * Silently skips if the YAML file doesn't exist yet.
 */
export function mountSwagger(app) {
  if (!fs.existsSync(docsPath)) {
    return;
  }
  const spec = YAML.load(docsPath);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, { explorer: true }));
}
