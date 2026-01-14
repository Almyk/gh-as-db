---
description: Red-Green-Refactor TDD workflow
---

# TDD Workflow

Follow these steps for every new feature or bug fix.

1.  **Understand Requirements**: Clarify the expected behavior.
2.  **Internalize Rules**: Read `.agent/rules/tdd.md` and `.agent/rules/architecture.md`.
3.  **Create Test File**: Create a new `.test.ts` file in the `tests` directory.
4.  **Write Failing Test (RED)**:
    - Define the interface or class if not existing.
    - Write a test that fails (compile error or assertion failure).
    - Run `npm run test` to confirm it fails.
// turbo
5.  **Write Implementation (GREEN)**:
    - Write the minimal code to make the test pass.
    - Run `npm run test` until it passes.
// turbo
6.  **Refactor (REFACTOR)**:
    - Improve code structure without changing behavior.
    - Run tests again to ensure no regression.
7.  **Finalize**: Update documentation if necessary.
