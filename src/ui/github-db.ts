import {
  GitHubDBConfig,
  IStorageProvider,
  Middleware,
  Schema,
  Validator,
} from "../core/types.js";
import { GitHubStorageProvider } from "../infrastructure/github-storage.js";
import { Collection } from "./collection.js";

import { Transaction } from "./transaction.js";

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
    options: { middleware?: Middleware<T>[]; validator?: Validator<T> } = {}
  ): Collection<T> {
    return new Collection<T>(name, this.storage, options);
  }

  async transaction(
    fn: (tx: Transaction) => Promise<void>,
    message: string = "Transaction commit"
  ): Promise<string> {
    const tx = new Transaction(this.storage);
    await fn(tx);
    return tx.commit(message);
  }
}
