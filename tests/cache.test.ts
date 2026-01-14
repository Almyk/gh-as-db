import { describe, it, expect, beforeEach, vi } from "vitest";
import { GitHubStorageProvider } from "../src/infrastructure/github-storage.js";
import { MemoryCacheProvider } from "../src/infrastructure/cache-provider.js";

describe("Caching Layer", () => {
  const config = {
    accessToken: "test-token",
    owner: "test-owner",
    repo: "test-repo",
    cacheTTL: 1000,
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

  it("should update cache on write", async () => {
    const path = "test.json";

    // First read to populate cache
    await storage.readJson(path);
    expect(mockCache.get(path)).not.toBeNull();

    // Write to the same path
    const newData = { new: "data" };
    await storage.writeJson(path, newData, "Update");

    // Cache should now contain the NEW data
    const cachedAfterWrite = mockCache.get(path);
    expect(cachedAfterWrite).not.toBeNull();
    expect(cachedAfterWrite?.data).toEqual(newData);
    expect(cachedAfterWrite?.sha).toBe("new-sha");

    // Next read should hit cache (still 1 call from the very first read)
    const result = await storage.readJson(path);
    expect(result.data).toEqual(newData);
    expect((storage as any).octokit.repos.getContent).toHaveBeenCalledTimes(1);
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
