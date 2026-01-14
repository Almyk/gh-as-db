export interface GitHubDBConfig {
  accessToken: string;
  owner: string;
  repo: string;
  branch?: string;
  cacheTTL?: number;
}

export type Schema = Record<string, any>;

export type MiddlewareOperation = "create" | "update" | "read" | "delete";

export interface MiddlewareContext {
  collection: string;
  operation: MiddlewareOperation;
}

export interface Middleware<T extends Schema> {
  beforeSave?: (item: T, context: MiddlewareContext) => Promise<T> | T;
  afterRead?: (item: T, context: MiddlewareContext) => Promise<T> | T;
}

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "in";

export interface FilterPredicate<T> {
  field: keyof T;
  operator: FilterOperator;
  value: any;
}

export type SortOrder = "asc" | "desc";

export interface SortOptions<T> {
  field: keyof T;
  order: SortOrder;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface QueryOptions<T> {
  filters?: FilterPredicate<T>[];
  sort?: SortOptions<T>[];
  pagination?: PaginationOptions;
}

export class ConcurrencyError extends Error {
  constructor(public readonly path: string) {
    super(`Concurrency conflict at ${path}. The remote data has changed.`);
    this.name = "ConcurrencyError";
  }
}

export interface StorageResponse<T> {
  data: T;
  sha: string;
}

export interface Validator<T> {
  validate: (data: unknown) => Promise<T> | T;
}

export interface CommitChange {
  path: string;
  content: any;
}

export type StorageStrategy = "single-file" | "sharded";

export interface IStorageProvider {
  testConnection(): Promise<boolean>;
  exists(path: string): Promise<boolean>;
  readJson<T>(path: string): Promise<StorageResponse<T>>;
  writeJson<T>(
    path: string,
    content: T,
    message: string,
    sha?: string
  ): Promise<string>;
  deleteFile(path: string, message: string, sha: string): Promise<void>;
  listDirectory(
    path: string
  ): Promise<{ path: string; sha: string; type: "file" | "dir" }[]>;
  commit(changes: CommitChange[], message: string): Promise<string>;
}
