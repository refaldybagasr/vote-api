import type { Router } from 'express';

interface ExpressRouteLayer {
  route?: unknown;
}

interface OpenApiDocumentLike {
  paths?: Record<string, object>;
}

export function countRegisteredRoutes(router: Router): number {
  const stack = (router as unknown as { stack: ExpressRouteLayer[] }).stack ?? [];
  return stack.reduce((count, layer) => (layer.route ? count + 1 : count), 0);
}

export function countDocumentedRoutes(document: OpenApiDocumentLike, basePath: string): number {
  let count = 0;
  for (const [path, methods] of Object.entries(document.paths ?? {})) {
    if (path === basePath || path.startsWith(`${basePath}/`)) {
      count += Object.keys(methods).length;
    }
  }
  return count;
}
