import { pathToFileURL } from "node:url";
import { and, count, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { createAuth } from "@/lib/auth";
import { getDb, getSql } from "@/lib/db/client";
import { account, user } from "@/lib/db/schema";

/**
 * Local operator CLI for pilot account management (create / reset-password).
 * Never imported from application code that runs on Vercel — standalone only,
 * run via `npm run user:create` / `npm run user:reset-password` (tsx).
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const DEFAULT_PILOT_ACCOUNT_LIMIT = 5;

export interface CommandResult {
  ok: boolean;
  message: string;
}

interface RawInput {
  name?: string;
  email?: string;
  password?: string;
}

function pilotAccountLimit(): number {
  const raw = process.env.PILOT_ACCOUNT_LIMIT;
  const parsed = raw ? Number(raw) : DEFAULT_PILOT_ACCOUNT_LIMIT;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PILOT_ACCOUNT_LIMIT;
}

function validateEmail(email: string | undefined): string | null {
  const trimmed = (email ?? "").trim();
  return EMAIL_REGEX.test(trimmed) ? trimmed : null;
}

function validatePassword(password: string | undefined): string | null {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH ? password : null;
}

/** Never includes the operator's input (email/password) or a stack trace — only a fixed safe message, plus the one better-auth error code we recognize. */
function safeErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { body?: { code?: string } } | undefined)?.body?.code;
  if (code === "USER_ALREADY_EXISTS") return "Ya existe una cuenta con ese email.";
  return fallback;
}

export async function createUserCommand(input: RawInput, authInstance = createAuth(false)): Promise<CommandResult> {
  const name = (input.name ?? "").trim();
  const email = validateEmail(input.email);
  const password = validatePassword(input.password);

  if (!name) return { ok: false, message: "El nombre no puede estar vacío." };
  if (!email) return { ok: false, message: "El email no tiene un formato válido." };
  if (!password) return { ok: false, message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` };

  const db = getDb();
  const limit = pilotAccountLimit();

  let currentCount: number;
  try {
    [{ value: currentCount }] = await db.select({ value: count() }).from(user);
  } catch {
    return { ok: false, message: "No se pudo comprobar el número de cuentas existentes." };
  }
  if (currentCount + 1 > limit) {
    return { ok: false, message: `Se alcanzó el techo de cuentas piloto (${limit}). No se creó ninguna cuenta.` };
  }

  try {
    await authInstance.api.signUpEmail({ body: { name, email, password } });
  } catch (error) {
    return { ok: false, message: safeErrorMessage(error, "No se pudo crear la cuenta.") };
  }

  return { ok: true, message: `Cuenta creada para ${email}` };
}

/**
 * Better Auth exposes no admin-context "set password without knowing the
 * old one" endpoint: `changePassword` needs currentPassword, `setPassword`
 * needs an active session for that exact user. Both are for a logged-in
 * user acting on themselves, not an operator resetting someone else's
 * account from the CLI. Instead this hashes with the same algorithm Better
 * Auth uses internally (`better-auth/crypto`'s `hashPassword`, scrypt) and
 * writes it straight into the `account` row (providerId "credential") via
 * the Drizzle adapter's own tables — the documented, stable public surface.
 */
export async function resetPasswordCommand(input: RawInput): Promise<CommandResult> {
  const email = validateEmail(input.email);
  const password = validatePassword(input.password);

  if (!email) return { ok: false, message: "El email no tiene un formato válido." };
  if (!password) return { ok: false, message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` };

  const db = getDb();
  let existingUser: { id: string } | undefined;
  try {
    [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  } catch {
    return { ok: false, message: "No se pudo comprobar la cuenta." };
  }
  if (!existingUser) {
    return { ok: false, message: "No existe ninguna cuenta con ese email." };
  }

  try {
    const hash = await hashPassword(password);
    const updated = await db
      .update(account)
      .set({ password: hash, updatedAt: new Date() })
      .where(and(eq(account.userId, existingUser.id), eq(account.providerId, "credential")))
      .returning({ id: account.id });

    if (updated.length === 0) {
      return { ok: false, message: "La cuenta no tiene credenciales de email/contraseña que resetear." };
    }
  } catch {
    return { ok: false, message: "No se pudo actualizar la contraseña." };
  }

  return { ok: true, message: `Contraseña actualizada para ${email}` };
}

function parseFlags(args: string[]): RawInput {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!key?.startsWith("--")) continue;
    flags[key.slice(2)] = args[i + 1] ?? "";
  }
  return flags;
}

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  let result: CommandResult;
  if (subcommand === "create") {
    result = await createUserCommand(flags);
  } else if (subcommand === "reset-password") {
    result = await resetPasswordCommand(flags);
  } else {
    result = { ok: false, message: 'Subcomando desconocido. Usa "create" o "reset-password".' };
  }

  if (result.ok) console.log(result.message);
  else {
    console.error(result.message);
    process.exitCode = 1;
  }

  await getSql().end().catch(() => {});
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) void main();
