import { z } from "zod";
import { formatFromFilename, validateMimeType, FileTooLargeError, UnsupportedFormatError, UnsupportedMimeTypeError } from "@/features/endurance/domain/parsers";
import { MAX_UPLOAD_BYTES } from "@/features/endurance/domain/storage";
import { createPrivateUploadKey, createSignedUpload } from "@/lib/storage/supabase-server";

type SessionUser = { id: string } | null;

const requestSchema = z.object({
  name: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string()
});

/**
 * Step 1 of the browser-direct-upload flow (Task 5): issues a Storage signed-upload URL
 * scoped to this owner so the browser can PUT the file's bytes directly to Supabase Storage,
 * bypassing this server for the (potentially large) body. Step 2 is the JSON confirm endpoint
 * at POST /api/v1/activity-imports, which downloads+verifies+parses.
 */
export async function createActivityImportUploadUrlResponse(request: Request, user: SessionUser): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "Datos de solicitud inválidos.", parsed.error.flatten());
  const { name, sizeBytes, mimeType } = parsed.data;

  if (sizeBytes > MAX_UPLOAD_BYTES) return error(413, "VALIDATION_ERROR", new FileTooLargeError(MAX_UPLOAD_BYTES).message);

  try {
    const format = formatFromFilename(name);
    validateMimeType(format, mimeType);

    const storageKey = createPrivateUploadKey(user.id, format);
    const signed = await createSignedUpload(storageKey, mimeType);
    return Response.json({ data: { storageKey, signedUrl: signed.signedUrl, token: signed.token }, meta: {} });
  } catch (cause) {
    if (cause instanceof UnsupportedFormatError) return error(422, "UNSUPPORTED_ACTIVITY_FILE", cause.message);
    if (cause instanceof UnsupportedMimeTypeError) return error(422, "UNSUPPORTED_ACTIVITY_FILE", cause.message);
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
