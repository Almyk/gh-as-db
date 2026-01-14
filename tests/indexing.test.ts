import { describe, it, expect, beforeEach, vi } from "vitest";
import { Collection } from "../src/ui/collection.js";
import { IStorageProvider } from "../src/core/types.js";

describe("Collection Indexing", () => {
  let mockStorage: IStorageProvider;
  let collection: Collection<{ id: string; name: string; age: number }>;

  let testData: { id: string; name: string; age: number }[];

  beforeEach(() => {
    testData = [
      { id: "1", name: "Alice", age: 30 },
      { id: "2", name: "Bob", age: 25 },
      { id: "3", name: "Charlie", age: 35 },
    ];
    mockStorage = {
      testConnection: vi.fn(),
      exists: vi.fn().mockResolvedValue(true),
      readJson: vi
        .fn()
        .mockImplementation(async () => ({
          data: [...testData],
          sha: "test-sha",
        })),
      writeJson: vi.fn().mockResolvedValue("new-sha"),
    };
    collection = new Collection("users", mockStorage);
  });

  it("should use index for findById and not call storage multiple times", async () => {
    collection = new Collection("users", mockStorage);

    // First call should read from storage
    await collection.findById("1");
    expect(mockStorage.readJson).toHaveBeenCalledTimes(1);

    // Second call should come from index/cache and NOT call readJson again
    // (Assuming we use the index build during first find)
    await collection.findById("2");
    expect(mockStorage.readJson).toHaveBeenCalledTimes(1);
  });

  it("should sync index after create", async () => {
    collection = new Collection("users", mockStorage);
    await collection.find(); // Load and build index
    expect(mockStorage.readJson).toHaveBeenCalledTimes(1);

    const newUser = { id: "4", name: "David", age: 40 };
    await collection.create(newUser);

    // Should find David via index without calling readJson again
    const results = await collection.find({
      filters: [{ field: "name", operator: "eq", value: "David" }],
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("David");
    expect(mockStorage.readJson).toHaveBeenCalledTimes(1);
  });

  it("should sync index after update", async () => {
    collection = new Collection("users", mockStorage);
    await collection.find();

    await collection.update("1", { name: "Alicia" });

    // Old name should not return results via index
    const oldResults = await collection.find({
      filters: [{ field: "name", operator: "eq", value: "Alice" }],
    });
    expect(oldResults).toHaveLength(0);

    // New name should return results via index
    const newResults = await collection.find({
      filters: [{ field: "name", operator: "eq", value: "Alicia" }],
    });
    expect(newResults).toHaveLength(1);
    expect(newResults[0].id).toBe("1");
    expect(mockStorage.readJson).toHaveBeenCalledTimes(1);
  });

  it("should sync index after delete", async () => {
    collection = new Collection("users", mockStorage);
    await collection.find();

    await collection.delete("1");

    const results = await collection.find({
      filters: [{ field: "name", operator: "eq", value: "Alice" }],
    });
    expect(results).toHaveLength(0);
    expect(mockStorage.readJson).toHaveBeenCalledTimes(1);
  });

  it("should invalidate cache/index on ConcurrencyError", async () => {
    const { ConcurrencyError } = await import("../src/core/types.js");
    collection = new Collection("users", mockStorage);
    await collection.find();
    expect(mockStorage.readJson).toHaveBeenCalledTimes(1);

    // Simulate concurrency conflict
    vi.spyOn(mockStorage, "writeJson").mockRejectedValueOnce(
      new ConcurrencyError("users.json")
    );

    await expect(collection.update("1", { name: "Conflict" })).rejects.toThrow(
      ConcurrencyError
    );

    // Next call to find should refresh from storage because cache was invalidated
    await collection.find();
    expect(mockStorage.readJson).toHaveBeenCalledTimes(2);
  });
});
