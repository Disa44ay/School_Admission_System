# Assumptions

## Summary

- **API contract unchanged.** The 8 endpoints keep their exact paths, methods, headers and request bodies. Responses may only gain fields. No endpoints are added.
- **Identity.** No login. The student types their own 17-digit birth registration number. It is saved in `localStorage` and sent as `X-Student-Id`.
- **Data.** Our own schema (the brief has none): two tables, `classes` and `holds`, plus three indexes. Seat counts are calculated on every read, never stored. A cancelled hold is a status change, never a deleted row.
- **No overbooking.** Every hold locks its class row in PostgreSQL (`FOR UPDATE`), so the check and the insert run one at a time per class, even across several API processes.
- **Expiry.** A hold stops counting the moment `expires_at` passes, because every query compares against `NOW()`. A 1-second background sweep keeps the stored status correct.
- **One application per class.** Checked inside the transaction and backed by a partial unique index. A student may apply to different classes.
- **Confirm is idempotent.** Confirming a confirmed hold returns 200 and changes nothing.
- **UI.** Applicant and Admin views. Data refreshes every 3 s. Live countdown, a seat map built from the counts, and a Bengali toast for every error.
- **Load.** One API process, a connection pool and row locks. A 503 when the pool is exhausted. No cache, no replicas, no rate limit.
- **Security.** Random hold IDs, the database port not exposed, and known limits listed below. The limits come from the brief: there is no login, so seats can be squatted and students impersonated.

The details and corner cases follow.

## Data model

The brief doesn't define a schema. This is ours:

```sql
CREATE TABLE classes (
    id          VARCHAR(64)  PRIMARY KEY,                 -- 'c_' + random GUID
    name        VARCHAR(200) NOT NULL,                    -- 'Class 6 - Morning Shift'
    total_seats INTEGER      NOT NULL CHECK (total_seats > 0),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE holds (
    id          VARCHAR(64)  PRIMARY KEY,                 -- 'h_' + random GUID
    class_id    VARCHAR(64)  NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id  CHAR(17)     NOT NULL CHECK (student_id ~ '^[0-9]{17}$'),
    status      VARCHAR(16)  NOT NULL CHECK (status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
    expires_at  TIMESTAMPTZ  NOT NULL,                    -- NOW() + HOLD_DURATION_SECONDS
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Rule 3 inside the database: at most one active hold per student per class
CREATE UNIQUE INDEX idx_holds_one_active_per_student_class
    ON holds (class_id, student_id) WHERE status IN ('HELD', 'CONFIRMED');

-- Seat counts per class (GET /classes and the place-hold check)
CREATE INDEX idx_holds_class_status_expires ON holds (class_id, status, expires_at);

-- GET /me/holds, newest first
CREATE INDEX idx_holds_student_id ON holds (student_id, created_at DESC);
```

- `classes(id, name, total_seats, created_at)`: one row per class and shift, for example "Class 6 - Morning Shift". The shift lives in `name`, because the API has no shift field.
- `holds(id, class_id, student_id, status, expires_at, created_at, updated_at)`: one row per application. `id` is the primary key, not `student_id`, because a student can apply to several classes and can re-apply after a hold expires or is cancelled.
- IDs are `VARCHAR(64)`: `c_` or `h_` followed by a random GUID. `student_id` is `CHAR(17)`, checked to be 17 digits.
- Seat counts:
  - `heldSeats` = `HELD` rows with `expires_at > NOW()`
  - `confirmedSeats` = `CONFIRMED` rows
  - `availableSeats` = `total_seats - heldSeats - confirmedSeats`

  A stored counter would be wrong between an expiry and the next sweep.
- `ON DELETE CASCADE` on `holds.class_id` never runs, because no endpoint deletes a class. `updated_at` is only for debugging.

## Validation

| Input | Result |
|---|---|
| `X-Student-Id` missing or not exactly 17 digits | 400, before any database work |
| Class name empty, only spaces, or over 200 characters; `totalSeats <= 0` | 400 |
| Unknown `classId` or `holdId` | 404 |
| Another student's hold | 403 |
| Invalid state, for example a full class or confirming an expired hold | 409 |
| Unique-index race, connection pool exhausted | 409, 503. Never 500 |

- Errors return `{ "error": "..." }`. Malformed JSON returns 400 with ASP.NET's standard problem body instead.
- `GET /classes`, `GET /classes/{id}` and `GET /holds/{id}` don't need the header.
- Names are trimmed. Duplicate names are allowed.

## Hold lifecycle

- `HOLD_DURATION_SECONDS` comes from the environment or `.env` and is read at startup. If it is missing, not a whole number, or 0 or less, the API uses 600. Changing it affects new holds only. For a quick expiry test, run `HOLD_DURATION_SECONDS=2 docker compose up`.
- `expires_at` is set to `NOW() + duration` by PostgreSQL, not by the API's clock. It is returned as ISO-8601 UTC, ending in `Z`.
- Expiry has three layers, so even a 2-second hold expires on time:
  1. Seat counts and the place-hold check ignore `HELD` rows with `expires_at <= NOW()`.
  2. `GET /holds/{id}`, `GET /me/holds`, confirm and cancel change a past-due `HELD` row to `EXPIRED` before they answer.
  3. A background job runs `UPDATE ... SET status = 'EXPIRED'` every second.
- All time checks use the PostgreSQL clock, so every API process agrees on when a hold expires.
- Confirming a confirmed hold returns 200. Confirming an expired or cancelled hold returns 409.
- Only a live `HELD` hold can be cancelled. Any other status returns 409.
- After a hold expires or is cancelled, the student can apply to that class again.

## Concurrency (Bonus 1)

**Place hold**, in one transaction:
1. `SELECT ... FROM classes WHERE id = @classId FOR UPDATE`. Other hold requests for this class, from any API process, wait here. 404 if the class doesn't exist.
2. Mark this class's past-due `HELD` rows as `EXPIRED`.
3. If the student already has a `HELD` or `CONFIRMED` hold here: 409.
4. If `HELD + CONFIRMED >= total_seats`: 409.
5. Insert with `expires_at = NOW() + duration`, then commit, which releases the lock.

The lock lives in PostgreSQL and the API keeps no state in memory, so two API processes on different ports are safe. The schema is created at startup inside `pg_advisory_xact_lock`, so processes that start together don't collide. The partial unique index `(class_id, student_id) WHERE status IN ('HELD','CONFIRMED')` backs up step 3.

**Confirm and cancel** lock the hold row with `FOR UPDATE`, then check:
1. Not found: 404.
2. Not the owner: 403.
3. Confirm only: already `CONFIRMED` returns 200.
4. `HELD` but past expiry: set `EXPIRED`, commit, return 409.
5. Any other non-`HELD` status: 409.
6. Otherwise set `CONFIRMED` (200) or `CANCELLED` (204).

Concurrent confirms wait on the row lock, so `confirmedSeats` rises only once. Confirming doesn't change `held + confirmed`, so it doesn't need the class lock.

## UI

- **TypeScript, not JavaScript.** The brief allows either. TypeScript compiles to plain JavaScript and adds type checks before the app runs. The build fails on a misspelt API field, such as `heldSeat` instead of `heldSeats`, or on a status value outside the four contract values. The build already runs `tsc`, so this costs no extra setup.

- Applicant and Admin views are a UI switch; the API doesn't check roles. Every page load opens on the Parent view, and the choice isn't remembered, so parents never land on the admin form. The Admin view holds the class creation form. The ID bar stays at the top in both views.
- The ID field is always editable. The moment it holds a valid 17-digit number, that number becomes active and is saved. A wrong character or more than 17 digits shows an inline error at once. A number that's too short shows its error when the field loses focus.
- When an ID is entered, and on every page load, the UI calls `GET /me/holds`.
- Seat counts and "My applications" refresh every 3 s.
- The countdown runs against the server's `expiresAt`. A wrong browser clock shifts the timer, but the server still rejects a late confirm with 409.
- Each class shows a seat map with one box per seat: Free, Pending (held) or Occupied (confirmed). It is drawn from the counts, so boxes can't be clicked.
- Bangla is the default, and a switch changes to English. In Bangla mode every word is Bangla, so section titles are fully Bangla: "শ্রেণি তৈরি" and "শ্রেণির তালিকা" rather than the brief's mixed "Class তৈরি" and "Class তালিকা". The three buttons keep the brief's exact labels: আবেদন করুন, ভর্তি ফি দিন and বাতিল. Digits stay 0–9. Class names show exactly as stored.
- The admin picks a class (1–10) and a shift (Morning or Day), and the UI sends the name as `Class {n} - {shift} Shift`.
- Action results show as toasts and field errors show inline. While the server is unreachable, a banner stays at the top and the last data stays visible. Details: `planning/UI-UX-decisions.md`.
- Buttons are disabled while their request runs, so a double-click sends one request.

## Handling 1000 users at once

1. Requests wait for a free connection from the pool. Each API process uses at most 40 connections, unless the connection string sets `Maximum Pool Size`. PostgreSQL allows 100 by default, so two processes (Bonus 1) still leave room for admin connections.
2. `GET /classes` is one indexed query. 1000 browsers polling every 3 s is about 330 reads per second.
3. Holds for one class run one at a time on the class lock, a few milliseconds each. Different classes run in parallel.
4. When no connection frees up before the timeout: 503 and a "server busy" toast.

These figures are estimates. A load test with 1000 parallel clients will check them.

## Security and known limits

- **Seat squatting.** The API checks only the ID's format and allows one active seat per student per class. It has no per-IP rate limit, because the brief forbids login and its tests fire hundreds of parallel requests from one machine.
  - In production, a script cycling random IDs every 10 minutes would be stopped by:
    - a BRIS check of the birth registration number, plus an OTP to the guardian
    - a cap on active holds per student across all classes
    - edge rate limits, such as Turnstile or a per-IP token bucket, with a cooldown after repeated unpaid holds.
- **IDs.** `c_{Guid.NewGuid():N}` and `h_{Guid.NewGuid():N}`. `GET /holds/{id}` needs no header, so sequential IDs would let anyone read every hold.
- **Database.** No host port is published. The API reaches it over Docker's internal network. Inspect it with `docker compose exec db psql -U postgres -d school_admission`.
- **No authentication.** Anyone who knows a student's number can see, confirm or cancel that student's holds. The Admin view is open to anyone. The contract has no field for a secret, so this stays a known limit.

## Infrastructure

- CORS allows any origin. There are no cookies or logins to protect.
- Every setting in `docker-compose.yml` has a `${VAR:-default}` fallback. A fresh clone runs with no `.env` file. To override a setting, use a `.env` file (see `.env.example`) or the command line. `.env` is never committed.
- The API reads its database connection from the first of these that is set:
  1. `DATABASE_CONNECTION_STRING`
  2. `DATABASE_URL`, in `postgres://user:pass@host:port/db` form, converted to a connection string
  3. `ConnectionStrings__DefaultConnection`
  4. a default pointing at the compose `db` service.
- The frontend's API URL is `VITE_API_BASE_URL`, then `VITE_API_URL`, then `http://localhost:8080`. Vite builds these values into the files, so they must be set at build time: `docker compose build` reads them from the environment. Compose also sets them on the running web container, but there they have no effect.
- Database credentials are development values (`postgres`/`postgres`).
- Data lives in the `pgdata` volume. It survives `docker compose down`; `docker compose down -v` deletes it.
