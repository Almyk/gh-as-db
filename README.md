# gh-as-db

[![NPM Version](https://img.shields.io/npm/v/gh-as-db.svg)](https://www.npmjs.com/package/gh-as-db)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Use a private GitHub repository as a database for your application. `gh-as-db` provides a familiar database-like interface (CRUD, filtering, sorting, pagination) while leveraging GitHub's infrastructure for versioned data storage.

## Features

- 📂 **GitHub-Backed**: Your data lives in JSON files within a GitHub repository.
- 🔐 **Secure**: Designed for private repositories using Personal Access Tokens (PAT).
- 🚀 **Performance**: Built-in in-memory caching and auto-indexing for fast local queries.
- 🛡️ **Concurrency**: Optimistic locking using Git SHAs to prevent data loss.
- 🧩 **Middleware**: Extensible hooks for data validation or transformation.
- ⌨️ **CLI Tool**: Initialize and manage your "database" from the terminal.
- 📦 **TypeScript**: Fully typed for a great developer experience.

## Installation

```bash
npm install gh-as-db
```

## Quick Start

```typescript
import { GitHubDB } from 'gh-as-db';

interface User {
  id: string;
  name: string;
  email: string;
}

const db = new GitHubDB({
  accessToken: process.env.GITHUB_TOKEN,
  owner: 'your-username',
  repo: 'my-data-repo',
});

// Access the 'users' collection
const users = db.collection<User>('users');

// Create a new user
await users.create({
  id: '1',
  name: 'John Doe',
  email: 'john@example.com'
});

// Find a user by ID
const user = await users.findById('1');
console.log(user?.name); // 'John Doe'

// Query with filters
const results = await users.find({
  filters: [
    { field: 'name', operator: 'eq', value: 'John Doe' }
  ]
});
```

## API Reference

### `GitHubDB`

The entry point for linking to your GitHub repository.

```typescript
const db = new GitHubDB({
  accessToken: string; // GitHub PAT with 'repo' scope
  owner: string;       // Repository owner
  repo: string;        // Repository name
  cacheTTL?: number;   // Optional: Cache TTL in ms. Default is 0 (strict consistency).
});
```

### `Collection<T>`

Methods for interacting with your data collections (JSON files).

#### `create(item: T): Promise<T>`
Inserts a new item. If the file doesn't exist, it creates it.

#### `find(options?: QueryOptions<T> | ((item: T) => boolean)): Promise<T[]>`
Fetches items based on a query object or a predicate function.

#### `findById(id: string): Promise<T | null>`
Helper to find a single item by its `id` field.

#### `update(id: string, updates: Partial<T>): Promise<T>`
Updates an existing item. Throws if the item is not found.

#### `delete(id: string): Promise<void>`
Removes an item by its ID.

### Querying

`gh-as-db` supports advanced querying including filtering, sorting, and pagination.

```typescript
const items = await users.find({
  filters: [
    { field: 'age', operator: 'gte', value: 18 },
    { field: 'status', operator: 'eq', value: 'active' }
  ],
  sort: [
    { field: 'name', order: 'asc' }
  ],
  pagination: {
    limit: 10,
    offset: 0
  }
});
```

**Supported Operators**: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `in`.

### Middleware

You can attach middleware to intercept operations.

```typescript
const users = db.collection<User>('users', {
  middleware: [{
    beforeSave: async (item, context) => {
      console.log(`Saving to ${context.collection}...`);
      return { ...item, updatedAt: new Date().toISOString() };
    }
  }]
});
```

## CLI Usage

`gh-as-db` comes with a CLI tool to help you manage your repository.

```bash
# Initialize a new repository
npx gh-as-db init

# List all collections
npx gh-as-db list

# Inspect a specific collection
npx gh-as-db inspect <collection-name>
```

## Why gh-as-db?

For small projects, side-projects, or internal tools, setting up a database server (PostgreSQL, MongoDB) is often overkill. `gh-as-db` gives you:
1. **Zero Cost**: GitHub's free tier for private repos is enough for many use cases.
2. **Versioned Data**: Every change is a commit. You can see history and revert easily.
3. **Collaboration**: Use GitHub's own UI to edit data in a pinch.

## Performance

- **Consistent Caching**: Uses **Conditional GET** (`If-None-Match`) to ensure data is always up-to-date even across multiple instances (e.g., serverless), while minimizing API costs.
- **Write-Through**: Updates the local cache immediately after a write, preventing 404s during redirects.
- **Indexing**: Automatic in-memory indexing on all fields makes querying fast even as data grows.
- **Optimistic Concurrency**: Uses Git SHAs to ensure that you don't overwrite changes made by another client.

## License

MIT
