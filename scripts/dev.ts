import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export type LocalDatabaseConfig = {
  containerName: string;
  image: string;
  databaseName: string;
  username: string;
  password: string;
  hostPort: number;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CONTAINER_NAME = "trainer-postgres";
const DEFAULT_IMAGE = "postgres:16-alpine";

export function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.trim();
    values[key] = value.replace(/^("|')(.*)\1$/, "$2");
  }

  return values;
}

export function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    return (url.protocol === "postgres:" || url.protocol === "postgresql:")
      && (url.hostname === "localhost" || url.hostname === "127.0.0.1")
      && Number(url.port || 5432) === 55432;
  } catch {
    return false;
  }
}

export function buildDockerRunArgs(config: LocalDatabaseConfig): string[] {
  return [
    "run",
    "--name",
    config.containerName,
    "--restart",
    "unless-stopped",
    "-e",
    `POSTGRES_USER=${config.username}`,
    "-e",
    `POSTGRES_PASSWORD=${config.password}`,
    "-e",
    `POSTGRES_DB=${config.databaseName}`,
    "-p",
    `${config.hostPort}:5432`,
    "-d",
    config.image
  ];
}

function readLocalEnvironment(): NodeJS.ProcessEnv {
  const fromFiles = [".env", ".env.local"].reduce<Record<string, string>>((values, filename) => {
    const envPath = path.join(ROOT, "apps", "web", filename);
    if (!existsSync(envPath)) return values;
    return { ...values, ...parseEnvFile(readFileSync(envPath, "utf8")) };
  }, {});

  return { ...fromFiles, ...process.env };
}

function localDatabaseConfig(databaseUrl: string): LocalDatabaseConfig {
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const username = decodeURIComponent(url.username || "postgres");
  const password = decodeURIComponent(url.password || "trainer");
  const hostPort = Number(url.port || 5432);

  if (!databaseName || !Number.isInteger(hostPort) || hostPort < 1 || hostPort > 65535) {
    throw new Error("DATABASE_URL no contiene una base de datos o puerto válidos.");
  }

  return {
    containerName: DEFAULT_CONTAINER_NAME,
    image: DEFAULT_IMAGE,
    databaseName,
    username,
    password,
    hostPort
  };
}

function docker(args: string[]) {
  return spawnSync("docker", args, { encoding: "utf8", windowsHide: true });
}

function dockerIsReady(): boolean {
  return docker(["info"]).status === 0;
}

function launchDockerDesktop(): boolean {
  if (process.platform !== "win32") return false;

  const candidates = [
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "Docker", "Docker", "Docker Desktop.exe") : "",
    "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"
  ].filter(Boolean);

  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) return false;

  try {
    const child = spawn(executable, [], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function ensureDockerDaemon() {
  if (dockerIsReady()) return;

  if (launchDockerDesktop()) {
    process.stdout.write("[dev] Iniciando Docker Desktop...\n");
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await wait(2_000);
      if (dockerIsReady()) return;
    }
  }

  throw new Error("Docker no está disponible. Instala Docker Desktop y vuelve a ejecutar npm run dev.");
}

function commandOutput(args: string[]): string {
  const result = docker(args);
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim();
    throw new Error(`docker ${args.join(" ")} falló${detail ? `: ${detail}` : "."}`);
  }
  return String(result.stdout || "").trim();
}

async function ensurePostgres(config: LocalDatabaseConfig) {
  const existing = commandOutput([
    "ps",
    "-a",
    "--filter",
    `name=^/${config.containerName}$`,
    "--format",
    "{{.Names}}"
  ]);

  if (!existing.split(/\r?\n/).includes(config.containerName)) {
    process.stdout.write("[dev] Creando el contenedor Postgres local...\n");
    commandOutput(buildDockerRunArgs(config));
  } else {
    const running = commandOutput(["inspect", "--format={{.State.Running}}", config.containerName]);
    if (running !== "true") {
      process.stdout.write("[dev] Iniciando el contenedor Postgres local...\n");
      commandOutput(["start", config.containerName]);
    }
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ready = docker([
      "exec",
      config.containerName,
      "pg_isready",
      "-U",
      config.username,
      "-d",
      config.databaseName
    ]);
    if (ready.status === 0) return;
    await wait(1_000);
  }

  throw new Error("Postgres no llegó a estar listo en el contenedor trainer-postgres.");
}

function npmCommand(): { executable: string; prefixArgs: string[] } {
  if (process.platform !== "win32") return { executable: "npm", prefixArgs: [] };

  // Spawning npm.cmd directly can return EINVAL in Windows-hosted Node
  // processes. Calling npm's CLI through the current Node executable is
  // equivalent and works from both PowerShell and cmd.exe.
  return {
    executable: process.execPath,
    prefixArgs: [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")]
  };
}

function runNpm(args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    const npm = npmCommand();
    const child = spawn(npm.executable, [...npm.prefixArgs, ...args], { env, stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

async function runDev() {
  const env = readLocalEnvironment();
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) throw new Error("DATABASE_URL es obligatorio para ejecutar el entorno local.");

  if (isLocalDatabaseUrl(databaseUrl)) {
    const config = localDatabaseConfig(databaseUrl);
    await ensureDockerDaemon();
    await ensurePostgres(config);
    process.stdout.write("[dev] Ejecutando migraciones...\n");
    const migrationCode = await runNpm(["run", "db:migrate"], env);
    if (migrationCode !== 0) process.exitCode = migrationCode;
    if (migrationCode !== 0) return;
  } else {
    process.stdout.write("[dev] DATABASE_URL no apunta a Postgres local; se omite el contenedor de desarrollo.\n");
  }

  const npm = npmCommand();
  const next: ChildProcess = spawn(npm.executable, [...npm.prefixArgs, "run", "dev:next"], {
    env,
    stdio: "inherit",
    windowsHide: true
  });

  const stopNext = () => {
    if (!next.killed) next.kill();
  };
  process.once("SIGINT", stopNext);
  process.once("SIGTERM", stopNext);

  await new Promise<void>((resolve, reject) => {
    next.once("error", reject);
    next.once("exit", (code: number | null) => {
      process.exitCode = code ?? 0;
      resolve();
    });
  });
}

const isEntryPoint = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  runDev().catch((error: unknown) => {
    console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
