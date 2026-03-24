# AGENTS.md — Coding Agent Guidelines

Read this file before making any changes to this repository.

## Golden Rules

- **NEVER delete** existing interfaces, exported functions, or tests unless the task explicitly says to.
- **Tasks are ADDITIVE by default** — add code, do not remove existing code.
- If you think something should be refactored, add a code comment or open a new ticket — do not refactor inline.
- Keep changes **minimal and scoped** to the task description. Do not touch files unrelated to the task.

## Before You Start

1. Read the task description carefully.
2. Run `npm test` to confirm the baseline is green before touching anything.
3. Only modify files mentioned in the task (or directly required by the feature).

## TypeScript / Import Safety

- Always verify imports are valid: check `node_modules/` or `package.json` exports before changing import paths.
- Do not introduce new dependencies without adding them to `package.json`.
- If a type is imported but not used, remove only the import — not the source type/interface.

## Testing

- Run `npm test` before committing.
- All existing tests must remain passing. Never delete or weaken a test to make it pass.
- Add new tests for new functionality.

## Committing

- Commit message format: `[AA-{n}] {task title}`
- One logical commit per task.
- Push to `main` directly (no branches needed for this project).

## What NOT to Do

- Do not delete `ProjectConfig`, `AnimationConfig`, `SpriteSheetConfig`, or any other exported interface.
- Do not remove test cases from existing test files.
- Do not change file locations unless the task explicitly asks for it.
- Do not run destructive shell commands (`rm -rf`, etc.) without explicit instruction.
