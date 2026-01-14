import { describe, it, expect, beforeEach, vi } from "vitest";
import { Collection } from "../src/ui/collection.js";
import { IStorageProvider, Middleware } from "../src/core/types.js";

describe("Middleware Support", () => {
  let mockStorage: IStorageProvider;

  beforeEach(() => {
    mockStorage = {
      testConnection: vi.fn(),
      exists: vi.fn().mockResolvedValue(true),
      readJson: vi.fn().mockResolvedValue({ data: [], sha: "test-sha" }),
      writeJson: vi.fn().mockResolvedValue("new-sha"),
      commit: vi.fn().mockResolvedValue("batch-sha"),
      deleteFile: vi.fn(),
      listDirectory: vi.fn(),
    };
  });

  it("should allow validation middleware to block saves", async () => {
    const validationMiddleware: Middleware<{ id: string; name: string }> = {
      beforeSave: (item) => {
        if (!item.name) throw new Error("Name is required");
        return item;
      },
    };

    const users = new Collection("users", mockStorage, [validationMiddleware]);

    await expect(users.create({ id: "1", name: "" })).rejects.toThrow(
      "Name is required"
    );
    expect(mockStorage.writeJson).not.toHaveBeenCalled();
  });

  it("should allow transformation middleware to modify items", async () => {
    const timestampMiddleware: Middleware<{
      id: string;
      name: string;
      updatedAt?: number;
    }> = {
      beforeSave: (item) => {
        return { ...item, updatedAt: 123456789 };
      },
    };

    const users = new Collection("users", mockStorage, [timestampMiddleware]);

    const result = await users.create({ id: "1", name: "Alice" });
    expect(result.updatedAt).toBe(123456789);
    expect(mockStorage.writeJson).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ updatedAt: 123456789 }),
      ]),
      expect.any(String),
      expect.any(String)
    );
  });

  it("should execute afterRead middleware", async () => {
    const transformMiddleware: Middleware<{ id: string; name: string }> = {
      afterRead: (item) => {
        return { ...item, name: item.name.toUpperCase() };
      },
    };

    mockStorage.readJson = vi.fn().mockResolvedValue({
      data: [{ id: "1", name: "alice" }],
      sha: "test-sha",
    });

    const users = new Collection("users", mockStorage, [transformMiddleware]);

    const result = await users.find();
    expect(result[0].name).toBe("ALICE");
  });

  it("should execute multiple middlewares in order", async () => {
    const logs: string[] = [];
    const mw1: Middleware<any> = {
      beforeSave: (item) => {
        logs.push("mw1");
        return item;
      },
    };
    const mw2: Middleware<any> = {
      beforeSave: (item) => {
        logs.push("mw2");
        return item;
      },
    };

    const users = new Collection("users", mockStorage, [mw1, mw2]);
    await users.create({ id: "1" });

    expect(logs).toEqual(["mw1", "mw2"]);
  });

  it("should execute middleware during update", async () => {
    const uppercaseMiddleware: Middleware<{ id: string; name: string }> = {
      beforeSave: (item) => {
        return { ...item, name: item.name.toUpperCase() };
      },
    };

    mockStorage.readJson = vi.fn().mockResolvedValue({
      data: [{ id: "1", name: "alice" }],
      sha: "test-sha",
    });

    const users = new Collection("users", mockStorage, [uppercaseMiddleware]);
    const result = await users.update("1", { name: "bob" });

    expect(result.name).toBe("BOB");
    expect(mockStorage.writeJson).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ name: "BOB" })]),
      expect.any(String),
      expect.any(String)
    );
  });
});
