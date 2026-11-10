# School Admission System

First-come, first-served seat booking for school admissions. ASP.NET Core (.NET 10) API, React + Vite frontend, PostgreSQL 18.

**Status:** the design is final (schema, locking, expiry, UI flow). The API, UI and tests are not written yet.

## Run

Requires only Docker with Compose v2.

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:8080 |
| PostgreSQL | `localhost:5432` for now. The port will be closed before submission; see ASSUMPTIONS.md. |

Stop with `docker compose down`. Data survives in the `pgdata` volume. `docker compose down -v` deletes it.

## Configuration

| Variable | Where | Default |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | API | set in `docker-compose.yml` |
| `HOLD_DURATION_SECONDS` | API, from the root `.env` | `600` |
| `VITE_API_URL` | frontend build | `http://localhost:8080` |

## Tests

Not written yet. These are the planned commands; both need only Docker:

```bash
docker compose --profile test run --rm backend-tests
```

```bash
docker compose --profile test run --rm frontend-tests
```

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
