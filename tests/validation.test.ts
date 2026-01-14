import { describe, it, expect, beforeEach, vi } from "vitest";
import { Collection } from "../src/ui/collection.js";
import { IStorageProvider, Validator } from "../src/core/types.js";

describe("Flexible Schema Validation", () => {
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

  interface User {
    id: string;
    name: string;
    email?: string;
  }

  it("should validate items during create", async () => {
    const userValidator: Validator<User> = {
      validate: (data: any) => {
        if (!data.name) throw new Error("Name is required");
        return data as User;
      },
    };

    const users = new Collection<User>("users", mockStorage, {
      validator: userValidator,
    });

    await expect(users.create({ id: "1", name: "" })).rejects.toThrow(
      "Name is required"
    );
    expect(mockStorage.writeJson).not.toHaveBeenCalled();

    const validUser = { id: "2", name: "Alice" };
    const result = await users.create(validUser);
    expect(result).toEqual(validUser);
    expect(mockStorage.writeJson).toHaveBeenCalled();
  });

  it("should validate items during update", async () => {
    const userValidator: Validator<User> = {
      validate: (data: any) => {
        if (data.name === "INVALID") throw new Error("Invalid name");
        return data as User;
      },
    };

    mockStorage.readJson = vi.fn().mockResolvedValue({
      data: [{ id: "1", name: "Alice" }],
      sha: "test-sha",
    });

    const users = new Collection<User>("users", mockStorage, {
      validator: userValidator,
    });

    await expect(users.update("1", { name: "INVALID" })).rejects.toThrow(
      "Invalid name"
    );
    expect(mockStorage.writeJson).not.toHaveBeenCalled();

    const result = await users.update("1", { name: "Bob" });
    expect(result.name).toBe("Bob");
    expect(mockStorage.writeJson).toHaveBeenCalled();
  });

  it("should support async validation", async () => {
    const asyncValidator: Validator<User> = {
      validate: async (data: any) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (data.id === "taken") throw new Error("ID already taken");
        return data as User;
      },
    };

    const users = new Collection<User>("users", mockStorage, {
      validator: asyncValidator,
    });

    await expect(users.create({ id: "taken", name: "Alice" })).rejects.toThrow(
      "ID already taken"
    );
  });

  it("should support transformation during validation (like Zod)", async () => {
    const transformingValidator: Validator<User> = {
      validate: (data: any) => {
        return {
          ...data,
          name: data.name.trim().toUpperCase(),
        };
      },
    };

    const users = new Collection<User>("users", mockStorage, {
      validator: transformingValidator,
    });

    const result = await users.create({ id: "1", name: "  alice  " });
    expect(result.name).toBe("ALICE");
  });

  it("should work alongside middleware", async () => {
    const validationLog: string[] = [];

    const validator: Validator<User> = {
      validate: (data: any) => {
        validationLog.push("validated");
        return data;
      },
    };

    const middleware = {
      beforeSave: (item: User) => {
        validationLog.push("middleware");
        return item;
      },
    };

    const users = new Collection<User>("users", mockStorage, {
      validator,
      middleware: [middleware],
    });

    await users.create({ id: "1", name: "Alice" });
    expect(validationLog).toEqual(["validated", "middleware"]);
  });
});
