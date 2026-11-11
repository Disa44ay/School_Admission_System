# AI usage

The developer made every decision. AI was used as a tool to review, implement and test.

## Models

| Model | Used for |
|---|---|
| Claude Opus 5.5 | Reviewing the developer's design, finding contradictions, writing code and tests |
| Claude Haiku 5.5 | File edits, boilerplate and running tests |
| Gemini Argon | Second review of decisions and keeping the plan on track |
| Gemini Flash 3.8 | First project scaffold and tool and package installation |

## Workflow

1. **Developer:** wrote the requirements, designed the schema and listed the corner cases.
2. **AI:** reviewed them against the brief and reported contradictions and risks.
3. **Developer:** evaluated each finding, fixed the design and decided the flow.
4. **AI:** implemented the code in the structure the developer specified.
5. **Developer:** reviewed and tested by hand, and reported bugs and UI issues.
6. **AI:** fixed them and added tests for each fix.
7. **Developer:** reviewed and tested again. Pushed only after all tests passed.

## Instructions and skills

- **Rules:** a custom instruction set from the developer, based on Karpathy's guidelines plus Ponytail, keeps changes minimal and verified.
- **UI:** Hallmark (design review and its `sloplint` linter) and Humanizer/Unslop (wording).
- **Planning:** the Grilling skill was used for the UI plan, recorded in `planning/UI-UX-decisions.md`.
- **Testing:** the webapp-testing skill (Playwright) drove the end-to-end UI test in `e2e/`.

## Where AI was wrong, and how it was caught

- **Wrong framework.** The scaffold used Next.js, not Vite. Caught by the developer's audit; rebuilt on Vite.
- **Code before approval.** Backend code was written before the design was approved. The developer stopped it; the code was archived and the commit undone.
- **Broken API contract.** Early proposals (login token, admin token, extra endpoints) would have changed the fixed contract. Caught in review and dropped by the developer.
- **Pool too large.** The connection pool matched PostgreSQL's whole limit. Caught by the concurrency test; capped at 40.
- **500 on bad JSON.** Malformed JSON returned 500 instead of 400. Caught by the validation tests.
- **Expired slip vanished.** At 0 the slip disappeared instead of showing `EXPIRED`. Caught by the countdown test.
- **Frontend URL ignored.** Setting only `VITE_API_URL` had no effect. Caught by the developer's environment-variable check.
- **Duplicate classes and logout.** Duplicate class names were allowed, and switching views didn't log the student out. Both caught in the developer's manual testing.

Test details and results are in `automatedTestAndResults.md`.
