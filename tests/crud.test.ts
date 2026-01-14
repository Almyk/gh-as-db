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
      .mockResolvedValue(undefined);

    const newUser = { id: "1", name: "Alice" };
    const result = await users.create(newUser);

    expect(result).toEqual(newUser);
    expect(writeSpy).toHaveBeenCalledWith(
      "users.json",
      [newUser],
      expect.any(String)
    );
  });

  it("should find items", async () => {
    const mockData = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    vi.spyOn(db.storage, "exists").mockResolvedValue(true);
    vi.spyOn(db.storage, "readJson").mockResolvedValue(mockData);

    const result = await users.find();
    expect(result).toEqual(mockData);
  });

  it("should find an item by id", async () => {
    const mockData = [{ id: "1", name: "Alice" }];
    vi.spyOn(db.storage, "exists").mockResolvedValue(true);
    vi.spyOn(db.storage, "readJson").mockResolvedValue(mockData);

    const result = await users.findById("1");
    expect(result).toEqual(mockData[0]);
  });

  it("should update an item", async () => {
    const mockData = [{ id: "1", name: "Alice" }];
    vi.spyOn(db.storage, "exists").mockResolvedValue(true);
    vi.spyOn(db.storage, "readJson").mockResolvedValue(mockData);
    const writeSpy = vi
      .spyOn(db.storage, "writeJson")
      .mockResolvedValue(undefined);

    const updated = await users.update("1", { name: "Alicia" });
    expect(updated.name).toBe("Alicia");
    expect(writeSpy).toHaveBeenCalledWith(
      "users.json",
      [{ id: "1", name: "Alicia" }],
      expect.any(String)
    );
  });

  it("should delete an item", async () => {
    const mockData = [{ id: "1", name: "Alice" }];
    vi.spyOn(db.storage, "exists").mockResolvedValue(true);
    vi.spyOn(db.storage, "readJson").mockResolvedValue(mockData);
    const writeSpy = vi
      .spyOn(db.storage, "writeJson")
      .mockResolvedValue(undefined);

    await users.delete("1");
    expect(writeSpy).toHaveBeenCalledWith("users.json", [], expect.any(String));
  });
});
