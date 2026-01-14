import { describe, it, expect, beforeEach, vi } from "vitest";
import { GitHubStorageProvider } from "../src/infrastructure/github-storage.js";
import { MemoryCacheProvider } from "../src/infrastructure/cache-provider.js";

describe("Caching Layer", () => {
  const config = {
    accessToken: "test-token",
    owner: "test-owner",
    repo: "test-repo",
  };

  let storage: GitHubStorageProvider;
  let mockCache: MemoryCacheProvider;

  beforeEach(() => {
    mockCache = new MemoryCacheProvider();
    storage = new GitHubStorageProvider(config, mockCache);

    // Mock octokit.repos.getContent
    vi.spyOn((storage as any).octokit.repos, "getContent").mockResolvedValue({
      data: {
        content: Buffer.from(JSON.stringify({ hello: "world" })).toString(
          "base64"
        ),
        sha: "test-sha",
      },
    });

    // Mock octokit.repos.createOrUpdateFileContents
    vi.spyOn(
      (storage as any).octokit.repos,
      "createOrUpdateFileContents"
    ).mockResolvedValue({
      data: {
        content: { sha: "new-sha" },
      },
    });
  });

  it("should cache read results", async () => {
    const path = "test.json";

    // First read - should hit GitHub
    await storage.readJson(path);
    expect((storage as any).octokit.repos.getContent).toHaveBeenCalledTimes(1);

    // Second read - should hit cache
    const result = await storage.readJson(path);
    expect(result.data).toEqual({ hello: "world" });
    expect(result.sha).toBe("test-sha");
    expect((storage as any).octokit.repos.getContent).toHaveBeenCalledTimes(1);
  });

  it("should invalidate cache on write", async () => {
    const path = "test.json";

    // First read to populate cache
    await storage.readJson(path);
    expect(mockCache.get(path)).not.toBeNull();

    // Write to the same path
    await storage.writeJson(path, { new: "data" }, "Update");

    // Cache should be empty for that path
    expect(mockCache.get(path)).toBeNull();

    // Next read should hit GitHub again
    await storage.readJson(path);
    expect((storage as any).octokit.repos.getContent).toHaveBeenCalledTimes(3);
  });

  it("should handle TTL expiry", async () => {
    const path = "expiry.json";
    const ttl = 100; // 100ms

    mockCache.set(path, { data: "temp", sha: "temp-sha" }, ttl);

    expect(mockCache.get(path)).not.toBeNull();

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, ttl + 10));

    expect(mockCache.get(path)).toBeNull();
  });
});
