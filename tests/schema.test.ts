import { describe, it, expect } from "vitest";
import { GitHubDB } from "../src/ui/github-db.js";

describe("Schema Definition & Collections", () => {
  const config = {
    accessToken: "test-token",
    owner: "test-owner",
    repo: "test-repo",
  };

  interface User {
    id: string;
    name: string;
    age: number;
  }

  it("should create a typed collection instance", () => {
    const db = new GitHubDB(config);
    const users = db.collection<User>("users");

    expect(users).toBeDefined();
    expect(users.name).toBe("users");
  });
});
