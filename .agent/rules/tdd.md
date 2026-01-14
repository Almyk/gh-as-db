# Test-Driven Development (TDD) Rules

Always follow the Red-Green-Refactor cycle when implementing new features or fixing bugs.

## The Cycle

1.  **RED**: Write a failing test that defines a desired improvement or new function.
2.  **GREEN**: Produce the minimum amount of code to make the test pass.
3.  **REFACTOR**: Clean up the new code, ensuring it fits the architectural standards.

## Guidelines

- **Atomic Tests**: Each test should check one specific behavior.
- **Descriptive Names**: Test names should describe the expected behavior (e.g., `should throw error if access token is invalid`).
- **Isolation**: Use mocks for external dependencies like GitHub API.
- **Strict Mode**: Ensure tests are also fully typed.

## Examples

### Good (Atomic & Descriptive)
```typescript
test('GitHubDB.connect() should throw error if repository is not found', async () => {
  // Arrange, Act, Assert
});
```

### Bad (Generic & Multiple Assertions)
```typescript
test('test database', async () => {
  // Logic for connect, create, and delete all in one test
});
```
