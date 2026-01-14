import { describe, it, expect, vi } from "vitest";
import { GitHubStorageProvider } from "../src/infrastructure/github-storage.js";
import { MemoryCacheProvider } from "../src/infrastructure/cache-provider.js";

describe("Cache Consistency (Multi-instance)", () => {
    const config = {
        accessToken: "test-token",
        owner: "test-owner",
        repo: "test-repo",
    };

    it("should not return stale data from cache when another instance has updated it", async () => {
        // Shared "GitHub" state
        let githubData = { hello: "world" };
        let githubSha = "sha-1";

        const mockGetContent = vi.fn().mockImplementation((params) => {
            const ifNoneMatch = params.headers?.["if-none-match"];
            if (ifNoneMatch === `"${githubSha}"`) {
                const error = new Error("Not Modified");
                (error as any).status = 304;
                return Promise.reject(error);
            }
            return Promise.resolve({
                data: {
                    content: Buffer.from(JSON.stringify(githubData)).toString("base64"),
                    sha: githubSha,
                },
            });
        });

        const mockUpdateFile = vi.fn().mockImplementation(({ content }) => {
            githubData = JSON.parse(Buffer.from(content, "base64").toString("utf-8"));
            githubSha = "sha-" + Math.random().toString(36).substring(7); // New SHA
            return Promise.resolve({
                data: {
                    content: { sha: githubSha },
                },
            });
        });

        // Create Instance 1
        const cache1 = new MemoryCacheProvider();
        const storage1 = new GitHubStorageProvider(config, cache1);
        (storage1 as any).octokit.repos.getContent = mockGetContent;
        (storage1 as any).octokit.repos.createOrUpdateFileContents = mockUpdateFile;

        // Create Instance 2
        const cache2 = new MemoryCacheProvider();
        const storage2 = new GitHubStorageProvider(config, cache2);
        (storage2 as any).octokit.repos.getContent = mockGetContent;
        (storage2 as any).octokit.repos.createOrUpdateFileContents = mockUpdateFile;

        const path = "data.json";

        // 1. Instance 1 reads - populates cache 1
        const res1 = await storage1.readJson(path);
        expect(res1.data).toEqual({ hello: "world" });
        expect(mockGetContent).toHaveBeenCalledTimes(1);

        // 2. Instance 2 reads - populates cache 2
        const res2 = await storage2.readJson(path);
        expect(res2.data).toEqual({ hello: "world" });
        expect(mockGetContent).toHaveBeenCalledTimes(2);

        // 3. Instance 1 updates data
        await storage1.writeJson(path, { hello: "updated" }, "Update");
        expect(mockUpdateFile).toHaveBeenCalledTimes(1);

        // so next read hits stale cache -> conditional GET
        const res1_after = await storage1.readJson(path);
        expect(res1_after.data).toEqual({ hello: "updated" });
        expect(mockGetContent).toHaveBeenCalledTimes(3);

        // 4. Instance 2 reads AGAIN - SHOULD return updated data, NOT stale data from cache 2
        const res2_after = await storage2.readJson(path);

        expect(res2_after.data).toEqual({ hello: "updated" });
        expect(mockGetContent).toHaveBeenCalledTimes(4);
    });
});
