import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubStorageProvider } from "../src/infrastructure/github-storage.js";
import { ConcurrencyError } from "../src/core/types.js";
import { Octokit } from "@octokit/rest";

const { mockRepos } = vi.hoisted(() => ({
  mockRepos: {
    get: vi.fn(),
    getContent: vi.fn(),
    createOrUpdateFileContents: vi.fn(),
  },
}));

// Mock Octokit
vi.mock("@octokit/rest", () => {
  return {
    Octokit: class {
      repos = mockRepos;
    },
  };
});

describe("GitHubStorageProvider", () => {
  const config = {
    accessToken: "test-token",
    owner: "test-owner",
    repo: "test-repo",
  };

  let provider: GitHubStorageProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GitHubStorageProvider(config);
  });

  describe("testConnection", () => {
    it("should return true on success", async () => {
      mockRepos.get.mockResolvedValue({});
      const result = await provider.testConnection();
      expect(result).toBe(true);
    });

    it("should return false on failure", async () => {
      mockRepos.get.mockRejectedValue(new Error("Connection failed"));
      const result = await provider.testConnection();
      expect(result).toBe(false);
    });
  });

  describe("exists", () => {
    it("should return true if file exists", async () => {
      mockRepos.getContent.mockResolvedValue({});
      const result = await provider.exists("test.json");
      expect(result).toBe(true);
    });

    it("should return false if file does not exist (404)", async () => {
      const error: any = new Error("Not Found");
      error.status = 404;
      mockRepos.getContent.mockRejectedValue(error);
      const result = await provider.exists("test.json");
      expect(result).toBe(false);
    });

    it("should throw other errors", async () => {
      const error: any = new Error("Forbidden");
      error.status = 403;
      mockRepos.getContent.mockRejectedValue(error);
      await expect(provider.exists("test.json")).rejects.toThrow("Forbidden");
    });
  });

  describe("readJson", () => {
    it("should throw if path is a directory", async () => {
      mockRepos.getContent.mockResolvedValue({ data: [] });
      await expect(provider.readJson("dir")).rejects.toThrow(
        "Path is a directory"
      );
    });

    it("should throw if content or sha is missing", async () => {
      mockRepos.getContent.mockResolvedValue({ data: {} });
      await expect(provider.readJson("test.json")).rejects.toThrow(
        "No content or SHA"
      );
    });

    it("should return data and sha on success", async () => {
      const content = JSON.stringify({ key: "value" });
      mockRepos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from(content).toString("base64"),
          sha: "test-sha",
        },
      });
      const result = await provider.readJson("test.json");
      expect(result).toEqual({ data: { key: "value" }, sha: "test-sha" });
    });
  });

  describe("writeJson", () => {
    it("should throw ConcurrencyError on 409", async () => {
      const error: any = new Error("Conflict");
      error.status = 409;
      mockRepos.createOrUpdateFileContents.mockRejectedValue(error);
      await expect(
        provider.writeJson("test.json", {}, "msg", "old-sha")
      ).rejects.toThrow(ConcurrencyError);
    });

    it("should fetch SHA if not provided and file exists", async () => {
      mockRepos.getContent.mockResolvedValue({
        data: { sha: "fetched-sha" },
      });
      mockRepos.createOrUpdateFileContents.mockResolvedValue({
        data: { content: { sha: "new-sha" } },
      });

      const result = await provider.writeJson("test.json", { a: 1 }, "msg");
      expect(mockRepos.getContent).toHaveBeenCalled();
      expect(mockRepos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({ sha: "fetched-sha" })
      );
      expect(result).toBe("new-sha");
    });

    it("should handle 404 when fetching SHA", async () => {
      const error: any = new Error("Not Found");
      error.status = 404;
      mockRepos.getContent.mockRejectedValue(error);
      mockRepos.createOrUpdateFileContents.mockResolvedValue({
        data: { content: { sha: "new-sha" } },
      });

      const result = await provider.writeJson("test.json", { a: 1 }, "msg");
      expect(mockRepos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({ sha: undefined })
      );
      expect(result).toBe("new-sha");
    });

    it("should throw other errors when fetching SHA", async () => {
      const error: any = new Error("Forbidden");
      error.status = 403;
      mockRepos.getContent.mockRejectedValue(error);
      await expect(
        provider.writeJson("test.json", { a: 1 }, "msg")
      ).rejects.toThrow("Forbidden");
    });

    it("should throw other errors during actual write", async () => {
      mockRepos.createOrUpdateFileContents.mockRejectedValue(
        new Error("Write failed")
      );
      await expect(
        provider.writeJson("test.json", {}, "msg", "sha")
      ).rejects.toThrow("Write failed");
    });
  });
});
