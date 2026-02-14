import { Octokit } from "@octokit/rest";
import {
  ConcurrencyError,
  RateLimitError,
  RetryConfig,
  GitHubDBConfig,
  IStorageProvider,
  StorageResponse,
  CommitChange,
} from "../core/types.js";
import { ICacheProvider, MemoryCacheProvider } from "./cache-provider.js";

export class GitHubStorageProvider implements IStorageProvider {
  private octokit: Octokit;
  private cache: ICacheProvider;
  private staleCache = new Map<string, StorageResponse<any>>();
  private readonly DEFAULT_TTL = 0; // Default to 0 for consistency

  constructor(private config: GitHubDBConfig, cache?: ICacheProvider) {
    this.octokit = new Octokit({
      auth: this.config.accessToken,
    });
    this.cache = cache || new MemoryCacheProvider();
  }

  private async retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
    if (this.config.retry === false) return fn();

    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
    } = this.config.retry ?? {};

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const status = error?.status;

        // Non-retryable: 409 (concurrency), 4xx client errors (except 429)
        if (status === 409) throw error;
        if (status && status < 500 && status !== 429) throw error;
        // Errors without a status code (non-HTTP errors) — rethrow
        if (!status) throw error;

        // Last attempt — don't wait, just break
        if (attempt === maxRetries) break;

        // Calculate delay
        let delay: number;
        if (status === 429 && error.response?.headers?.["retry-after"]) {
          delay =
            parseInt(error.response.headers["retry-after"], 10) * 1000;
        } else {
          delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Exhausted retries on 429 → RateLimitError
    if (lastError?.status === 429) {
      const retryAfter = lastError.response?.headers?.["retry-after"];
      throw new RateLimitError(
        retryAfter ? parseInt(retryAfter, 10) : undefined
      );
    }

    throw lastError;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.retryWithBackoff(() =>
        this.octokit.repos.get({
          owner: this.config.owner,
          repo: this.config.repo,
        })
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async exists(path: string): Promise<boolean> {
    if (this.cache.get(path) || this.staleCache.has(path)) {
      return true;
    }

    try {
      await this.retryWithBackoff(() =>
        this.octokit.repos.getContent({
          owner: this.config.owner,
          repo: this.config.repo,
          path,
        })
      );
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  async readJson<T>(path: string): Promise<StorageResponse<T>> {
    // 1. Check fresh cache (blind trust)
    const fresh = this.cache.get<T>(path);
    if (fresh) {
      return fresh;
    }

    // 2. Check stale cache for conditional request
    const stale = this.staleCache.get(path) as StorageResponse<T> | undefined;

    try {
      const response = await this.retryWithBackoff(() =>
        this.octokit.repos.getContent({
          owner: this.config.owner,
          repo: this.config.repo,
          path,
          headers: stale ? { "if-none-match": `"${stale.sha}"` } : {},
        })
      );

      if (Array.isArray(response.data)) {
        throw new Error("Path is a directory, not a file");
      }

      if (!("content" in response.data) || !("sha" in response.data)) {
        throw new Error("No content or SHA in response");
      }

      const binary = atob(response.data.content.replace(/\s/g, ""));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decoder = new TextDecoder("utf-8");
      const content = decoder.decode(bytes);
      const result = {
        data: JSON.parse(content) as T,
        sha: response.data.sha,
      };

      // Update both caches
      const ttl = this.config.cacheTTL ?? this.DEFAULT_TTL;
      this.cache.set(path, result, ttl);
      this.staleCache.set(path, result);

      return result;
    } catch (error: any) {
      if (error.status === 304 && stale) {
        // Re-cache as fresh and return stale data
        const ttl = this.config.cacheTTL ?? this.DEFAULT_TTL;
        this.cache.set(path, stale, ttl);
        return stale;
      }
      throw error;
    }
  }

  async writeJson<T>(
    path: string,
    content: T,
    message: string,
    sha?: string
  ): Promise<string> {
    let internalSha = sha;

    if (!internalSha) {
      const cached = this.cache.get<any>(path) || this.staleCache.get(path);
      if (cached) {
        internalSha = cached.sha;
      } else {
        try {
          const existing = await this.retryWithBackoff(() =>
            this.octokit.repos.getContent({
              owner: this.config.owner,
              repo: this.config.repo,
              path,
            })
          );

          if (!Array.isArray(existing.data) && "sha" in existing.data) {
            internalSha = existing.data.sha;
          }
        } catch (error: any) {
          if (error.status !== 404) {
            throw error;
          }
        }
      }
    }

    try {
      const response = await this.retryWithBackoff(() =>
        this.octokit.repos.createOrUpdateFileContents({
          owner: this.config.owner,
          repo: this.config.repo,
          path,
          message,
          content: btoa(
            Array.from(
              new TextEncoder().encode(JSON.stringify(content, null, 2))
            )
              .map((b) => String.fromCharCode(b))
              .join("")
          ),
          sha: internalSha,
        })
      );

      const newSha = response.data.content?.sha || "";
      const result = { data: content, sha: newSha };
      const ttl = this.config.cacheTTL ?? this.DEFAULT_TTL;

      this.cache.set(path, result, ttl);
      this.staleCache.set(path, result);

      return newSha;
    } catch (error: any) {
      if (error.status === 409) {
        throw new ConcurrencyError(path);
      }
      throw error;
    }
  }

  async commit(changes: CommitChange[], message: string): Promise<string> {
    if (changes.length === 0) {
      throw new Error("No changes to commit");
    }

    const branch = this.config.branch || "main";

    try {
      // 1. Get the current head SHA
      const { data: ref } = await this.retryWithBackoff(() =>
        this.octokit.git.getRef({
          owner: this.config.owner,
          repo: this.config.repo,
          ref: `heads/${branch}`,
        })
      );
      const latestCommitSha = ref.object.sha;

      // 2. Get the tree SHA of the latest commit
      const { data: latestCommit } = await this.retryWithBackoff(() =>
        this.octokit.git.getCommit({
          owner: this.config.owner,
          repo: this.config.repo,
          commit_sha: latestCommitSha,
        })
      );
      const baseTreeSha = latestCommit.tree.sha;

      // 3. Create a new tree with multiple files
      const treeEntries = changes.map((change) => {
        if (change.content === null) {
          return {
            path: change.path,
            mode: "100644" as const,
            type: "blob" as const,
            sha: null,
          };
        }
        return {
          path: change.path,
          mode: "100644" as const,
          type: "blob" as const,
          content: JSON.stringify(change.content, null, 2),
        };
      });

      const { data: newTree } = await this.retryWithBackoff(() =>
        this.octokit.git.createTree({
          owner: this.config.owner,
          repo: this.config.repo,
          base_tree: baseTreeSha,
          tree: treeEntries,
        })
      );

      // 4. Create a new commit
      const { data: newCommit } = await this.retryWithBackoff(() =>
        this.octokit.git.createCommit({
          owner: this.config.owner,
          repo: this.config.repo,
          message,
          tree: newTree.sha,
          parents: [latestCommitSha],
        })
      );

      // 5. Update the reference
      await this.retryWithBackoff(() =>
        this.octokit.git.updateRef({
          owner: this.config.owner,
          repo: this.config.repo,
          ref: `heads/${branch}`,
          sha: newCommit.sha,
        })
      );

      // 6. Update cache for all involved files
      const ttl = this.config.cacheTTL ?? this.DEFAULT_TTL;
      for (const entry of newTree.tree) {
        if (entry.path && entry.sha) {
          const change = changes.find((c) => c.path === entry.path);
          if (change) {
            const result = { data: change.content, sha: entry.sha };
            this.cache.set(entry.path, result, ttl);
            this.staleCache.set(entry.path, result);
          }
        }
      }

      return newCommit.sha;
    } catch (error: any) {
      if (error.status === 409) {
        throw new ConcurrencyError("batch-commit");
      }
      throw error;
    }
  }

  async deleteFile(path: string, message: string, sha: string): Promise<void> {
    await this.retryWithBackoff(() =>
      this.octokit.repos.deleteFile({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        message,
        sha,
      })
    );
    this.cache.delete(path);
    this.staleCache.delete(path);
  }

  async listDirectory(
    path: string
  ): Promise<{ path: string; sha: string; type: "file" | "dir" }[]> {
    try {
      const response = await this.retryWithBackoff(() =>
        this.octokit.repos.getContent({
          owner: this.config.owner,
          repo: this.config.repo,
          path,
        })
      );

      if (!Array.isArray(response.data)) {
        throw new Error("Path is not a directory");
      }

      return response.data.map((item) => ({
        path: item.path,
        sha: item.sha,
        type: item.type as "file" | "dir",
      }));
    } catch (error: any) {
      if (error.status === 404) {
        return [];
      }
      throw error;
    }
  }
}
