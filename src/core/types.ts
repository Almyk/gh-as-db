export interface GitHubDBConfig {
  accessToken: string;
  owner: string;
  repo: string;
}

export interface IStorageProvider {
  testConnection(): Promise<boolean>;
}
