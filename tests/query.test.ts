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
