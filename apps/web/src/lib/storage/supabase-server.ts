import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Never a client component import: this module reads server-only env vars (no NEXT_PUBLIC_ prefix) and holds a service-role key. */
const BUCKET = "trainer-private";

let client: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase Storage access");
    client = createClient(url, key);
  }
  return client;
}

/** Owner-scoped, unguessable key — never derived from the person-supplied filename, avoiding path traversal/collision from an attacker-controlled name. */
export function createPrivateUploadKey(ownerId: string, format: string): string {
  return `activity-imports/${ownerId}/${randomUUID()}.${format}`;
}

/**
 * Task 5's browser-direct upload flow: the browser PUTs its bytes straight to `signedUrl`
 * (Storage's `/object/upload/sign/...` endpoint), bypassing this Next.js server for the body.
 * Cross-file touch (outside this task's nominal file list): the previous version only
 * returned `{token, path}`, which is enough to call `uploadToSignedUrl` from another
 * `@supabase/supabase-js` client, but the browser here has no SDK and does a raw `fetch` PUT,
 * so it needs the full `signedUrl` too. Surgical addition, no behavior change for existing callers.
 */
export async function createSignedUpload(key: string, contentType: string): Promise<{ token: string; path: string; signedUrl: string }> {
  const { data, error } = await getClient().storage.from(BUCKET).createSignedUploadUrl(key);
  if (error) throw error;
  void contentType; // ponytail: contentType isn't part of createSignedUploadUrl's params; kept in the signature for Task 5's call symmetry with uploadPrivateFile.
  return { token: data.token, path: data.path, signedUrl: data.signedUrl };
}

export async function uploadPrivateFile(key: string, bytes: Buffer, contentType: string): Promise<void> {
  const { error } = await getClient().storage.from(BUCKET).upload(key, bytes, { contentType, upsert: false });
  if (error) throw error;
}

export async function readPrivateUpload(key: string): Promise<Buffer> {
  const { data, error } = await getClient().storage.from(BUCKET).download(key);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

/** Single-object delete. Must not throw when the object is already gone (mirrors the old fs unlink's swallow-if-missing behavior) — deletes here are cleanup, never load-bearing for the caller's own success. A real failure (auth/network) still throws, so account/import deletion doesn't silently leave orphaned objects with no signal. */
export async function deletePrivateUpload(key: string): Promise<void> {
  await deleteOwnedUploads([key]);
}

/** Batch delete via one `.remove()` call. Only swallows a "not found"-shaped failure (returned in `error`, or thrown); any other error (auth, network, permissions) propagates so the caller knows the delete didn't actually happen. */
export async function deleteOwnedUploads(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const { error } = await getClient().storage.from(BUCKET).remove(keys);
    if (error && !isNotFoundError(error)) throw error;
  } catch (cause) {
    if (isNotFoundError(cause)) return;
    throw cause;
  }
}

/**
 * Cross-file touch (outside this task's nominal file list, for Task 7's backup script):
 * `.list()` in `@supabase/storage-js` is not recursive — it returns only the immediate
 * children of a prefix, with folders distinguishable from files by `id === null`
 * (verified against `node_modules/@supabase/storage-js/src/packages/StorageFileApi.ts`).
 * Our keys are always `activity-imports/<ownerId>/<uuid>.<format>`, so a full listing
 * needs a breadth-first walk over folders, paginating each directory (default page size
 * 100) until a page comes back short. Only the local backup script calls this — not any
 * request path — so the extra round-trips per directory/page are an acceptable trade.
 */
export async function listAllUploads(): Promise<{ key: string }[]> {
  const PAGE_SIZE = 100;
  const results: { key: string }[] = [];
  const queue: string[] = [""];

  while (queue.length > 0) {
    const prefix = queue.shift() as string;
    let offset = 0;
    for (;;) {
      const { data, error } = await getClient()
        .storage.from(BUCKET)
        .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      for (const entry of data) {
        const key = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) queue.push(key);
        else results.push({ key });
      }
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  return results;
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { statusCode, message } = error as { statusCode?: string; message?: string };
  if (statusCode === "404") return true;
  return /not.?found/i.test(message ?? "");
}
