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
}
