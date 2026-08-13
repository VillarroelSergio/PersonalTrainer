import { count, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createUserCommand, resetPasswordCommand } from "../scripts/manage-user";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { account, user } from "@/lib/db/schema";

const createdEmails = new Set<string>();

function uniqueEmail(label: string): string {
  const email = `manage-user-${label}-${crypto.randomUUID()}@example.test`;
  createdEmails.add(email);
  return email;
}

async function currentUserCount(): Promise<number> {
  const db = getDb();
  const [{ value }] = await db.select({ value: count() }).from(user);
  return value;
}

afterEach(async () => {
  const db = getDb();
  for (const email of createdEmails) {
    await db.delete(user).where(eq(user.email, email));
  }
  createdEmails.clear();
});

describe("createUserCommand", () => {
  it("creates the account and never echoes the password", async () => {
    const email = uniqueEmail("create-ok");
    const result = await createUserCommand({ name: "Ana", email, password: "temporary-123" }, createAuth(false));

    expect(result.ok).toBe(true);
    expect(result.message).toBe(`Cuenta creada para ${email}`);
    expect(result.message).not.toContain("temporary-123");

    const rows = await getDb().select().from(user).where(eq(user.email, email));
    expect(rows).toHaveLength(1);
  });

  it("rejects an empty name without touching the database", async () => {
    const email = uniqueEmail("empty-name");
    createdEmails.delete(email); // nothing should be created

    const before = await currentUserCount();
    const result = await createUserCommand({ name: "   ", email, password: "temporary-123" });
    const after = await currentUserCount();

    expect(result.ok).toBe(false);
    expect(after).toBe(before);
    expect(await getDb().select().from(user).where(eq(user.email, email))).toHaveLength(0);
  });

  it("rejects an invalid email without touching the database", async () => {
    const before = await currentUserCount();
    const result = await createUserCommand({ name: "Ana", email: "not-an-email", password: "temporary-123" });
    const after = await currentUserCount();

    expect(result.ok).toBe(false);
    expect(after).toBe(before);
  });

  it("rejects a password shorter than 8 characters without touching the database", async () => {
    const email = uniqueEmail("short-password");
    createdEmails.delete(email);

    const before = await currentUserCount();
    const result = await createUserCommand({ name: "Ana", email, password: "short" });
    const after = await currentUserCount();

    expect(result.ok).toBe(false);
    expect(after).toBe(before);
    expect(await getDb().select().from(user).where(eq(user.email, email))).toHaveLength(0);
  });

  it("rejects account creation once the pilot account limit would be exceeded", async () => {
    const email = uniqueEmail("over-limit");
    createdEmails.delete(email);

    const currentTotal = await currentUserCount();
    const previousLimit = process.env.PILOT_ACCOUNT_LIMIT;
    process.env.PILOT_ACCOUNT_LIMIT = String(currentTotal); // any new account would exceed this
    try {
      const result = await createUserCommand({ name: "Ana", email, password: "temporary-123" });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/techo de cuentas/i);
      expect(await getDb().select().from(user).where(eq(user.email, email))).toHaveLength(0);
    } finally {
      if (previousLimit === undefined) delete process.env.PILOT_ACCOUNT_LIMIT;
      else process.env.PILOT_ACCOUNT_LIMIT = previousLimit;
    }
  });
});

describe("resetPasswordCommand", () => {
  it("changes the stored credential hash for an existing account", async () => {
    const email = uniqueEmail("reset-ok");
    await createUserCommand({ name: "Ana", email, password: "temporary-123" }, createAuth(false));

    const [beforeRow] = await getDb()
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    const [beforeAccount] = await getDb()
      .select({ password: account.password })
      .from(account)
      .where(eq(account.userId, beforeRow.id));

    const result = await resetPasswordCommand({ email, password: "nueva-contra-123" });

    expect(result.ok).toBe(true);
    expect(result.message).toBe(`Contraseña actualizada para ${email}`);
    expect(result.message).not.toContain("nueva-contra-123");

    const [afterAccount] = await getDb()
      .select({ password: account.password })
      .from(account)
      .where(eq(account.userId, beforeRow.id));
    expect(afterAccount.password).not.toBe(beforeAccount.password);
  });

  it("fails with a clear message and does not create a user when the email does not exist", async () => {
    const email = uniqueEmail("reset-missing");
    createdEmails.delete(email); // no account should ever exist for this email

    const before = await currentUserCount();
    const result = await resetPasswordCommand({ email, password: "nueva-contra-123" });
    const after = await currentUserCount();

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no existe/i);
    expect(after).toBe(before);
  });
});
