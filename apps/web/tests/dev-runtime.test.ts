import { describe, expect, it } from "vitest";
import {
  buildDockerRunArgs,
  isLocalDatabaseUrl,
  parseEnvFile
} from "../../../scripts/dev";

describe("local dev runtime", () => {
  it("parses dotenv values without exposing comments or surrounding quotes", () => {
    expect(parseEnvFile(`
      # local database
      DATABASE_URL="postgres://postgres:trainer@localhost:55432/trainer_test"
      EMPTY=
      IGNORED_LINE
    `)).toEqual({
      DATABASE_URL: "postgres://postgres:trainer@localhost:55432/trainer_test",
      EMPTY: ""
    });
  });

  it("only treats loopback Postgres as the disposable development database", () => {
    expect(isLocalDatabaseUrl("postgres://postgres:trainer@localhost:55432/trainer_test")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://postgres:trainer@127.0.0.1:55432/trainer_test")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://user:password@db.example.com:5432/trainer")).toBe(false);
  });

  it("builds a repeatable Postgres container command", () => {
    expect(buildDockerRunArgs({
      containerName: "trainer-postgres",
      image: "postgres:16-alpine",
      databaseName: "trainer_test",
      username: "postgres",
      password: "trainer",
      hostPort: 55432
    })).toEqual([
      "run",
      "--name",
      "trainer-postgres",
      "--restart",
      "unless-stopped",
      "-e",
      "POSTGRES_USER=postgres",
      "-e",
      "POSTGRES_PASSWORD=trainer",
      "-e",
      "POSTGRES_DB=trainer_test",
      "-p",
      "55432:5432",
      "-d",
      "postgres:16-alpine"
    ]);
  });
});
