import type { OfflineSnapshot } from "./snapshot";

/** Every route here renders client-side from the local snapshot, so one cached shell per
 * pathname covers all its query strings (see findSamePathnameCacheUrl). Server-rendered
 * routes (/movilidad, /ejercicios/[id], /compartir/[token]) are deliberately absent: they
 * read the database per request and cannot render offline. */
const BASE_ACCOUNT_SHELL_ROUTES = ["/hoy", "/plan", "/ejercicios", "/historial", "/checkin", "/perfil", "/compartir"];

type PlanLike = {
  week?: {
    sessions?: Array<{ kind?: string; blocks?: unknown[] } | null | undefined>;
  };
};

/** /historial/[id] is client-rendered but its id is a path segment, so the
 * same-pathname cache fallback cannot stand in for a detail page it never saw.
 * Each entry the snapshot already carries gets its own shell.
 * ponytail: bounded by whatever the snapshot holds — add a cap here if the
 * offline-snapshot endpoint ever stops trimming history. */
function historyDetailRoutes(snapshot: OfflineSnapshot): string[] {
  const workoutSessions = (snapshot.data.history as { workoutSessions?: Array<{ id?: unknown }> } | undefined)?.workoutSessions ?? [];
  const enduranceActivities = (snapshot.data.enduranceActivities as Array<{ id?: unknown }> | undefined) ?? [];
  return [...workoutSessions, ...enduranceActivities]
    .map((row) => row?.id)
    .filter((id): id is string => typeof id === "string" && id.trim() !== "")
    .map((id) => `/historial/${encodeURIComponent(id)}`);
}

export function accountShellRoutesForSnapshot(snapshot: OfflineSnapshot): string[] {
  const routes = new Set([...BASE_ACCOUNT_SHELL_ROUTES, ...historyDetailRoutes(snapshot)]);
  const contentJson = (snapshot.data.activePlan as { contentJson?: unknown } | null | undefined)?.contentJson;
  if (typeof contentJson !== "string") return [...routes];

  let plan: PlanLike;
  try {
    plan = JSON.parse(contentJson) as PlanLike;
  } catch {
    return [...routes];
  }

  const sessions = plan.week?.sessions;
  if (!Array.isArray(sessions)) return [...routes];

  sessions.forEach((session, sessionIndex) => {
    if (!session) return;
    routes.add(`/recuperar?session=${sessionIndex}`);
    if (session.kind === "endurance") {
      routes.add(`/resistencia?session=${sessionIndex}`);
    } else {
      routes.add(`/entrenar?session=${sessionIndex}`);
      if (Array.isArray(session.blocks) && session.blocks.length > 0) {
        routes.add(`/entrenar?session=${sessionIndex}&addons=1`);
      }
    }
  });

  return [...routes];
}
