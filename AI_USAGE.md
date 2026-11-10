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

## Mistakes the AI made and how they were caught

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
