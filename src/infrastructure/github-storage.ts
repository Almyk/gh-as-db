import { Octokit } from "@octokit/rest";
import {
  ConcurrencyError,
  GitHubDBConfig,
  IStorageProvider,
  StorageResponse,
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

  async testConnection(): Promise<boolean> {
    try {
      await this.octokit.repos.get({
        owner: this.config.owner,
        repo: this.config.repo,
      });
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
      await this.octokit.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
      });
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
      const response = await this.octokit.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        headers: stale ? { "if-none-match": `"${stale.sha}"` } : {},
      });

      if (Array.isArray(response.data)) {
        throw new Error("Path is a directory, not a file");
      }

      if (!("content" in response.data) || !("sha" in response.data)) {
        throw new Error("No content or SHA in response");
      }

      const content = Buffer.from(response.data.content, "base64").toString(
        "utf-8"
      );
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
          const existing = await this.octokit.repos.getContent({
            owner: this.config.owner,
            repo: this.config.repo,
            path,
          });

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
      const response = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        message,
        content: Buffer.from(JSON.stringify(content, null, 2)).toString(
          "base64"
        ),
        sha: internalSha,
      });

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
}
