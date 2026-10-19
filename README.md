# vote-api

Backend API for the voting app technical assessment.

## Tech stack

Express 5, TypeScript (strict), MongoDB (Mongoose), Zod, bcrypt, jsonwebtoken, cookie-parser, helmet, cors, express-rate-limit, pino. API docs are generated from the Zod schemas with `@asteasolutions/zod-to-openapi` and served with `swagger-ui-express`. Tests: Jest, Supertest, `mongodb-memory-server`.

## Folder structure

```
src/
├── config/      env loading + Zod validation
├── container.ts composition root: manual dependency wiring
├── lib/         jwt, password, normalizeName, clock, AppError, domain errors
├── middlewares/ authenticate, authorize, validate, errorHandler, notFound, requireAllowedOrigin
├── docs/        OpenAPI registry, generator, defineRoute, route-coverage check
├── modules/
│   ├── auth/ users/ candidates/ votes/ results/
│   │   ├── *.routes.ts *.controller.ts *.service.ts
│   │   ├── *.repository.ts *.model.ts *.schema.ts
│   │   └── __tests__/
│   └── shared/transaction-manager.ts
├── app.ts       createApp(deps)
└── server.ts    connect DB, syncIndexes, listen, graceful shutdown
scripts/seed.ts
docker-compose.yml
```

## Running locally

Prerequisites: Node.js `20.20.2` (see `.nvmrc`), npm, Docker.

```bash
docker compose up -d --wait
cp .env.example .env
npm install
npm run seed
npm run dev
```

API runs at `http://localhost:3000`.

Other scripts: `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:watch`, `npm run test:coverage`.

## Seeding

```bash
npm run seed
```

Creates the first admin from `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`, and optional demo users from `SEED_DEMO_USERS` (comma-separated `username:password` pairs) — all read from `.env`. Idempotent: safe to run again, it only creates users that don't exist yet and never resets an existing password.

## API docs

With the server running and `DOCS_ENABLED=true` (default):

- Swagger UI: `http://localhost:3000/api/docs`
- Raw OpenAPI document: `http://localhost:3000/api/docs/openapi.json`
