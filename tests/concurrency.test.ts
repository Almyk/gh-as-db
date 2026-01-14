import { describe, it, expect, beforeEach, vi } from "vitest";
import { GitHubStorageProvider } from "../src/infrastructure/github-storage.js";
import { Collection } from "../src/ui/collection.js";
import { ConcurrencyError } from "../src/core/types.js";

describe("Optimistic Concurrency Control", () => {
  const config = {
    accessToken: "test-token",
    owner: "test-owner",
    repo: "test-repo",
  };

  let storage: GitHubStorageProvider;
  let collection: Collection<{ id: string; name: string }>;

  beforeEach(() => {
    storage = new GitHubStorageProvider(config);
    collection = new Collection("users", storage);

    // Mock octokit to prevent real network calls
    vi.spyOn((storage as any).octokit.repos, "getContent").mockResolvedValue({
      data: { content: "[]", sha: "default-sha" },
    });
    vi.spyOn(
      (storage as any).octokit.repos,
      "createOrUpdateFileContents"
    ).mockResolvedValue({
      data: { content: { sha: "new-sha" } },
    });
  });

  it("should prevent overwriting with stale data", async () => {
    const path = "users.json";
    const initialData = [{ id: "1", name: "Alice" }];
    const initialSha = "sha-1";

    // 1. Initial Read (Client A and B both get same state)
    vi.spyOn(storage, "exists").mockResolvedValue(true);
    vi.spyOn(storage, "readJson").mockResolvedValue({
      data: initialData,
      sha: initialSha,
    });

    // Load data into collection (populates lastSha)
    await collection.find();

    // 2. Client A writes successfully
    const writeSpy = vi
      .spyOn((storage as any).octokit.repos, "createOrUpdateFileContents")
      .mockResolvedValue({
        data: { content: { sha: "sha-2" } },
      });

    await collection.update("1", { name: "Alicia" });
    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sha: initialSha,
      })
    );

    // 3. Client B (another instance or parallel process) attempts to write with stale SHA
    // In this test, we simulate the 409 conflict that GitHub returns when SHA doesn't match
    writeSpy.mockRejectedValue({ status: 409 });

    // Collection still has the updated state from step 2 if it's the same instance,
    // but let's simulate a conflict by calling update again on a stale-ish assumption
    // or just checking that ConcurrencyError is thrown.

    await expect(collection.update("1", { name: "Alice2" })).rejects.toThrow(
      ConcurrencyError
    );
  });

  it("should allow recovery by re-reading", async () => {
    vi.spyOn(storage, "exists").mockResolvedValue(true);
    const readSpy = vi
      .spyOn(storage, "readJson")
      .mockResolvedValueOnce({ data: [], sha: "sha-1" }) // First find
      .mockResolvedValueOnce({ data: [{ id: "1", name: "Bob" }], sha: "sha-2" }) // Recovery find
      .mockResolvedValue({ data: [{ id: "1", name: "Bob" }], sha: "sha-2" }); // update() find

    const writeSpy = vi
      .spyOn((storage as any).octokit.repos, "createOrUpdateFileContents")
      .mockRejectedValueOnce({ status: 409 }) // Conflict
      .mockResolvedValueOnce({ data: { content: { sha: "sha-3" } } }); // Success

    // First attempt fails
    await collection.find();
    await expect(collection.create({ id: "1", name: "Alice" })).rejects.toThrow(
      ConcurrencyError
    );

    // Re-read (recovery)
    await collection.find();

    // Second attempt should use the new SHA
    await collection.update("1", { name: "Bob Updated" });

    expect(writeSpy).toHaveBeenCalledTimes(2);
    expect(writeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sha: "sha-2",
      })
    );
  });

  it("should handle concurrency conflict during delete", async () => {
    const initialData = [{ id: "1", name: "Alice" }];
    const initialSha = "sha-1";

    vi.spyOn(storage, "exists").mockResolvedValue(true);
    vi.spyOn(storage, "readJson").mockResolvedValue({
      data: initialData,
      sha: initialSha,
    });

    await collection.find();

    const writeSpy = vi
      .spyOn((storage as any).octokit.repos, "createOrUpdateFileContents")
      .mockRejectedValue({ status: 409 });

    await expect(collection.delete("1")).rejects.toThrow(ConcurrencyError);
    expect(writeSpy).toHaveBeenCalled();
  });
});
