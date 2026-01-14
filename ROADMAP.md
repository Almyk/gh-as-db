# Roadmap - gh-as-db

This document outlines the planned features and milestones for `gh-as-db`.

## Phase 1: Core Functionality (Current Focus)
- [x] **Connection Management**: Robust connection to GitHub repositories via Personal Access Tokens.
- [x] **Schema Definition**: Basic TypeScript-based schema definitions for "tables" (JSON files).
- [x] **CRUD Operations**:
    - [x] `create`: Insert new records into a JSON collection.
    - [x] `read`: Fetch records by ID or list all.
    - [x] `update`: Modify existing records.
    - [x] `delete`: Remove records from a collection.

## Phase 2: Advanced Querying
- [x] **Filtering**: Support for basic predicates (equality, comparison).
- [x] **Sorting**: Sort results by one or more fields.
- [x] **Pagination**: Efficiently handle large collections.

## Phase 3: Developer Experience & Performance
- [x] **Caching Layer**: In-memory caching to reduce GitHub API calls.
- [x] **Auto-indexing**: Simple indexing for faster local querying.
- [x] **CLI Tool**: A command-line utility for initializing repos, managing collections, and inspecting data.

## Phase 4: Production Readiness
- [x] **Transaction Support**: Optimistic concurrency control using Git SHAs.
- [x] **Middleware Support**: Hooks for data validation or transformation.
- [x] **Improve Tests**: Add more tests and improve test coverage.
- [x] **Improve Performance**: Optimize performance and reduce memory usage via conditional GET caching.
- [ ] **Improve Error Handling**: Add more error handling and improve error messages.
- [ ] **Improve Logging**: Add more logging and improve logging messages.
- [x] **Improve Documentation**: Add more documentation and improve documentation.
- [x] **Comprehensive Documentation**: Detailed API reference and tutorials.

## Phase 5: Release
- [x] **Publish to NPM**: Initial 1.0.0 release on NPM.

## Phase 6: Production Hardening & Scalability
- [x] **Batching & Transactions**: Implement a `transaction` API to group multiple operations into a single Git commit using the low-level Git Data API.
- [x] **Sharding (One-File-Per-Document)**: Add a storage strategy option to store items as individual files to prevent "JSON bloat" and improve scalability.
- [x] **Generic Schema Validation**: First-class support for pluggable validation (Zod, Valibot, etc.) for runtime safety.
- [x] **Edge Compatibility Auditing**: Ensure the library and its dependencies are fully compatible with Vercel Edge and Cloudflare Workers (removing Node-only dependencies).

## Phase 7: Advanced Git DB Features
- [ ] **History API**: Methods to retrieve the version history of specific documents or collections.
- [ ] **Audit/Blame**: Expose metadata about who made changes and when, leveraging Git commit history.
- [ ] **Relationships & Populating**: Simple implementation of `populate` to handle relations between collections.

---

*Note: This roadmap is subject to change as the project evolves.*
