import type { OfflineSnapshot } from "./snapshot";

const BASE_ACCOUNT_SHELL_ROUTES = ["/hoy", "/plan", "/ejercicios", "/historial", "/checkin"];

type PlanLike = {
  week?: {
    sessions?: Array<{ kind?: string } | null | undefined>;
  };
};

export function accountShellRoutesForSnapshot(snapshot: OfflineSnapshot): string[] {
  const routes = new Set(BASE_ACCOUNT_SHELL_ROUTES);
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
    routes.add(session.kind === "endurance" ? `/resistencia?session=${sessionIndex}` : `/entrenar?session=${sessionIndex}`);
  });

  return [...routes];
}
