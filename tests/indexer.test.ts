import { describe, it, expect, beforeEach } from "vitest";
import { Indexer } from "../src/core/indexer.js";

describe("Indexer", () => {
  let indexer: Indexer<{ id: string; name: string }>;

  beforeEach(() => {
    indexer = new Indexer();
  });

  it("should return null when querying non-existent index", () => {
    expect(indexer.query("name", "Alice")).toBeNull();
  });

  it("should return empty array when no matches found in existing index", () => {
    indexer.build([{ id: "1", name: "Alice" }], ["name"]);
    expect(indexer.query("name", "Bob")).toEqual([]);
  });

  it("should clear all indexes", () => {
    indexer.build([{ id: "1", name: "Alice" }], ["name"]);
    expect(indexer.hasIndex("name")).toBe(true);
    indexer.clear();
    expect(indexer.hasIndex("name")).toBe(false);
  });

  it("should handle updating items", () => {
    const item1 = { id: "1", name: "Alice" };
    const item2 = { id: "1", name: "Alicia" };
    indexer.build([item1], ["name"]);

    indexer.update(item1, item2);
    expect(indexer.query("name", "Alice")).toEqual([]);
    expect(indexer.query("name", "Alicia")).toEqual([item2]);
  });

  it("should handle removing non-existent items", () => {
    const item = { id: "1", name: "Alice" };
    indexer.build([], ["name"]); // Empty index but with 'name' field
    expect(() => indexer.remove(item)).not.toThrow();
  });
});
