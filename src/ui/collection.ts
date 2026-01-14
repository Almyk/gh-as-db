import { Schema } from "../core/types.js";

export class Collection<T extends Schema> {
  constructor(public readonly name: string) {}
}
