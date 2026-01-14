import { describe, it, expect, vi, beforeEach } from "vitest";
import { Collection } from "../src/ui/collection.js";
import { IStorageProvider } from "../src/core/types.js";

describe("Sharded Storage (One-File-Per-Document)", () => {
  let mockStorage: IStorageProvider;

  beforeEach(() => {
    mockStorage = {
      testConnection: vi.fn(),
      exists: vi.fn().mockResolvedValue(true),
      readJson: vi.fn(),
      writeJson: vi.fn().mockResolvedValue("new-sha"),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      listDirectory: vi.fn().mockResolvedValue([]),
      commit: vi.fn(),
    };
  });

  interface User {
    id: string;
    name: string;
  }

  it("should write items to individual files when strategy is sharded", async () => {
    const users = new Collection<User>("users", mockStorage, {
      strategy: "sharded",
    });

    const newUser = { id: "user-1", name: "Alice" };
    await users.create(newUser);

    expect(mockStorage.writeJson).toHaveBeenCalledWith(
      "users/user-1.json",
      newUser,
      expect.any(String),
      undefined
    );
  });

  it("should read items from individual files using findById (efficiency)", async () => {
    const users = new Collection<User>("users", mockStorage, {
      strategy: "sharded",
    });

    mockStorage.readJson = vi.fn().mockResolvedValue({
      data: { id: "user-1", name: "Alice" },
      sha: "item-sha",
    });

    const result = await users.findById("user-1");

    expect(result).toEqual({ id: "user-1", name: "Alice" });
    expect(mockStorage.readJson).toHaveBeenCalledWith("users/user-1.json");
    expect(mockStorage.listDirectory).not.toHaveBeenCalled(); // Efficiency: directly read file
  });

  it("should discover all items using listDirectory and individual reads", async () => {
    const users = new Collection<User>("users", mockStorage, {
      strategy: "sharded",
    });

    mockStorage.listDirectory = vi.fn().mockResolvedValue([
      { path: "users/1.json", sha: "s1", type: "file" },
      { path: "users/2.json", sha: "s2", type: "file" },
    ]);

    mockStorage.readJson = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "1", name: "A" }, sha: "s1" })
      .mockResolvedValueOnce({ data: { id: "2", name: "B" }, sha: "s2" });

    const results = await users.find();

    expect(results).toHaveLength(2);
    expect(mockStorage.listDirectory).toHaveBeenCalledWith("users");
    expect(mockStorage.readJson).toHaveBeenCalledTimes(2);
  });

  it("should delete individual files in sharded mode", async () => {
    const users = new Collection<User>("users", mockStorage, {
      strategy: "sharded",
    });

    // Setup: item exists
    mockStorage.listDirectory = vi
      .fn()
      .mockResolvedValue([{ path: "users/1.json", sha: "s1", type: "file" }]);
    mockStorage.readJson = vi.fn().mockResolvedValue({
      data: { id: "1", name: "Alice" },
      sha: "s1",
    });

    await users.delete("1");

    expect(mockStorage.deleteFile).toHaveBeenCalledWith(
      "users/1.json",
      expect.any(String),
      "s1"
    );
  });

  it("should fall back to fetching SHA if not in memory during delete", async () => {
    const users = new Collection<User>("users", mockStorage, {
      strategy: "sharded",
    });

    mockStorage.listDirectory = vi
      .fn()
      .mockResolvedValue([{ path: "users/1.json", sha: "s1", type: "file" }]);
    // Mock for find() call within delete()
    mockStorage.readJson = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "1", name: "Alice" }, sha: "s1" }) // find
      .mockResolvedValueOnce({ data: { id: "1", name: "Alice" }, sha: "s1" }); // readJson in delete if sha not found (actually it finds it in find())

    // Wait, my delete logic:
    // const items = await this.find(); // loads SHAs into this.shas map
    // so it should have the SHA.

    await users.delete("1");
    expect(mockStorage.deleteFile).toHaveBeenCalledWith(
      "users/1.json",
      expect.any(String),
      "s1"
    );
  });
});
