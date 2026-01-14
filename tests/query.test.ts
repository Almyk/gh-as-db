import { describe, it, expect, beforeEach, vi } from "vitest";
import { Collection } from "../src/ui/collection.js";
import { IStorageProvider } from "../src/core/types.js";

describe("Collection Advanced Querying", () => {
  let mockStorage: IStorageProvider;
  let collection: Collection<{ id: string; name: string; age: number }>;

  const testData = [
    { id: "1", name: "Alice", age: 30 },
    { id: "2", name: "Bob", age: 25 },
    { id: "3", name: "Charlie", age: 35 },
    { id: "4", name: "David", age: 20 },
  ];

  beforeEach(() => {
    mockStorage = {
      testConnection: vi.fn(),
      exists: vi.fn().mockResolvedValue(true),
      readJson: vi.fn().mockResolvedValue({ data: testData, sha: "test-sha" }),
      writeJson: vi.fn().mockResolvedValue("new-sha"),
      commit: vi.fn().mockResolvedValue("batch-sha"),
      deleteFile: vi.fn(),
      listDirectory: vi.fn(),
    };
    collection = new Collection("users", mockStorage);
  });

  describe("Filtering", () => {
    it("should filter by equality (eq)", async () => {
      const results = await collection.find({
        filters: [{ field: "name", operator: "eq", value: "Alice" }],
      });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Alice");
    });

    it("should filter by inequality (neq)", async () => {
      const results = await collection.find({
        filters: [{ field: "name", operator: "neq", value: "Alice" }],
      });
      expect(results).toHaveLength(3);
    });

    it("should filter by greater than (gt)", async () => {
      const results = await collection.find({
        filters: [{ field: "age", operator: "gt", value: 25 }],
      });
      expect(results).toHaveLength(2); // Alice (30) and Charlie (35)
    });

    it("should filter by contains", async () => {
      const results = await collection.find({
        filters: [{ field: "name", operator: "contains", value: "li" }],
      });
      expect(results).toHaveLength(2); // Alice and Charlie
    });

    it("should filter by in", async () => {
      const results = await collection.find({
        filters: [{ field: "name", operator: "in", value: ["Alice", "Bob"] }],
      });
      expect(results).toHaveLength(2);
    });

    it("should filter by greater than or equal (gte)", async () => {
      const results = await collection.find({
        filters: [{ field: "age", operator: "gte", value: 30 }],
      });
      expect(results).toHaveLength(2); // Alice (30) and Charlie (35)
    });

    it("should filter by less than (lt)", async () => {
      const results = await collection.find({
        filters: [{ field: "age", operator: "lt", value: 25 }],
      });
      expect(results).toHaveLength(1); // David (20)
    });

    it("should filter by less than or equal (lte)", async () => {
      const results = await collection.find({
        filters: [{ field: "age", operator: "lte", value: 25 }],
      });
      expect(results).toHaveLength(2); // Bob (25) and David (20)
    });

    it("should use predicate function with loaded data", async () => {
      await collection.find(); // Load data
      const results = await collection.find((item) => item.age > 30);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Charlie");
    });

    it("should filter, sort, and paginate with already loaded data", async () => {
      await collection.find(); // Load data initially
      const results = await collection.find({
        filters: [{ field: "age", operator: "gt", value: 20 }],
        sort: [{ field: "age", order: "desc" }],
        pagination: { limit: 2 },
      });
      // Alice (30), Bob (25), Charlie (35) - David (20) excluded
      // Sorted desc: Charlie (35), Alice (30), Bob (25)
      // Limit 2: Charlie, Alice
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Charlie");
      expect(results[1].name).toBe("Alice");
    });

    it("should use predicate function with unloaded data", async () => {
      const localCollection = new Collection("unloaded", mockStorage);
      const results = await localCollection.find((item) => item.age === 20);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("David");
    });
  });

  describe("Sorting", () => {
    it("should sort by age ascending", async () => {
      const results = await collection.find({
        sort: [{ field: "age", order: "asc" }],
      });
      expect(results[0].age).toBe(20);
      expect(results[3].age).toBe(35);
    });

    it("should sort by age descending", async () => {
      const results = await collection.find({
        sort: [{ field: "age", order: "desc" }],
      });
      expect(results[0].age).toBe(35);
      expect(results[3].age).toBe(20);
    });

    it("should handle equal values when sorting", async () => {
      const dataWithEqualAges = [
        { id: "1", name: "Alice", age: 30 },
        { id: "2", name: "Bob", age: 30 },
      ];
      vi.spyOn(mockStorage, "readJson").mockResolvedValueOnce({
        data: dataWithEqualAges,
        sha: "sha",
      });
      const localCollection = new Collection("equal", mockStorage);
      const results = await localCollection.find({
        sort: [{ field: "age", order: "asc" }],
      });
      expect(results).toHaveLength(2);
      expect(results[0].age).toBe(30);
      expect(results[1].age).toBe(30);
    });
  });

  describe("Pagination", () => {
    it("should apply limit", async () => {
      const results = await collection.find({
        pagination: { limit: 2 },
      });
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("1");
      expect(results[1].id).toBe("2");
    });

    it("should apply offset", async () => {
      const results = await collection.find({
        pagination: { offset: 2 },
      });
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("3");
      expect(results[1].id).toBe("4");
    });

    it("should apply limit and offset", async () => {
      const results = await collection.find({
        pagination: { limit: 1, offset: 1 },
      });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("2");
    });
  });

  describe("Combined Queries", () => {
    it("should filter, sort, and paginate together", async () => {
      const results = await collection.find({
        filters: [{ field: "age", operator: "gt", value: 20 }],
        sort: [{ field: "age", order: "asc" }],
        pagination: { limit: 1, offset: 1 },
      });
      // After filter: Alice(30), Bob(25), Charlie(35)
      // After sort: Bob(25), Alice(30), Charlie(35)
      // After pagination (limit 1, offset 1): Alice(30)
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Alice");
    });
  });
});
