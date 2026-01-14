import { Schema } from "./types.js";

export class Indexer<T extends Schema> {
  private indexes = new Map<keyof T, Map<any, Set<T>>>();

  build(items: T[], fields: (keyof T)[]) {
    this.indexes.clear();
    for (const field of fields) {
      const fieldIndex = new Map<any, Set<T>>();
      for (const item of items) {
        const val = item[field];
        if (!fieldIndex.has(val)) {
          fieldIndex.set(val, new Set());
        }
        fieldIndex.get(val)!.add(item);
      }
      this.indexes.set(field, fieldIndex);
    }
  }

  query(field: keyof T, value: any): T[] | null {
    const fieldIndex = this.indexes.get(field);
    if (!fieldIndex) return null;

    const matches = fieldIndex.get(value);
    return matches ? Array.from(matches) : [];
  }

  add(item: T) {
    for (const [field, fieldIndex] of this.indexes) {
      const val = item[field];
      if (!fieldIndex.has(val)) {
        fieldIndex.set(val, new Set());
      }
      fieldIndex.get(val)!.add(item);
    }
  }

  remove(item: T) {
    for (const [field, fieldIndex] of this.indexes) {
      const val = item[field];
      const matches = fieldIndex.get(val);
      if (matches) {
        matches.delete(item);
      }
    }
  }

  update(oldItem: T, newItem: T) {
    this.remove(oldItem);
    this.add(newItem);
  }

  clear() {
    this.indexes.clear();
  }

  hasIndex(field: keyof T): boolean {
    return this.indexes.has(field);
  }
}
