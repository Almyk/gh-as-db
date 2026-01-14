# gh-as-db

Use a private GitHub repository as a database for your application. This tool enables people to easily manage and query data stored in a GitHub repository using typical database operations.

## Features

- **GitHub-Backed Store**: Leverage GitHub's infrastructure and version control as your data storage.
- **Strictly Typed**: Built with TypeScript for full type safety.
- **Simple API**: Easy-to-use interface for CRUD operations.
- **Secure**: Designed for use with private repositories.

## Installation

```bash
npm install gh-as-db
```

## Quick Start

```typescript
import { GitHubDB } from 'gh-as-db';

const db = new GitHubDB({
  accessToken: 'YOUR_GITHUB_TOKEN',
  owner: 'your-username',
  repo: 'your-db-repo',
});

// Example usage coming soon...
```

## Why gh-as-db?

For small projects, serverless functions, or simple data storage needs, setting up a full database can be overkill. `gh-as-db` provides a familiar database-like interface while keeping your data in a repository you already control.

## Roadmap

See our [ROADMAP.md](./ROADMAP.md) for planned features and project milestones.

## License

MIT
