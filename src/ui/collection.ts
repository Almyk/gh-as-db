import {
  IStorageProvider,
  Middleware,
  MiddlewareContext,
  QueryOptions,
  Schema,
} from "../core/types.js";

export class Collection<T extends Schema> {
  private lastSha: string | undefined;

  constructor(
    public readonly name: string,
    private readonly storage: IStorageProvider,
    private readonly middleware: Middleware<T>[] = []
  ) {}

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
    try {
      if (await this.storage.exists(this.path)) {
        const response = await this.storage.readJson<T[]>(this.path);
        items = response.data;
        this.lastSha = response.sha;
      }
    } catch (error) {
      // If file doesn't exist, start with empty array
    }

    items.push(finalItem);
    this.lastSha = await this.storage.writeJson(
      this.path,
      items,
      `Add item to ${this.name}`,
      this.lastSha
    );
    return finalItem;
  }

  async find(
    queryOrPredicate?: ((item: T) => boolean) | QueryOptions<T>
  ): Promise<T[]> {
    if (!(await this.storage.exists(this.path))) {
      return [];
    }
    const response = await this.storage.readJson<T[]>(this.path);
    this.lastSha = response.sha;
    let items = response.data;

    const context: MiddlewareContext = {
      collection: this.name,
      operation: "read",
    };

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
    // Assuming schema has an 'id' field for now, or we might need to enforce it
    const items = await this.find();
    return items.find((item: any) => item.id === id) || null;
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const items = await this.find();
    const index = items.findIndex((item: any) => item.id === id);
    if (index === -1) {
      throw new Error(`Item with id ${id} not found in ${this.name}`);
    }

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

    this.lastSha = await this.storage.writeJson(
      this.path,
      items,
      `Update item ${id} in ${this.name}`,
      this.lastSha
    );
    return items[index];
  }

  async delete(id: string): Promise<void> {
    const items = await this.find();
    const filtered = items.filter((item: any) => item.id !== id);
    if (filtered.length === items.length) {
      return; // Or throw error? Let's be idempotent for now.
    }
    this.lastSha = await this.storage.writeJson(
      this.path,
      filtered,
      `Delete item ${id} from ${this.name}`,
      this.lastSha
    );
  }
}
