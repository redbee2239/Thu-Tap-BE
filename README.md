# TaskFlow - Week 9

TaskFlow is packaged as a Docker stack with PostgreSQL, Redis, Swagger UI, and a GitHub Actions verification workflow.

## Run

```bash
docker compose up --build
```

Open these URLs after the app becomes healthy:

- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/openapi.json
- Health check: http://localhost:3000/health

Swagger UI flow: register a user, log in, copy `token`, click **Authorize**, and enter `Bearer <token>`.

Stop and remove containers with `docker compose down`. Add `-v` only when PostgreSQL and Redis volumes should also be removed.

## Configuration

Compose has development defaults, so no `.env` file is required for the first run. Use `.env.example` as the variable list when overriding values.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port, default `3000` |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `AUTH_SECRET` | Token signing secret; set a unique secret outside development |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Compose PostgreSQL settings |

Application logs go to stdout for collection by the container platform. `/health` returns `200` only while both PostgreSQL and Redis respond. On `SIGINT` or `SIGTERM`, the HTTP server stops accepting requests before BullMQ, Redis, and PostgreSQL connections close.

## CI

`.github/workflows/ci.yml` runs `lint`, `test`, then `build` for every push and pull request, with npm dependency caching. After this folder is pushed to GitHub, branch protection can require the `CI / verify` check before merge.

A live GitHub badge requires the future repository owner and name:

```md
[![CI](https://github.com/OWNER/REPOSITORY/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPOSITORY/actions/workflows/ci.yml)
```

## Local Checks

```bash
npm ci
npm run lint
npm test
npm run build
```

The Postman collection is at `postman/TaskFlow.postman_collection.json`.

## Scope

The inherited Week 8 domain repository is in memory, so projects and tasks reset when the app restarts. PostgreSQL is connected, health-checked, and cleanly closed for this infrastructure exercise; add a PostgreSQL repository when persistent domain data is the next requirement.
