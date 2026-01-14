---
description: Red-Green-Refactor TDD workflow
---

# TDD Workflow

Follow these steps for every new feature or bug fix.

1.  **Check Roadmap**: Consult `ROADMAP.md` to identify the next priority feature or task.
2.  **Understand Requirements**: Clarify the expected behavior for that specific feature.
3.  **Internalize Rules**: Read `.agent/rules/tdd.md` and `.agent/rules/architecture.md`.
4.  **Create Test File**: Create a new `.test.ts` file in the `tests` directory.
5.  **Write Failing Test (RED)**:
    - Define the interface or class if not existing.
    - Write a test that fails (compile error or assertion failure).
    - Run `npm run test` to confirm it fails.
// turbo
6.  **Write Implementation (GREEN)**:
    - Write the minimal code to make the test pass.
    - Run `npm run test` until it passes.
// turbo
7.  **Refactor (REFACTOR)**:
    - Improve code structure without changing behavior.
    - Run tests again to ensure no regression.
8.  **Update Roadmap**: Mark the implemented feature as completed in `ROADMAP.md`.
9.  **Finalize**: Update documentation if necessary.
