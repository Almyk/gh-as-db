import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GitHubStorageProvider } from "../src/infrastructure/github-storage.js";
import { ConcurrencyError, RateLimitError } from "../src/core/types.js";

describe("Retry Logic & Rate Limit Handling", () => {
  const config = {
    accessToken: "test-token",
    owner: "test-owner",
    repo: "test-repo",
  };

  let storage: GitHubStorageProvider;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = new GitHubStorageProvider(config);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockGetContent(mock: ReturnType<typeof vi.fn>) {
    (storage as any).octokit.repos.getContent = mock;
  }

  function makeOctokitError(status: number, headers: Record<string, string> = {}) {
    const error: any = new Error(`HTTP ${status}`);
    error.status = status;
    error.response = { headers };
    return error;
  }

  describe("Rate Limit Handling", () => {
    it("should retry on 429 and succeed on subsequent attempt", async () => {
      const mock = vi
        .fn()
        .mockRejectedValueOnce(makeOctokitError(429))
        .mockResolvedValueOnce({
          data: {
            content: btoa(JSON.stringify({ id: "1" })),
            sha: "abc123",
          },
        });
      mockGetContent(mock);

      const promise = storage.readJson("test.json");
      // Advance past backoff delay
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result.data).toEqual({ id: "1" });
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it("should respect Retry-After header from 429 response", async () => {
      const mock = vi
        .fn()
        .mockRejectedValueOnce(makeOctokitError(429, { "retry-after": "2" }))
        .mockResolvedValueOnce({
          data: {
            content: btoa(JSON.stringify({ id: "1" })),
            sha: "abc123",
          },
        });
      mockGetContent(mock);

      const promise = storage.readJson("test.json");

      // At 1s, should not have retried yet (Retry-After is 2s)
      await vi.advanceTimersByTimeAsync(1000);
      expect(mock).toHaveBeenCalledTimes(1);

      // At 2s, should retry
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(100); // small buffer for jitter

      const result = await promise;
      expect(result.data).toEqual({ id: "1" });
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it("should throw RateLimitError after max retries exhausted on persistent 429", async () => {
      const mock = vi.fn().mockImplementation(async () => {
        throw makeOctokitError(429);
      });
      mockGetContent(mock);

      const promise = storage.readJson("test.json");
      // Attach rejection handler before advancing timers to avoid unhandled rejection
      const assertion = expect(promise).rejects.toThrow(RateLimitError);

      await vi.runAllTimersAsync();

      await assertion;
      expect(mock).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  describe("Transient Error Retry", () => {
    it("should retry on 500/502/503 server errors and succeed", async () => {
      for (const status of [500, 502, 503]) {
        const s = new GitHubStorageProvider(config);
        const mock = vi
          .fn()
          .mockRejectedValueOnce(makeOctokitError(status))
          .mockResolvedValueOnce({
            data: {
              content: btoa(JSON.stringify({ ok: true })),
              sha: "sha1",
            },
          });
        (s as any).octokit.repos.getContent = mock;

        const promise = s.readJson("test.json");
        await vi.advanceTimersByTimeAsync(2000);

        const result = await promise;
        expect(result.data).toEqual({ ok: true });
        expect(mock).toHaveBeenCalledTimes(2);
      }
    });

    it("should NOT retry on 401/403/404 (non-transient client errors)", async () => {
      for (const status of [401, 403, 404]) {
        const s = new GitHubStorageProvider(config);
        const mock = vi.fn().mockRejectedValue(makeOctokitError(status));
        (s as any).octokit.repos.getContent = mock;

        await expect(s.readJson("test.json")).rejects.toThrow();
        expect(mock).toHaveBeenCalledTimes(1);
      }
    });

    it("should NOT retry on 409 (ConcurrencyError should propagate immediately)", async () => {
      const writeMock = vi.fn().mockRejectedValue(makeOctokitError(409));
      (storage as any).octokit.repos.createOrUpdateFileContents = writeMock;

      await expect(
        storage.writeJson("test.json", { id: "1" }, "test commit", "old-sha")
      ).rejects.toThrow(ConcurrencyError);
      expect(writeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Backoff Behavior", () => {
    it("should use exponential backoff between retries", async () => {
      const s = new GitHubStorageProvider({
        ...config,
        retry: { baseDelay: 100, maxDelay: 10000 },
      });
      const mock = vi
        .fn()
        .mockRejectedValueOnce(makeOctokitError(500)) // attempt 0
        .mockRejectedValueOnce(makeOctokitError(500)) // attempt 1
        .mockRejectedValueOnce(makeOctokitError(500)) // attempt 2
        .mockResolvedValueOnce({
          data: {
            content: btoa(JSON.stringify({ ok: true })),
            sha: "sha1",
          },
        });
      (s as any).octokit.repos.getContent = mock;

      const promise = s.readJson("test.json");

      // First retry after ~100ms (baseDelay * 2^0)
      await vi.advanceTimersByTimeAsync(150);
      expect(mock).toHaveBeenCalledTimes(2);

      // Second retry after ~200ms (baseDelay * 2^1)
      await vi.advanceTimersByTimeAsync(250);
      expect(mock).toHaveBeenCalledTimes(3);

      // Third retry after ~400ms (baseDelay * 2^2)
      await vi.advanceTimersByTimeAsync(500);
      expect(mock).toHaveBeenCalledTimes(4);

      const result = await promise;
      expect(result.data).toEqual({ ok: true });
    });

    it("should respect maxRetries configuration (default: 3)", async () => {
      const mock = vi.fn().mockImplementation(async () => {
        throw makeOctokitError(500);
      });
      mockGetContent(mock);

      const promise = storage.readJson("test.json");
      // Attach rejection handler before advancing timers to avoid unhandled rejection
      const assertion = expect(promise).rejects.toThrow();

      await vi.runAllTimersAsync();

      await assertion;
      expect(mock).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  describe("Config", () => {
    it("should use default retry config when none provided", async () => {
      const mock = vi
        .fn()
        .mockRejectedValueOnce(makeOctokitError(500))
        .mockResolvedValueOnce({
          data: {
            content: btoa(JSON.stringify({ ok: true })),
            sha: "sha1",
          },
        });
      mockGetContent(mock);

      const promise = storage.readJson("test.json");
      // Default baseDelay is 1000ms, first retry delay = 1000 * 2^0 = 1000ms
      await vi.advanceTimersByTimeAsync(1500);

      const result = await promise;
      expect(result.data).toEqual({ ok: true });
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it("should allow disabling retries via retry: false", async () => {
      const s = new GitHubStorageProvider({
        ...config,
        retry: false,
      });
      const mock = vi.fn().mockRejectedValue(makeOctokitError(500));
      (s as any).octokit.repos.getContent = mock;

      await expect(s.readJson("test.json")).rejects.toThrow();
      expect(mock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Retry applies to all storage operations", () => {
    it("should retry testConnection on transient error", async () => {
      const mock = vi
        .fn()
        .mockRejectedValueOnce(makeOctokitError(502))
        .mockResolvedValueOnce({ data: {} });
      (storage as any).octokit.repos.get = mock;

      const promise = storage.testConnection();
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toBe(true);
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it("should retry deleteFile on transient error", async () => {
      const mock = vi
        .fn()
        .mockRejectedValueOnce(makeOctokitError(503))
        .mockResolvedValueOnce({});
      (storage as any).octokit.repos.deleteFile = mock;

      const promise = storage.deleteFile("test.json", "delete", "sha1");
      await vi.advanceTimersByTimeAsync(2000);

      await promise;
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it("should retry listDirectory on transient error", async () => {
      const mock = vi
        .fn()
        .mockRejectedValueOnce(makeOctokitError(500))
        .mockResolvedValueOnce({
          data: [{ path: "file.json", sha: "sha1", type: "file" }],
        });
      mockGetContent(mock);

      const promise = storage.listDirectory("data/");
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toHaveLength(1);
      expect(mock).toHaveBeenCalledTimes(2);
    });
  });
});
