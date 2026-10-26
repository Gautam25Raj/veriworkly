# Docker

`compose.yaml` runs the marketing site and the API. It does not run the studio, portfolio, docs or blog, and it has no PostgreSQL container.

| Service        | What it is                                                                                     | Port             |
| -------------- | ---------------------------------------------------------------------------------------------- | ---------------- |
| `web`          | The marketing site (`apps/site`), built from the root `Dockerfile` as a Next.js standalone app | `127.0.0.1:3000` |
| `api`          | The Express API, built from `apps/server/Dockerfile`                                           | `127.0.0.1:8080` |
| `migrate`      | Runs `prisma migrate deploy` once, before `api` starts                                         | none             |
| `redis`        | Redis 7 with a password and a memory limit                                                     | none             |
| `redisinsight` | Redis browser, only with `--profile dev`                                                       | `127.0.0.1:5540` |

Ports bind to `127.0.0.1` only. Put nginx (or another reverse proxy) on the host in front of them.

## Run it

1. Create the env file compose reads, and fill it in:

   ```bash
   cp .env.docker.example .env.docker
   ```

   You need your own PostgreSQL, for example Neon. Set `DATABASE_URL` to it.

2. Build and start:

   ```bash
   docker compose --env-file .env.docker up -d --build
   ```

Compose refuses to start while a required variable is empty and names it. `compose.yaml` marks each one with `${VAR:?}`. Some required variables, such as `TRUST_PROXY`, `WEB_CONCURRENCY` and `REDIS_PASSWORD`, are not in `.env.docker.example` yet; add them yourself. The API then checks formats at boot (`apps/server/src/config/environmentSchema.ts`).

`NEXT_PUBLIC_*` values are built into the site image. After changing one, rebuild with `docker compose --env-file .env.docker build web`.

## More

- API variables and production rules: [`apps/server/.env.example`](apps/server/.env.example) and [`apps/server/README.md`](apps/server/README.md).
- Studio deploy (pm2 + nginx, no Docker): [`apps/studio/README.md`](apps/studio/README.md#deploy-vps--nginx--pm2).
- Proxy and TLS setup: [Docker deployment guide](https://docs.veriworkly.com/docs/getting-started/docker-deployment).
