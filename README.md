# School Admission System

First-come, first-served seat booking for school admissions. ASP.NET Core (.NET 10) API, React + Vite frontend, PostgreSQL 18.

**Status:** the design is final. Done: the schema, the class endpoints (`POST /classes`, `GET /classes`, `GET /classes/{id}`) and their tests. Not yet: the hold endpoints, expiry, the UI and the frontend tests.

## Run

Requires only Docker with Compose v2.

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:8080 |
| API health | http://localhost:8080/health (200 when the database is reachable, 503 when it isn't) |
| PostgreSQL | No host port. To inspect it: `docker compose exec db psql -U postgres -d school_admission` |

CI (GitHub Actions) builds the images, starts the stack and checks both URLs on every push.

Stop with `docker compose down`. Data survives in the `pgdata` volume. `docker compose down -v` deletes it.

## Configuration

No `.env` file is needed. Every value has a default. To change one, copy `.env.example` to `.env`, or set it in the shell:

```bash
HOLD_DURATION_SECONDS=2 docker compose up --build
```

| Variable | Used by | Default |
|---|---|---|
| `HOLD_DURATION_SECONDS` | API | `600` (also used when the value is invalid or 0 or less) |
| `DATABASE_CONNECTION_STRING`, `DATABASE_URL`, `ConnectionStrings__DefaultConnection` | API: the first one set wins | the compose `db` service |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | db | `school_admission`, `postgres`, `postgres` |
| `VITE_API_BASE_URL`, then `VITE_API_URL` | frontend build | `http://localhost:8080` |

## Tests

Backend tests (xUnit, against a real PostgreSQL in compose; each run uses a throwaway database):

```bash
docker compose --profile test run --rm backend-tests
```

Frontend tests: not written yet.

## Design

The diagrams are in `planning/diagrams/`:

| Diagram | Shows |
|---|---|
| `1-HLD-system-architecture.png` | Containers, ports, and how the API, sweeper and database connect |
| `2-LLD-place-hold.png` | The place-hold transaction: class row lock, expiry flush, checks, insert |
| `3-LLD-confirm-and-cancel.png` | Confirm and cancel: hold row lock and the order of checks |
| `4-LLD-hold-lifecycle.png` | HELD → CONFIRMED / CANCELLED / EXPIRED |
| `5-Schema-PostgreSQL.png` | The `classes` and `holds` tables |
| `6-Requirements-user-flow.png` | The Applicant and Admin flows mapped to the 8 endpoints |
| `7-Requirements-mandatory-rules.png` | The mandatory rules and the bonus items |

## Docs

- `ASSUMPTIONS.md`: a summary of every decision, then the details: schema, validation, concurrency (Bonus 1), load handling and security limits.
- `AI_USAGE.md`: which AI tools were used, how, and what they got wrong.
