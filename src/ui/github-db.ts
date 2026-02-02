import {
  GitHubDBConfig,
  IStorageProvider,
  Middleware,
  Schema,
  StorageStrategy,
  Validator,
} from "../core/types.js";
import { GitHubStorageProvider } from "../infrastructure/github-storage.js";
import { Collection } from "./collection.js";

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

  collection<T extends Schema>(
    name: string,
    options: {
      middleware?: Middleware<T>[];
      validator?: Validator<T>;
      strategy?: StorageStrategy;
    } = {}
  ): Collection<T> {
    return new Collection<T>(name, this.storage, options);
  }
}
