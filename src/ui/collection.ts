import { IStorageProvider, Schema } from "../core/types.js";

export class Collection<T extends Schema> {
  constructor(
    public readonly name: string,
    private readonly storage: IStorageProvider
  ) {}

  private get path(): string {
    return `${this.name}.json`;
  }

  async create(item: T): Promise<T> {
    let items: T[] = [];
    try {
      if (await this.storage.exists(this.path)) {
        items = await this.storage.readJson<T[]>(this.path);
      }
    } catch (error) {
      // If file doesn't exist, start with empty array
    }

    items.push(item);
    await this.storage.writeJson(this.path, items, `Add item to ${this.name}`);
    return item;
  }

  async find(predicate?: (item: T) => boolean): Promise<T[]> {
    if (!(await this.storage.exists(this.path))) {
      return [];
    }
    const items = await this.storage.readJson<T[]>(this.path);
    return predicate ? items.filter(predicate) : items;
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
    await this.storage.writeJson(
      this.path,
      items,
      `Update item ${id} in ${this.name}`
    );
    return items[index];
  }

  async delete(id: string): Promise<void> {
    const items = await this.find();
    const filtered = items.filter((item: any) => item.id !== id);
    if (filtered.length === items.length) {
      return; // Or throw error? Let's be idempotent for now.
    }
    await this.storage.writeJson(
      this.path,
      filtered,
      `Delete item ${id} from ${this.name}`
    );
  }
}
