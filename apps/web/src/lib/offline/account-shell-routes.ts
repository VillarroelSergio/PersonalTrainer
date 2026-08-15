import type { OfflineSnapshot } from "./snapshot";

const BASE_ACCOUNT_SHELL_ROUTES = ["/hoy", "/plan", "/ejercicios", "/historial", "/checkin"];

type PlanLike = {
  week?: {
    sessions?: Array<{ kind?: string; blocks?: unknown[] } | null | undefined>;
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
