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
- [ ] **Comprehensive Documentation**: Detailed API reference and tutorials.

---

*Note: This roadmap is subject to change as the project evolves.*
