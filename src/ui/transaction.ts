import {
  IStorageProvider,
  Middleware,
  Schema,
  Validator,
} from "../core/types.js";
import { TransactionStorageProvider } from "../infrastructure/transaction-storage.js";
import { Collection } from "./collection.js";

/**
 * Handles atomic batch operations across multiple collections.
 */
export class Transaction {
  private txStorage: TransactionStorageProvider;

  constructor(private readonly baseStorage: IStorageProvider) {
    this.txStorage = new TransactionStorageProvider(baseStorage);
  }

  /**
   * Returns a collection instance bound to this transaction.
   * Operations on this collection will be buffered until the transaction is committed.
   */
  collection<T extends Schema>(
    name: string,
    options: { middleware?: Middleware<T>[]; validator?: Validator<T> } = {}
  ): Collection<T> {
    return new Collection<T>(name, this.txStorage, options);
  }

  /**
   * Commits all buffered changes in the transaction to GitHub in a single commit.
   * @internal
   */
  async commit(message: string): Promise<string> {
    const changes = this.txStorage.getChanges();
    if (changes.length === 0) {
      return "";
    }
    return this.txStorage.commit(changes, message);
  }
}
