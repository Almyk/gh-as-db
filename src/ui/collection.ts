import {
  ConcurrencyError,
  IStorageProvider,
  Middleware,
  MiddlewareContext,
  QueryOptions,
  Schema,
  StorageStrategy,
  Validator,
} from "../core/types.js";
import { Indexer } from "../core/indexer.js";

export class Collection<T extends Schema> {
  private lastSha: string | undefined;
  private indexer = new Indexer<T>();
  private items: T[] = [];
  private dataLoaded = false;

  private readonly middleware: Middleware<T>[];
  private readonly validator?: Validator<T>;
  private readonly strategy: StorageStrategy;

  constructor(
    public readonly name: string,
    private readonly storage: IStorageProvider,
    options: {
      middleware?: Middleware<T>[];
      validator?: Validator<T>;
      strategy?: StorageStrategy;
    } | Middleware<T>[] = []
  ) {
    if (Array.isArray(options)) {
      this.middleware = options;
      this.strategy = "single-file";
    } else {
      this.middleware = options.middleware || [];
      this.validator = options.validator;
      this.strategy = options.strategy || "single-file";
    }
  }

  private get path(): string {
    return `${this.name}.json`;
  }

  async create(item: T): Promise<T> {
    let finalItem = item;
    const context: MiddlewareContext = {
      collection: this.name,
      operation: "create",
    };

    for (const mw of this.middleware) {
      if (mw.beforeSave) {
        finalItem = await mw.beforeSave(finalItem, context);
      }
    }

    let items: T[] = [];
    if (this.dataLoaded) {
      items = [...this.items];
    } else {
      try {
        if (await this.storage.exists(this.path)) {
          const response = await this.storage.readJson<T[]>(this.path);
          items = response.data;
          this.lastSha = response.sha;
        }
      } catch (error) {
        // If file doesn't exist, start with empty array
      }
    }

    items.push(finalItem);
    try {
      this.lastSha = await this.storage.writeJson(
        this.path,
        items,
        `Add item to ${this.name}`,
        this.lastSha
      );
    } catch (error) {
      if (error instanceof ConcurrencyError) {
        this.dataLoaded = false;
      }
      throw error;
    }

    // Update in-memory state if already loaded
    if (this.dataLoaded) {
      this.items = items;
      this.indexer.add(finalItem);
    }

    return finalItem;
  }

  async find(
    queryOrPredicate?: ((item: T) => boolean) | QueryOptions<T>
  ): Promise<T[]> {
    if (!(await this.storage.exists(this.path))) {
      return [];
    }

    let items: T[];
    const context: MiddlewareContext = {
      collection: this.name,
      operation: "read",
    };

    // Use cached/indexed data if available
    if (this.dataLoaded) {
      // If it's an 'eq' filter we can potentially use index directly
      if (
        typeof queryOrPredicate !== "function" &&
        queryOrPredicate?.filters &&
        queryOrPredicate.filters.length === 1 &&
        queryOrPredicate.filters[0].operator === "eq" &&
        this.indexer.hasIndex(queryOrPredicate.filters[0].field)
      ) {
        const filter = queryOrPredicate.filters[0];
        const results = this.indexer.query(filter.field, filter.value);
        if (results !== null) {
          return results;
        }
      }

      // Fallback to full scan of current in-memory items
      if (typeof queryOrPredicate === "function") {
        return this.items.filter(queryOrPredicate);
      }
      if (queryOrPredicate) {
        return this.applyQueryOptions(this.items, queryOrPredicate);
      }
      return this.items;
    }

    const response = await this.storage.readJson<T[]>(this.path);
    this.lastSha = response.sha;
    items = response.data;

    items = await Promise.all(
      items.map(async (item) => {
        let currentItem = item;
        for (const mw of this.middleware) {
          if (mw.afterRead) {
            currentItem = await mw.afterRead(currentItem, context);
          }
        }
        return currentItem;
      })
    );

    // Build index and store in-memory items
    if (!this.dataLoaded) {
      this.items = items;
      this.indexer.build(
        items,
        items.length > 0 ? (Object.keys(items[0]) as (keyof T)[]) : []
      );
      this.dataLoaded = true;
    }

    if (typeof queryOrPredicate === "function") {
      return items.filter(queryOrPredicate);
    }

    if (queryOrPredicate) {
      return this.applyQueryOptions(items, queryOrPredicate);
    }

    return items;
  }

  private applyQueryOptions(items: T[], options: QueryOptions<T>): T[] {
    let result = [...items];

    // Apply filters
    if (options.filters) {
      for (const filter of options.filters) {
        result = result.filter((item) => {
          const val = item[filter.field];
          switch (filter.operator) {
            case "eq":
              return val === filter.value;
            case "neq":
              return val !== filter.value;
            case "gt":
              return val > filter.value;
            case "gte":
              return val >= filter.value;
            case "lt":
              return val < filter.value;
            case "lte":
              return val <= filter.value;
            case "contains":
              if (Array.isArray(val)) {
                return val.includes(filter.value);
              }
              return (
                typeof val === "string" && val.includes(filter.value as string)
              );
            case "in":
              return Array.isArray(filter.value) && filter.value.includes(val);
            default:
              return true;
          }
        });
      }
    }

    // Apply sorting
    if (options.sort) {
      for (const sort of options.sort) {
        result.sort((a, b) => {
          const aVal = a[sort.field];
          const bVal = b[sort.field];
          if (aVal < bVal) return sort.order === "asc" ? -1 : 1;
          if (aVal > bVal) return sort.order === "asc" ? 1 : -1;
          return 0;
        });
      }
    }

    // Apply pagination
    if (options.pagination) {
      const { limit, offset = 0 } = options.pagination;
      result = result.slice(offset, limit ? offset + limit : undefined);
    }

    return result;
  }

  async findById(id: string): Promise<T | null> {
    if (this.dataLoaded && this.indexer.hasIndex("id" as keyof T)) {
      const results = this.indexer.query("id" as keyof T, id);
      return results && results.length > 0 ? results[0] : null;
    }
    const items = await this.find();
    return items.find((item: any) => item.id === id) || null;
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const items = await this.find();
    const index = items.findIndex((item: any) => item.id === id);
    if (index === -1) {
      throw new Error(`Item with id ${id} not found in ${this.name}`);
    }

    const originalItem = items[index];
    items[index] = { ...items[index], ...updates };

    let finalItem = items[index];
    const context: MiddlewareContext = {
      collection: this.name,
      operation: "update",
    };

    for (const mw of this.middleware) {
      if (mw.beforeSave) {
        finalItem = await mw.beforeSave(finalItem, context);
      }
    }
    items[index] = finalItem;

    try {
      this.lastSha = await this.storage.writeJson(
        this.path,
        items,
        `Update item ${id} in ${this.name}`,
        this.lastSha
      );
    } catch (error) {
      if (error instanceof ConcurrencyError) {
        this.dataLoaded = false;
      }
      throw error;
    }

    if (this.dataLoaded) {
      this.items = items;
      this.indexer.update(originalItem, finalItem);
    }

    return items[index];
  }

  async delete(id: string): Promise<void> {
    const items = await this.find();
    const index = items.findIndex((item: any) => item.id === id);
    if (index === -1) {
      return;
    }

    const itemToDelete = items[index];
    const filtered = items.filter((_, i) => i !== index);

    try {
      this.lastSha = await this.storage.writeJson(
        this.path,
        filtered,
        `Delete item ${id} from ${this.name}`,
        this.lastSha
      );
    } catch (error) {
      if (error instanceof ConcurrencyError) {
        this.dataLoaded = false;
      }
      throw error;
    }

    if (this.dataLoaded) {
      this.items = filtered;
      this.indexer.remove(itemToDelete);
    }
  }
}
