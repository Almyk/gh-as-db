export interface GitHubDBConfig {
  accessToken: string;
  owner: string;
  repo: string;
}

export type Schema = Record<string, any>;

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

export interface IStorageProvider {
  testConnection(): Promise<boolean>;
  exists(path: string): Promise<boolean>;
  readJson<T>(path: string): Promise<T>;
  writeJson<T>(path: string, content: T, message: string): Promise<void>;
}
