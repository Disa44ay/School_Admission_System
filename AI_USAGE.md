# AI usage

## How we work

The project is built step by step. A multi-agent loop checks each piece of work:

- **Claude Opus 5.5** is the manager.
- **Gemini Argon** validates decisions and coordinates the project at a high level.
- **Claude Haiku 5.5** is the worker for tasks that need no reasoning, such as file edits, boilerplate and running tests.
- **Gemini Flash 3.8** designed the project scaffold and installed the required tools and packages.

The developer writes the requirements and the database schema by hand and lists the corner cases. The AI agents then:
1. check those decisions against the brief
2. look for vulnerabilities
3. point out anything that contradicts the brief or an earlier decision.

Whenever two options conflict, the developer makes the final decision. Every decision is recorded in `decision.md`.

All agents follow a custom instruction set written by the developer:

- **Karpathy's guidelines** for generating and validating code: state assumptions, keep it simple, make surgical changes, and verify against clear goals.
- **Ponytail** to keep the code minimal and reduce token cost.
- **Hallmark** and **Unslop** skills for UI work.

The developer focuses on security and backend optimization and keeps pushing the agents to handle every corner case.

The Claude agents audited and cleaned up the scaffold that Gemini Flash 3.8 produced.

## How the automated tests were run

- The manager agent wrote the xUnit tests from the rules in `ASSUMPTIONS.md`. A rule only counted as done after a test proved it.
- The tests start the real API in memory with `WebApplicationFactory` and use a real PostgreSQL, never mocks. Each run gets a throwaway database.
- The concurrency tests use `Task.WhenAll` to send 100 holds, or 10 confirms, at the same moment.
- The full suite ran three times in a row locally to catch flaky timing. GitHub Actions then reran it inside Docker on every push.
- Bonus 1 was checked by hand: two real API processes, hit with 120 parallel `curl` requests.
- Results are in `automatedTestAndResults.md`.

## Mistakes the AI made and how they were caught

- **Connection pool too large.** The concurrency test failed with PostgreSQL's "too many clients": the default pool of 100 matched PostgreSQL's whole limit. Caught by the test suite and fixed with a cap of 40 per API process.
- **500 on malformed JSON.** In Development, ASP.NET throws on bad JSON, and the first version returned 500 instead of 400. Caught by the validation tests and fixed.

- **Wrong frontend framework.** Gemini scaffolded Next.js, but the brief requires React with Vite. Caught during the scaffold audit; the frontend was rebuilt on Vite.
- **Bloat in the scaffold.** It had unused UI components, an unrelated npm package, middleware that duplicated an ASP.NET Core built-in, and an oversized start script. Caught by reading every file. All of it was removed.
- **Code written before approval.** The manager agent implemented backend code before the developer had approved the design. The developer stopped it, the code was archived and the commit was undone. The rule now is no code without an explicit go.
- **Wrong index claim.** A planning diagram said the expiry sweeper could use the `(class_id, status, expires_at)` index. That index starts with `class_id`, so the sweeper can't use it. Caught on review and corrected.
- **Rules that would have broken the API contract.** Some early proposals needed changes to the fixed endpoints:
  - a login token
  - an admin token
  - a seat number in the hold request
  - extra endpoints for admin features.

  The contradiction check flagged each one, and the developer removed them.
