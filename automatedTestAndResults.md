# Automated tests and results

**44 backend tests, all passing.** They ran three times in a row locally, and on every push in GitHub Actions inside Docker. **The final check before the last commit** ran on a clean `docker compose build --no-cache`: the stack came up healthy, the backend passed 44/44 (all 5 concurrency tests included), the frontend passed 18/18, and the Bonus 1 two-container run passed (below). **18 frontend tests, all passing** (Vitest + React Testing Library, jsdom). **A 15-step end-to-end browser check passes** (Playwright, run with the webapp-testing skill against the Docker stack). Inside Docker, the backend and frontend suites pass 44/44 and 18/18. The end-to-end check passes 15/15.

## Frontend tests (Bonus 2)

| Area | What is checked |
|---|---|
| Rendering | Classes and seat counts appear in Bangla by default. Without an ID, "আবেদন করুন" is disabled and a hint explains why. The switch changes every label to English and back. |
| No stray English | In Bangla mode the rendered page contains no Latin letters, except class names and the "EN" switch. English and Bangla have exactly the same string keys, and no string is empty. |
| 17-digit ID | 16 digits, 18 digits and letters are rejected inline. Bangla digits are accepted and converted. The ID is saved in `localStorage` and sent as `X-Student-Id` after a reload. |
| Countdown | With fake timers, a 2-second hold counts down, then shows মেয়াদ উত্তীর্ণ ("expired") and disables "ভর্তি ফি দিন", with no reload. |
| Start view, logout, history | Every load opens on the Parent view. Opening Admin logs the student out, and Parent starts with an empty ID. Past applications show the newest 3, with "See more" and "See less". |
| ID field | Bangla placeholder, at most 17 characters, hidden in the Admin view. |
| Admin class names | The form blocks a class + shift that already exists without calling the API. A custom name must be English, and a duplicate is caught regardless of case. An API 409 shows as a readable message. |
| Errors | When the server is unreachable, a banner and an error notice appear instead of a blank page. A 409 shows "আসন খালি নেই" ("no seats free"). The admin form validates inline before calling the API. |

`fetch` is stubbed in these tests. One more test checks that every page load opens on the Parent view.

## UI/UX checks

| Check | Tool | Result |
|---|---|---|
| Design rules: tokens, focus rings, reduced motion, no sideways scroll, no generic "AI slop" patterns, control states | Hallmark `sloplint --scope app` | **0 FAIL, 0 REFLEX, 0 WARN**. The first run flagged missing `:active`/`:disabled` CSS states, unthemed browser surfaces (selection, caret and scrollbar colours) and a missing meta description. All three were fixed. |
| Accessibility names | Browser accessibility tree | The admin form's controls had no proper names. Fixed with `<label for>`. |
| Manual walk-through, real API, 20-second holds | Claude's browser pane | Apply, the slip and row timer, expiry with no reload, pay, the English switch, admin create, and a 375 px phone. All worked. |
| Full Hallmark audit, render tier (1280, 1440 and 1920 px; 375 px full page) | `sloplint --render --scope app` plus a judged read of the screenshots | Before: 1 FAIL (field borders under 3:1 contrast) and 1 WARN (the accent covered 5.5% of the screen, from 20 solid green apply buttons). Then 1 FAIL (an apply label wrapped at 768 px). Fixed: a 3.29:1 field edge, outlined row buttons with a neutral disabled state, labels kept on one line. The judged read also fixed: four numbers in one row on a phone (the page went from 5,925 to 4,313 px), the hint no longer in the 'held' amber, and the logout note at 14 px. **After: 0 FAIL, 0 REFLEX, 0 WARN.** |
| Automated walk-through, Docker stack, 15-second holds | Playwright through the webapp-testing skill | **15/15**, below |

## End-to-end browser check (Playwright, headless Chromium)

- **Script:** [`e2e/ui_e2e.py`](e2e/ui_e2e.py).
- **Screenshots** from the last run, in `e2e/screenshots/`:
  - `1-admin.png`: the admin view after creating a class
  - `2-slip.png`: the slip and its countdown
  - `3-expired.png`: the hold expired and the seat freed
  - `4-mobile.png`: the 375 px phone layout.

To run it:

```bash
HOLD_DURATION_SECONDS=15 docker compose up -d --build
```

```bash
python -X utf8 e2e/ui_e2e.py
```

It needs `pip install playwright` and `playwright install chromium` first.

The real Docker stack ran with `HOLD_DURATION_SECONDS=15`. Result: **15/15 passed, no console errors.** Since class names became unique, the run creates its own uniquely named class through the custom-name option. It also checks that the same name in another letter case is blocked inline.

1. The page opens on the Parent view, in Bangla.
2. The admin creates a 2-seat class with a custom name, and a toast confirms it. Creating the same name again in capitals is blocked inline.
3. Without an ID, the apply button is disabled.
4. Letters in the ID show an inline error at once.
5. A valid ID clears the error and enables apply.
6. A hold shows the slip and its countdown.
7. The class row shows the timer and the held count.
8. A reload keeps the ID and the slip, and stays on Parent.
9. At 0 the hold shows মেয়াদ উত্তীর্ণ ("expired") and the seat frees, with no reload.
10. Paying confirms the seat.
11. A second parent takes the last seat.
12. A third parent sees "আসন নেই" ("no seats").
13. The English switch works.
14. At 375 px wide the page doesn't scroll sideways.

This run also found one usability bug. Toasts stacked up and covered the class list on a phone, so now only the newest toast shows.

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
| 10 parallel creates of one class name | **1 × 201, 9 × 409** | The unique index makes exactly one class |
| 10 API startups at once on an empty database | All succeed, 3 indexes created | The schema is created under an advisory lock |
| **Bonus 1 (manual):** 2 API processes (`:8080`, `:8081`), one database, 120 parallel holds on 20 seats | **20 × 201, 100 × 409** | `heldSeats 20, available 0`. No overbooking across processes. |
| **Bonus 1 in Docker (final check):** a second API container (`docker compose run -p 8081:8080 api`) next to the main one, one database, 120 parallel holds on 20 seats | **20 × 201, 100 × 409** | `heldSeats 20, available 0` |

## Rule and validation results

| Case | Result |
|---|---|
| Create a class (name is trimmed) | 201, `c_…` id, all seats available |
| Empty, whitespace or missing name, more than 200 characters, `totalSeats` 0 or below or missing or not a number, malformed or empty JSON (11 cases) | 400 |
| Duplicate class name, also in different case or with extra spaces | 409 |
| 10 parallel creates with the same name | 1 × 201, 9 × 409 |
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
