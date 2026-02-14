# gh-as-db

[![NPM Version](https://img.shields.io/npm/v/gh-as-db.svg)](https://www.npmjs.com/package/gh-as-db)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Use a private GitHub repository as a database for your application. `gh-as-db` provides a familiar database-like interface (CRUD, filtering, sorting, pagination) while leveraging GitHub's infrastructure for versioned data storage.

## Features

- 📂 **GitHub-Backed**: Your data lives in JSON files within a GitHub repository.
- 🔐 **Secure**: Designed for private repositories using Personal Access Tokens (PAT).
- 🚀 **Performance**: Built-in in-memory caching and auto-indexing for fast local queries.
- 🛡️ **Concurrency**: Optimistic locking using Git SHAs to prevent data loss.
- 🔄 **Retry & Rate Limits**: Automatic retries with exponential backoff for transient errors and GitHub rate limits.
- 🔗 **Transactions**: Group multiple operations into a single atomic Git commit.
- 📁 **Sharding**: One-file-per-document storage strategy for massive collections.
- 🧩 **Middleware**: Extensible hooks for data validation or transformation.
- 🔀 **Validation**: Pluggable schema validation support (Zod, etc.).
- 🌐 **Edge Ready**: Fully compatible with Vercel Edge and Cloudflare Workers.
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

// Use Transactions for atomic multi-collection updates
await db.transaction(async (tx) => {
  const usersTx = tx.collection('users');
  const logsTx = tx.collection('logs');
  
  await usersTx.update('1', { name: 'Updated Name' });
  await logsTx.create({ id: 'log-1', action: 'Update user' });
}, 'Atomic update of user and logs');
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
  retry?: RetryConfig | false; // Optional: Retry config, or false to disable. See below.
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

### Schema Validation

You can use any validation library (Zod, Valibot, etc.) by providing a `validator` object.

```typescript
import { z } from 'zod';

const userSchema = z.object({
  id: z.string(),
  name: z.string().min(3),
  email: z.string().email(),
});

const users = db.collection<User>('users', {
  validator: {
    validate: (data) => userSchema.parseAsync(data),
  }
});
```

### Transactions & Batching

Transactions allow you to group multiple operations across different collections into a **single Git commit**. This reduces API calls and ensures that either all operations succeed or none are committed.

```typescript
const commitSha = await db.transaction(async (tx) => {
  const posts = tx.collection('posts');
  const count = tx.collection('stats');

  await posts.create({ id: 'p1', title: 'New Post' });
  await count.update('total', { value: 101 });
}, 'Create post and increment counter');
```

### Storage Strategies (Sharding)

By default, `gh-as-db` stores the entire collection in a single JSON file (`name.json`). For large collections, you can use the `sharded` strategy, which stores **one file per document** (`name/id.json`).

```typescript
const users = db.collection<User>('users', {
  strategy: 'sharded'
});
```

**Why use Sharding?**
- 🚀 **Performance**: `findById` reads only the specific file, which is much faster than loading a massive JSON array.
- 📈 **Scalability**: Avoids GitHub's file size limits and reduces merge conflicts.
- 🧹 **Cleanliness**: Better organization for repositories with thousands of documents.

### Retry & Rate Limit Handling

All GitHub API calls are automatically retried on transient errors (429 rate limits, 500/502/503 server errors) with exponential backoff. If GitHub returns a `Retry-After` header, it is respected.

```typescript
const db = new GitHubDB({
  accessToken: process.env.GITHUB_TOKEN,
  owner: 'your-username',
  repo: 'my-data-repo',
  retry: {
    maxRetries: 3,   // Default: 3
    baseDelay: 1000, // Default: 1000ms
    maxDelay: 10000, // Default: 10000ms
  }
});
```

To disable retries entirely:

```typescript
const db = new GitHubDB({
  // ...
  retry: false,
});
```

Non-transient errors (401, 403, 404) are thrown immediately without retrying. Concurrency conflicts (409) still throw `ConcurrencyError` immediately. If rate limit retries are exhausted, a `RateLimitError` is thrown.

```typescript
import { RateLimitError, ConcurrencyError } from 'gh-as-db';

try {
  await users.create({ id: '1', name: 'Alice' });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Rate limited, retry after:', error.retryAfter);
  }
  if (error instanceof ConcurrencyError) {
    console.log('Conflict, re-read and retry');
  }
}
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
- **Automatic Retries**: Transient failures and rate limits are handled transparently with exponential backoff.

## License

MIT
