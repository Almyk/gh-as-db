# Architectural Guidelines

Ensure the project maintains a clean and maintainable structure.

## Principles

1.  **SOLID**: Apply the five principles of object-oriented design.
2.  **Clean Architecture**: Separate business logic from external frameworks and APIs.
3.  **Type Safety**: No `any` types. Utilize interfaces and generics.
4.  **Error Handling**: Use custom Error classes for domain-specific errors.

## Folder Structure

- `/src`: Implementation code.
    - `/core`: Domain logic and interfaces.
    - `/infrastructure`: External API implementations (GitHub client).
    - `/ui`: Public API surface.
- `/tests`: All test files.

## Examples

### Good (Separation of Concerns)
```typescript
interface IStorageProvider {
  read(path: string): Promise<string>;
}

class GitHubProvider implements IStorageProvider {
  // Implementation details
}
```

### Bad (Coupled Logic)
```typescript
class GitHubDB {
  async getData() {
    // Octokit logic mixed with business logic
  }
}
```
