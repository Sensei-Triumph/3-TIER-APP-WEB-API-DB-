# Web + API + DB stack

| Service | Tech | Exposure |
| --- | --- | --- |
| web | Nginx (static UI + reverse proxy to `/api`) | host port `${WEB_PORT}` (default 8082) |
| api | Node 20 / Express | internal only |
| db | PostgreSQL 16 | internal only (private network), persisted in `pgdata` volume |

## Run

In Linux:

    Copy-Item .env.example .env   # edit the password if needed
    docker compose up --build -d
    Start-Process http://localhost:8082

## Production-grade additions

- strict env validation via `api/config.js`
- structured logging with Pino
- Prometheus metrics at `/api/metrics`
- rate limiting and security headers
- CI workflow in `.github/workflows/ci.yml`

## Useful

    docker compose exec db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
    docker compose down        # keep data
    docker compose down -v     # wipe data
    curl http://localhost:8082/api/health
    curl http://localhost:8082/api/metrics

Note: `db/init.sql` only runs on first start (empty volume).
