import { GitHubDBConfig, IStorageProvider } from "../core/types.js";
import { GitHubStorageProvider } from "../infrastructure/github-storage.js";

export class GitHubDB {
  public readonly storage: IStorageProvider;

  constructor(public readonly config: GitHubDBConfig) {
    if (!config.accessToken) {
      throw new Error("accessToken is required");
    }
    if (!config.owner) {
      throw new Error("owner is required");
    }
    if (!config.repo) {
      throw new Error("repo is required");
    }

    this.storage = new GitHubStorageProvider(config);
  }

  async connect(): Promise<boolean> {
    return this.storage.testConnection();
  }
}
