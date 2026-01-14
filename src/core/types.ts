export interface GitHubDBConfig {
  accessToken: string;
  owner: string;
  repo: string;
}

export type Schema = Record<string, any>;

export interface IStorageProvider {
  testConnection(): Promise<boolean>;
  exists(path: string): Promise<boolean>;
  readJson<T>(path: string): Promise<T>;
  writeJson<T>(path: string, content: T, message: string): Promise<void>;
}
