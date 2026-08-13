import { previewSharedRoutine, ShareLinkNotFoundError } from "@/features/planning/domain/share-repository";
import type { getDb } from "@/lib/db/client";

/** Preview requires no authentication — the token itself is the access control, same as a real invite link. Never returns the origin owner's identity, loads, or history (see share-repository.ts). */
export async function previewSharedRoutineResponse(database: ReturnType<typeof getDb>, token: string): Promise<Response> {
  try {
    const preview = await previewSharedRoutine(database, token);
    return Response.json({ data: preview, meta: {} });
  } catch (cause) {
    if (cause instanceof ShareLinkNotFoundError) return Response.json({ error: { code: "NOT_FOUND", message: "Este enlace no existe o ya no está disponible.", details: {} } }, { status: 404 });
    throw cause;
  }
}
