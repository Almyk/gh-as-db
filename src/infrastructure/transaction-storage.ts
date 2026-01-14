import {
  CommitChange,
  IStorageProvider,
  StorageResponse,
} from "../core/types.js";

/**
 * A decorator for IStorageProvider that buffers writes in memory.
 * Used during transactions to group multiple operations into a single commit.
 */
export class TransactionStorageProvider implements IStorageProvider {
  private pendingChanges = new Map<string, any>();

  constructor(private readonly baseStorage: IStorageProvider) {}

  async testConnection(): Promise<boolean> {
    return this.baseStorage.testConnection();
  }

  async exists(path: string): Promise<boolean> {
    if (this.pendingChanges.has(path)) {
      return true;
    }
    return this.baseStorage.exists(path);
  }

  async readJson<T>(path: string): Promise<StorageResponse<T>> {
    const pending = this.pendingChanges.get(path);
    if (pending !== undefined) {
      return {
        data: pending as T,
        sha: "transaction-pending-sha",
      };
    }
    return this.baseStorage.readJson<T>(path);
  }

  async writeJson<T>(
    path: string,
    content: T,
    _message: string,
    _sha?: string
  ): Promise<string> {
    this.pendingChanges.set(path, content);
    return "transaction-pending-sha";
  }

  async deleteFile(
    path: string,
    _message: string,
    _sha: string
  ): Promise<void> {
    this.pendingChanges.set(path, null);
  }

  async listDirectory(
    path: string
  ): Promise<{ path: string; sha: string; type: "file" | "dir" }[]> {
    // For now, we delegate to base storage.
    // In sharded mode, we might need to merge with pending changes.
    return this.baseStorage.listDirectory(path);
  }

  async commit(changes: CommitChange[], message: string): Promise<string> {
    return this.baseStorage.commit(changes, message);
  }

  /**
   * Returns all pending changes in this transaction.
   */
  getChanges(): CommitChange[] {
    return Array.from(this.pendingChanges.entries()).map(([path, content]) => ({
      path,
      content,
    }));
  }
}
