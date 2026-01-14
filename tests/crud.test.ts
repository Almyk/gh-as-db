import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubDB } from "../src/ui/github-db.js";

describe("CRUD Operations", () => {
  const config = {
    accessToken: "test-token",
    owner: "test-owner",
    repo: "test-repo",
  };

  interface User {
    id: string;
    name: string;
  }

  let db: GitHubDB;
  let users: any;

  beforeEach(() => {
    db = new GitHubDB(config);
    users = db.collection<User>("users");
    vi.clearAllMocks();
  });

  it("should create a new item", async () => {
    // Mock existence check (false first time)
    vi.spyOn(db.storage, "exists").mockResolvedValue(false);
    const writeSpy = vi
      .spyOn(db.storage, "writeJson")
      .mockResolvedValue("new-sha");

    const newUser = { id: "1", name: "Alice" };
    const result = await users.create(newUser);

    expect(result).toEqual(newUser);
    expect(writeSpy).toHaveBeenCalledWith(
      "users.json",
      [newUser],
      expect.any(String),
      undefined
    );
  });

  it("should find items", async () => {
    const mockData = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    vi.spyOn(db.storage, "exists").mockResolvedValue(true);
    vi.spyOn(db.storage, "readJson").mockResolvedValue({
      data: mockData,
      sha: "test-sha",
    });

    const result = await users.find();
    expect(result).toEqual(mockData);
  });

  it("should find an item by id", async () => {
    const mockData = [{ id: "1", name: "Alice" }];
    vi.spyOn(db.storage, "exists").mockResolvedValue(true);
    vi.spyOn(db.storage, "readJson").mockResolvedValue({
      data: mockData,
      sha: "test-sha",
    });

    const result = await users.findById("1");
    expect(result).toEqual(mockData[0]);
  });

  it("should update an item", async () => {
    const mockData = [{ id: "1", name: "Alice" }];
    vi.spyOn(db.storage, "exists").mockResolvedValue(true);
    vi.spyOn(db.storage, "readJson").mockResolvedValue({
      data: mockData,
      sha: "test-sha",
    });
    const writeSpy = vi
      .spyOn(db.storage, "writeJson")
      .mockResolvedValue("new-sha");

    const updated = await users.update("1", { name: "Alicia" });
    expect(updated.name).toBe("Alicia");
    expect(writeSpy).toHaveBeenCalledWith(
      "users.json",
      [{ id: "1", name: "Alicia" }],
      expect.any(String),
      "test-sha"
    );
  });

  it("should delete an item", async () => {
    const mockData = [{ id: "1", name: "Alice" }];
    vi.spyOn(db.storage, "exists").mockResolvedValue(true);
    vi.spyOn(db.storage, "readJson").mockResolvedValue({
      data: mockData,
      sha: "test-sha",
    });
    const writeSpy = vi
      .spyOn(db.storage, "writeJson")
      .mockResolvedValue("new-sha");

    await users.delete("1");
    expect(writeSpy).toHaveBeenCalledWith(
      "users.json",
      [],
      expect.any(String),
      "test-sha"
    );
  });

  describe("Edge Cases", () => {
    it("should return empty array if collection file does not exist", async () => {
      vi.spyOn(db.storage, "exists").mockResolvedValue(false);
      const result = await users.find();
      expect(result).toEqual([]);
    });

    it("should throw error if update item not found", async () => {
      vi.spyOn(db.storage, "exists").mockResolvedValue(true);
      vi.spyOn(db.storage, "readJson").mockResolvedValue({
        data: [],
        sha: "test-sha",
      });
      await expect(
        users.update("non-existent", { name: "New" })
      ).rejects.toThrow("not found");
    });

    it("should not call writeJson if delete item not found", async () => {
      vi.spyOn(db.storage, "exists").mockResolvedValue(true);
      vi.spyOn(db.storage, "readJson").mockResolvedValue({
        data: [],
        sha: "test-sha",
      });
      const writeSpy = vi.spyOn(db.storage, "writeJson");
      await users.delete("non-existent");
      expect(writeSpy).not.toHaveBeenCalled();
    });
  });
});
