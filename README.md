# School Admission System

First-come, first-served seat booking for school admissions. ASP.NET Core (.NET 10) API, React + Vite frontend, PostgreSQL 18.

**Status:** feature-complete. All 8 endpoints work. The bilingual UI (Bangla by default, English switch) is at http://localhost:5173. 44 backend tests and 18 frontend tests pass in Docker, and a 15-step Playwright end-to-end check passes.

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

CI (GitHub Actions) runs on every push. It builds the images, starts the stack, checks both URLs and runs the backend and frontend tests.

Stop with `docker compose down`. Data survives in the `pgdata` volume. `docker compose down -v` deletes it.

## Using the UI

The UI opens in Bangla on the **অভিভাবক** (Parent) view. **EN** switches to English.

- **Parent:**
  1. Type the 17-digit birth registration number at the top. Bangla digits work too. The field stops at 17 characters. The number is saved in the browser and used as soon as it's valid.
     - **"আমার আবেদন" (My applications):** live holds, plus the 3 newest past applications. "আরও দেখুন" (See more) shows the rest.
  2. Press **আবেদন করুন** (Apply) on a class to hold a seat.
  3. The admission slip shows a live countdown, with **ভর্তি ফি দিন** (Pay) and **বাতিল** (Cancel).
  4. At 0 the hold shows **মেয়াদ উত্তীর্ণ** (Expired) and the seat frees, with no reload.
- **অ্যাডমিন (Admin):** pick a class (1–10), a shift and the number of seats to create a class. A checkbox switches to a custom English name. Class names must be unique, ignoring case: the form blocks a duplicate, and the API returns 409. The table shows total, held, confirmed and available seats for every class.
- **Opening Admin logs the student out.** There is no logout button, so switching to Admin clears the student number and the Parent view starts fresh. A note under the switch says so.
- Seat counts refresh every 3 seconds.
- If the server can't be reached, a banner says so and the last data stays on screen.

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

Frontend tests (Vitest + React Testing Library, jsdom):

```bash
docker compose --profile test run --rm frontend-tests
```

End-to-end browser check (Playwright, against the running stack; optional, needs Python with `playwright` and Chromium installed):

```bash
HOLD_DURATION_SECONDS=15 docker compose up -d --build
```

```bash
python -X utf8 e2e/ui_e2e.py
```

Results and screenshots are in `automatedTestAndResults.md` and `e2e/screenshots/`.

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
- `automatedTestAndResults.md`: every test suite, the tools used, the concurrency results, and the UI/UX checks and their results.
- `planning/UI-UX-decisions.md`: how the UI was planned. It records the requirements, the research, each decision with its reason, and the Hallmark design review.
- `e2e/`: the Playwright end-to-end script and its screenshots.
