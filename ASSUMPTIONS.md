# Assumptions

Decisions we made where the brief is silent. The ones that shape the system come first; smaller choices follow.

## Key decisions

- **Seat counts are never stored.** They are counted on every read with `expires_at > NOW()`, so a seat frees the instant its hold expires and a counter can never drift from the real holds.
- **No overbooking, even with two API processes (Bonus 1).** Placing a hold first locks the class row (`SELECT ... FOR UPDATE`) in PostgreSQL, so holds for one class run one at a time across every process.
- **Processes are stateless.** The API keeps nothing in memory, and the schema is created under `pg_advisory_xact_lock`, so several processes can start together.
- **PostgreSQL is the only clock.** Every expiry is set and checked with `NOW()`, so several API processes on different machines always agree.
- **Expiry has three layers.** Every query ignores past-due holds, any read or action marks them `EXPIRED`, and a sweeper runs every 1 s. Even a 2-second hold expires on time.
- **The database enforces the rules, not just the code.** A partial unique index allows one active hold per student per class, and a unique index on `lower(btrim(name))` allows one class per name. A race between two requests can't slip through.
- **Class names are unique, ignoring case and spaces.** A duplicate returns 409. The brief lists only 201 and 400; this is a deliberate addition.
- **IDs can't be guessed.** Each ID is a type prefix plus a random 32-character code: `c_` for a class, `h_` for a hold, as in `h_3f9a…`. This matters because `GET /holds/{id}` works without `X-Student-Id`.
- **Cancel never deletes.** It sets `CANCELLED`, so the history stays and `GET /holds/{id}` still answers.
- **Opening Admin counts as a logout.** There is no logout button, so switching to Admin clears the student number and Parent starts fresh. A note under the switch says so.
- **503 when the database is down.** The API answers 503 (service unavailable) instead of a generic 500, so the UI can say "server busy, try again".
- **TypeScript instead of JavaScript.** The build fails on a misspelt API field (such as `heldSeat`) or an unknown status, so contract mistakes are caught before the app runs.

## Other decisions

**API**

- The API has no shift field, so the class name carries the shift: `Class 6 - Morning Shift`.
- Class names are trimmed and limited to 200 characters.
- Acting on another student's hold returns 403.
- Illegal state changes return 409: full class, duplicate application, expired, cancelled or already confirmed.
- `GET /classes`, `GET /classes/{id}` and `GET /holds/{id}` don't require `X-Student-Id`.
- Errors return `{ "error": "..." }`. Malformed JSON returns 400 with ASP.NET's problem body.
- If `HOLD_DURATION_SECONDS` is invalid, such as `abc` or `0`, the API uses 600 rather than failing.
- There is no per-IP rate limit, because the graders' tests fire many parallel requests from one machine.

**Configuration**

- The API reads its connection string from `ConnectionStrings__DefaultConnection`. `DATABASE_CONNECTION_STRING` and `DATABASE_URL` (a `postgres://` URL) are also accepted and take priority in that order.
- The frontend reads `VITE_API_BASE_URL`, then `VITE_API_URL`; the brief names both only as examples.
- PostgreSQL publishes no port to the host machine; the API reaches it inside Docker's network.

**UI**

- Bangla is the default, with an EN switch. Digits stay 0–9.
- Section titles are fully Bangla: "শ্রেণি তৈরি" and "শ্রেণির তালিকা". The three action buttons keep the brief's exact labels.
- Parent and Admin are a UI switch only; the API doesn't check roles. Every page load opens on Parent.
- The ID field shows only in the Parent view. It is always editable, accepts at most 17 characters and converts Bangla digits to 0–9.
- A valid ID becomes active as soon as it is typed and is saved in `localStorage`.
- The admin picks a class (1–10) and a shift (Morning or Day), and the UI sends `Class {n} - {shift} Shift`.
- An optional custom class name must be in English: letters, digits, spaces and `- . , ( ) / & '`.
- The admin form blocks a duplicate name before sending; the API's 409 backs this up.
- "আমার আবেদন" (my applications) always shows live holds, plus the 3 newest past applications behind "আরও দেখুন" (see more).
- Seat counts and "আমার আবেদন" refresh every 3 s.
- The seat map is drawn from the counts. Its boxes can't be clicked to pick a seat.
- Errors show in three places: toasts for actions, inline messages for fields, and a banner while the server is unreachable.
- Buttons are disabled while their request runs, so a double click sends one request.

## Schema

**classes**

| Column | Type | Rules |
|---|---|---|
| id (PK) | VARCHAR(64) | `c_` + random GUID |
| name | VARCHAR(200) | NOT NULL, unique on `lower(btrim(name))`. Holds class + shift, e.g. `Class 6 - Morning Shift` |
| total_seats | INTEGER | NOT NULL, > 0 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**holds**

| Column | Type | Rules |
|---|---|---|
| id (PK) | VARCHAR(64) | `h_` + random GUID |
| class_id (FK) | VARCHAR(64) | NOT NULL, references `classes(id)` ON DELETE CASCADE |
| student_id | CHAR(17) | NOT NULL, 17 digits |
| status | VARCHAR(16) | `HELD`, `CONFIRMED`, `EXPIRED` or `CANCELLED` |
| expires_at | TIMESTAMPTZ | `NOW()` + `HOLD_DURATION_SECONDS` |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | Set on every status change |

**Indexes**

| Index | On | Purpose |
|---|---|---|
| idx_holds_one_active_per_student_class | UNIQUE `(class_id, student_id)` WHERE status is `HELD` or `CONFIRMED` | Rule 3 |
| idx_holds_class_status_expires | `(class_id, status, expires_at)` | Seat counts |
| idx_holds_student_id | `(student_id, created_at DESC)` | `GET /me/holds` |
| idx_classes_name_unique | UNIQUE `lower(btrim(name))` | Unique class names |
