import { Octokit } from "@octokit/rest";
import { GitHubDBConfig, IStorageProvider } from "../core/types.js";

export class GitHubStorageProvider implements IStorageProvider {
  private octokit: Octokit;

  constructor(private config: GitHubDBConfig) {
    this.octokit = new Octokit({
      auth: config.accessToken,
    });
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

  async readJson<T>(path: string): Promise<T> {
    const response = await this.octokit.repos.getContent({
      owner: this.config.owner,
      repo: this.config.repo,
      path,
    });

    if (Array.isArray(response.data)) {
      throw new Error("Path is a directory, not a file");
    }

    if (!("content" in response.data)) {
      throw new Error("No content in response");
    }

    const content = Buffer.from(response.data.content, "base64").toString(
      "utf-8"
    );
    return JSON.parse(content) as T;
  }

  async writeJson<T>(path: string, content: T, message: string): Promise<void> {
    let sha: string | undefined;

    try {
      const existing = await this.octokit.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
      });

      if (!Array.isArray(existing.data) && "sha" in existing.data) {
        sha = existing.data.sha;
      }
    } catch (error: any) {
      if (error.status !== 404) {
        throw error;
      }
    }

    await this.octokit.repos.createOrUpdateFileContents({
      owner: this.config.owner,
      repo: this.config.repo,
      path,
      message,
      content: Buffer.from(JSON.stringify(content, null, 2)).toString("base64"),
      sha,
    });
  }
}
