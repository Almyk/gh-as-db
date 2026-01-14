import { describe, it, expect, vi } from "vitest";
import { GitHubDB } from "../src/ui/github-db.js";

describe("GitHubDB Connection", () => {
  it("should initialize with valid config", () => {
    const config = {
      accessToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
    };
    const db = new GitHubDB(config);
    expect(db).toBeDefined();
    expect(db.config).toEqual(config);
  });

  it("should throw error if accessToken is missing", () => {
    const config = {
      accessToken: "",
      owner: "test-owner",
      repo: "test-repo",
    };
    // @ts-ignore - testing runtime error
    expect(() => new GitHubDB(config)).toThrow("accessToken is required");
  });

  it("should throw error if owner is missing", () => {
    const config = {
      accessToken: "token",
      owner: "",
      repo: "repo",
    };
    // @ts-ignore
    expect(() => new GitHubDB(config)).toThrow("owner is required");
  });

  it("should throw error if repo is missing", () => {
    const config = {
      accessToken: "token",
      owner: "owner",
      repo: "",
    };
    // @ts-ignore
    expect(() => new GitHubDB(config)).toThrow("repo is required");
  });

  it("should return true when connection is successful", async () => {
    const config = {
      accessToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
    };
    const db = new GitHubDB(config);

    // Mock the storage provider's testConnection method
    vi.spyOn(db.storage, "testConnection").mockResolvedValue(true);

    const isConnected = await db.connect();
    expect(isConnected).toBe(true);
    expect(db.storage.testConnection).toHaveBeenCalled();
  });

  it("should return false when connection fails", async () => {
    const config = {
      accessToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
    };
    const db = new GitHubDB(config);

    vi.spyOn(db.storage, "testConnection").mockResolvedValue(false);

    const isConnected = await db.connect();
    expect(isConnected).toBe(false);
  });
});
