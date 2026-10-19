import { OpenApiGeneratorV3, type OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

export function generateOpenApiDocument(registry: OpenAPIRegistry) {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: { title: 'vote-api', version: '0.1.0' },
    servers: [{ url: '/api' }],
  });
}
