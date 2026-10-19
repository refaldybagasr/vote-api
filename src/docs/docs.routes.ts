import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { generateOpenApiDocument } from './generate-document';

export function createDocsRouter(registry: OpenAPIRegistry): Router {
  const router = Router();
  const document = generateOpenApiDocument(registry);

  router.get('/openapi.json', (_req, res) => {
    res.status(200).json(document);
  });

  router.use('/', swaggerUi.serve, swaggerUi.setup(document));

  return router;
}
