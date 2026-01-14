import { describe, it, expect, beforeEach, vi } from "vitest";
import { Collection } from "../src/ui/collection.js";
import { IStorageProvider } from "../src/core/types.js";

describe("Collection Filtering", () => {
    let mockStorage: IStorageProvider;
    let collection: Collection<any>;

    beforeEach(() => {
        mockStorage = {
            testConnection: vi.fn().mockResolvedValue(true),
            exists: vi.fn().mockResolvedValue(true),
            readJson: vi.fn(),
            writeJson: vi.fn().mockResolvedValue("new-sha"),
        };
        collection = new Collection("items", mockStorage);
    });

    it("should filter using 'contains' operator on string fields", async () => {
        const data = [
            { id: "1", tags: "admin,user" },
            { id: "2", tags: "user" },
        ];
        (mockStorage.readJson as any).mockResolvedValue({
            data,
            sha: "test-sha",
        });

        const results = await collection.find({
            filters: [{ field: "tags", operator: "contains", value: "admin" }],
        });

        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("1");
    });

    it("should filter using 'contains' operator on array fields", async () => {
        const data = [
            { id: "1", tags: ["admin", "user"] },
            { id: "2", tags: ["user"] },
            { id: "3", tags: ["guest"] },
        ];
        (mockStorage.readJson as any).mockResolvedValue({
            data,
            sha: "test-sha",
        });

        const results = await collection.find({
            filters: [{ field: "tags", operator: "contains", value: "admin" }],
        });

        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("1");
    });
});
