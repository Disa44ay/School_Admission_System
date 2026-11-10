# Automated tests and results

**42 backend tests, all passing.** They ran three times in a row locally, and on every push in GitHub Actions inside Docker (CI run 4, commit `2ae88cb`). Frontend tests are not written yet.

## Tools

| Tool | Used for |
|---|---|
| xUnit 2.9.3 | Test framework |
| `Microsoft.AspNetCore.Mvc.Testing` 10.0.14 (`WebApplicationFactory`) | Runs the real API in memory and sends real HTTP requests to it |
| PostgreSQL 18 | Real database. Locally it's a portable install; in Docker it's `postgres:18-alpine`. Each run creates a fresh database and drops it afterwards. |
| `Task.WhenAll` | Fires many requests at the same moment |
| Docker Compose `test` profile | `docker compose --profile test run --rm backend-tests` |
| GitHub Actions | On every push: builds the images, starts the stack, checks `/health` and the frontend, then runs the tests |
| curl + `xargs -P 60` | The manual two-process check (Bonus 1) |

## Concurrency results

| Scenario | Result | API behaviour |
|---|---|---|
| 100 parallel holds, 10-seat class, 100 different students | **10 × 201, 90 × 409** | Class shows `heldSeats 10, available 0` |
| 10 parallel holds, same student, same class | **1 × 201, 9 × 409** | One active application per class (rule 3) |
| 10 parallel confirms of one hold | **10 × 200 `CONFIRMED`** | `confirmedSeats` = 1 (rule 5) |
| 10 API startups at once on an empty database | All succeed, 3 indexes created | The schema is created under an advisory lock |
| **Bonus 1 (manual):** 2 API processes (`:8080`, `:8081`), one database, 120 parallel holds on 20 seats | **20 × 201, 100 × 409** | `heldSeats 20, available 0`. No overbooking across processes. |

## Rule and validation results

| Case | Result |
|---|---|
| Create a class (name is trimmed) | 201, `c_…` id, all seats available |
| Empty, whitespace or missing name, more than 200 characters, `totalSeats` 0 or below or missing or not a number, malformed or empty JSON (11 cases) | 400 |
| Unknown class or hold | 404 |
| `X-Student-Id` missing, 16 or 18 digits, letters, a space, non-ASCII digits (7 cases × 4 endpoints) | 400 |
| Confirm or cancel someone else's hold | 403 |
| Cancel | 204. The hold reads `CANCELLED`. Cancelling or confirming it again gives 409. The student can apply again: 201. |
| Cancel a confirmed hold, or re-apply to the same class after confirming | 409 |
| Same student in two different classes | 201 both times |
| `/me/holds` | Newest first, with `className`. Empty list for a new student. |
| 1-second hold, then wait 1.3 s | Seat free right away. `GET` shows `EXPIRED`. Confirm gives 409. Another student gets the seat: 201. |
| Expiry with no request at all | The background sweeper sets `EXPIRED` within about 2 s |
| Config | `HOLD_DURATION_SECONDS` falls back to 600 when invalid. Connection-string order and `DATABASE_URL` conversion work. Pool capped at 40. |

## Bug found by the tests

The 100-request test exhausted PostgreSQL's 100 connections (`53300 too many clients`), because Npgsql's default pool is also 100. Fixed by capping each API process at 40 connections and returning 503 instead of 500 when the database is unavailable.

## Not tested automatically

- The 503 response when the connection pool stays full for the whole timeout.
- Frontend (UI) tests, which come with the UI step.
