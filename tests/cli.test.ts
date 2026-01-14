import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initCommand,
  listCollectionsCommand,
  inspectCollectionCommand,
} from "../src/ui/cli/commands.js";
import enquirer from "enquirer";
import { GitHubStorageProvider } from "../src/infrastructure/github-storage.js";
import { Octokit } from "@octokit/rest";

// Mock the dependencies
vi.mock("enquirer", () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock("../src/infrastructure/github-storage.js", () => {
  return {
    GitHubStorageProvider: vi.fn(),
  };
});

vi.mock("@octokit/rest", () => {
  return {
    Octokit: vi.fn(),
  };
});

describe("CLI Commands", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("initCommand", () => {
    it("should successfully verify connection with correct credentials", async () => {
      vi.mocked(enquirer.prompt).mockResolvedValue({
        owner: "test-owner",
        repo: "test-repo",
        accessToken: "test-token",
      });

      const mockTestConnection = vi.fn().mockResolvedValue(true);
      vi.mocked(GitHubStorageProvider).mockImplementation(function (this: any) {
        this.testConnection = mockTestConnection;
      } as any);

      await initCommand();

      expect(enquirer.prompt).toHaveBeenCalled();
      expect(GitHubStorageProvider).toHaveBeenCalled();
      expect(mockTestConnection).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Success!")
      );
    });

    it("should report failure when connection fails", async () => {
      vi.mocked(enquirer.prompt).mockResolvedValue({
        owner: "test-owner",
        repo: "test-repo",
        accessToken: "invalid-token",
      });

      const mockTestConnection = vi.fn().mockResolvedValue(false);
      vi.mocked(GitHubStorageProvider).mockImplementation(function (this: any) {
        this.testConnection = mockTestConnection;
      } as any);

      await initCommand();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Failed.")
      );
    });
  });

  describe("listCollectionsCommand", () => {
    it("should list .json files as collections", async () => {
      process.env.GH_DB_OWNER = "test-owner";
      process.env.GH_DB_REPO = "test-repo";
      process.env.GH_DB_TOKEN = "test-token";

      const mockData = [
        { name: "users.json", type: "file" },
        { name: "posts.json", type: "file" },
        { name: "README.md", type: "file" },
      ];

      const mockGetContent = vi.fn().mockResolvedValue({ data: mockData });
      vi.mocked(Octokit).mockImplementation(function (this: any) {
        this.repos = {
          getContent: mockGetContent,
        };
      } as any);

      await listCollectionsCommand();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("users")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("posts")
      );
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("README")
      );
    });

    it("should fail if environment variables are missing", async () => {
      delete process.env.GH_DB_OWNER;
      await listCollectionsCommand();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Error: Environment variables")
      );
    });
  });

  describe("inspectCollectionCommand", () => {
    it("should print collection data", async () => {
      process.env.GH_DB_OWNER = "test-owner";
      process.env.GH_DB_REPO = "test-repo";
      process.env.GH_DB_TOKEN = "test-token";

      const mockContent = [{ id: "1", name: "Alice" }];
      const mockExists = vi.fn().mockResolvedValue(true);
      const mockReadJson = vi.fn().mockResolvedValue({
        data: mockContent,
        sha: "test-sha",
      });

      vi.mocked(GitHubStorageProvider).mockImplementation(function (this: any) {
        this.exists = mockExists;
        this.readJson = mockReadJson;
      } as any);

      await inspectCollectionCommand("users");

      expect(mockExists).toHaveBeenCalledWith("users.json");
      expect(mockReadJson).toHaveBeenCalledWith("users.json");
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"name": "Alice"')
      );
    });

    it("should fail if collection does not exist", async () => {
      process.env.GH_DB_OWNER = "test-owner";
      process.env.GH_DB_REPO = "test-repo";
      process.env.GH_DB_TOKEN = "test-token";

      const mockExists = vi.fn().mockResolvedValue(false);
      vi.mocked(GitHubStorageProvider).mockImplementation(function (this: any) {
        this.exists = mockExists;
      } as any);

      await inspectCollectionCommand("missing");

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Collection "missing" does not exist')
      );
    });
  });
});
