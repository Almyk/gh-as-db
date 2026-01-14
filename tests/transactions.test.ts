import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubDB } from "../src/ui/github-db.js";
import { IStorageProvider } from "../src/core/types.js";
import { GitHubStorageProvider } from "../src/infrastructure/github-storage.js";

const { mockGit, mockRepos } = vi.hoisted(() => ({
  mockGit: {
    getRef: vi.fn(),
    getCommit: vi.fn(),
    createTree: vi.fn(),
    createCommit: vi.fn(),
    updateRef: vi.fn(),
  },
  mockRepos: {
    get: vi.fn(),
    getContent: vi.fn(),
  },
}));

vi.mock("@octokit/rest", () => {
  return {
    Octokit: class {
      git = mockGit;
      repos = mockRepos;
    },
  };
});

describe("Transactions & Batching", () => {
  const config = {
    accessToken: "test-token",
    owner: "test-owner",
    repo: "test-repo",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Transaction Class Logic", () => {
    it("should buffer multiple operations and commit them at once", async () => {
      const mockStorage: IStorageProvider = {
        testConnection: vi.fn(),
        exists: vi.fn().mockResolvedValue(true),
        readJson: vi.fn().mockResolvedValue({ data: [], sha: "test-sha" }),
        writeJson: vi.fn(),
        commit: vi.fn().mockResolvedValue("new-commit-sha"),
        deleteFile: vi.fn(),
        listDirectory: vi.fn(),
      };

      const db = new GitHubDB(config);
      // @ts-ignore - injecting mock storage
      db.storage = mockStorage;

      const result = await db.transaction(async (tx) => {
        const users = tx.collection("users");
        const logs = tx.collection("logs");

        await users.create({ id: "1", name: "Alice" });
        await logs.create({ id: "L1", message: "User created" });
      }, "Batch creation");

      expect(result).toBe("new-commit-sha");
      expect(mockStorage.writeJson).not.toHaveBeenCalled();
      expect(mockStorage.commit).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ path: "users.json" }),
          expect.objectContaining({ path: "logs.json" }),
        ]),
        "Batch creation"
      );
    });

    it("should allow reading pending changes within the same transaction", async () => {
      const mockStorage: IStorageProvider = {
        testConnection: vi.fn(),
        exists: vi.fn().mockResolvedValue(false),
        readJson: vi.fn(),
        writeJson: vi.fn(),
        commit: vi.fn().mockResolvedValue("new-sha"),
        deleteFile: vi.fn(),
        listDirectory: vi.fn(),
      };

      const db = new GitHubDB(config);
      // @ts-ignore
      db.storage = mockStorage;

      await db.transaction(async (tx) => {
        const users = tx.collection("users");
        await users.create({ id: "1", name: "Alice" });

        const result = await users.findById("1");
        expect(result).toEqual({ id: "1", name: "Alice" });
      });
    });
  });

  describe("GitHubStorageProvider.commit", () => {
    it("should perform the 5-step Git Data API flow", async () => {
      const provider = new GitHubStorageProvider(config);

      mockGit.getRef.mockResolvedValue({
        data: { object: { sha: "last-commit-sha" } },
      });
      mockGit.getCommit.mockResolvedValue({
        data: { tree: { sha: "base-tree-sha" } },
      });
      mockGit.createTree.mockResolvedValue({
        data: {
          sha: "new-tree-sha",
          tree: [{ path: "test.json", sha: "blob-sha" }],
        },
      });
      mockGit.createCommit.mockResolvedValue({
        data: { sha: "new-commit-sha" },
      });
      mockGit.updateRef.mockResolvedValue({});

      const changes = [{ path: "test.json", content: { a: 1 } }];
      const result = await provider.commit(changes, "test message");

      expect(result).toBe("new-commit-sha");
      expect(mockGit.getRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "heads/main" })
      );
      expect(mockGit.createTree).toHaveBeenCalledWith(
        expect.objectContaining({
          base_tree: "base-tree-sha",
          tree: expect.arrayContaining([
            expect.objectContaining({ path: "test.json" }),
          ]),
        })
      );
      expect(mockGit.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          tree: "new-tree-sha",
          parents: ["last-commit-sha"],
        })
      );
      expect(mockGit.updateRef).toHaveBeenCalledWith(
        expect.objectContaining({
          sha: "new-commit-sha",
        })
      );
    });
  });
});
