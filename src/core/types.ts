export interface GitHubDBConfig {
  accessToken: string;
  owner: string;
  repo: string;
}

export type Schema = Record<string, any>;

export interface IStorageProvider {
  testConnection(): Promise<boolean>;
  exists(path: string): Promise<boolean>;
}
