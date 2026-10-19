import type { OpenAPIRegistry, RouteConfig } from '@asteasolutions/zod-to-openapi';
import type { RequestHandler, Router } from 'express';
import type { ZodType } from 'zod';

export type HttpMethod = 'get' | 'post' | 'patch' | 'delete';
export type AuthKind = 'none' | 'bearer' | 'cookie';

type RouteParameter = NonNullable<RouteConfig['request']>['params'];

export interface RouteResponseSpec {
  status: number;
  description: string;
  schema?: ZodType;
  example?: unknown;
}

export interface DefineRouteOptions {
  method: HttpMethod;
  path: string;
  summary: string;
  tags: string[];
  auth: AuthKind;
  request?: {
    body?: ZodType;
    bodyExample?: unknown;
    params?: RouteParameter;
    query?: RouteParameter;
  };
  responses: RouteResponseSpec[];
  handlers: RequestHandler[];
}

const SECURITY_SCHEME: Record<Exclude<AuthKind, 'none'>, string> = {
  bearer: 'bearerAuth',
  cookie: 'cookieAuth',
};

export function createRouteDefiner(router: Router, registry: OpenAPIRegistry, basePath: string) {
  return function defineRoute(options: DefineRouteOptions): void {
    router[options.method](options.path, ...options.handlers);

    const docPath = `${basePath}${options.path === '/' ? '' : options.path}`.replace(
      /:([a-zA-Z0-9_]+)/g,
      '{$1}',
    );

    const responses: RouteConfig['responses'] = {};
    for (const response of options.responses) {
      responses[response.status] = {
        description: response.description,
        ...(response.schema
          ? {
              content: {
                'application/json': {
                  schema: response.schema,
                  ...(response.example !== undefined ? { example: response.example } : {}),
                },
              },
            }
          : {}),
      };
    }

    registry.registerPath({
      method: options.method,
      path: docPath,
      summary: options.summary,
      tags: options.tags,
      ...(options.auth !== 'none' ? { security: [{ [SECURITY_SCHEME[options.auth]]: [] }] } : {}),
      ...(options.request
        ? {
            request: {
              ...(options.request.body
                ? {
                    body: {
                      content: {
                        'application/json': {
                          schema: options.request.body,
                          ...(options.request.bodyExample !== undefined
                            ? { example: options.request.bodyExample }
                            : {}),
                        },
                      },
                    },
                  }
                : {}),
              ...(options.request.params ? { params: options.request.params } : {}),
              ...(options.request.query ? { query: options.request.query } : {}),
            },
          }
        : {}),
      responses,
    });
  };
}
