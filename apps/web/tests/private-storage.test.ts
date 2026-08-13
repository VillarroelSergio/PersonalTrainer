import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn(async () => ({ data: { id: "1", path: "x", fullPath: "x" }, error: null }));
const download = vi.fn(async () => ({ data: new Blob([Buffer.from("bytes")]), error: null }));
const remove = vi.fn(async () => ({ data: [], error: null }));
const createSignedUploadUrl = vi.fn(async () => ({ data: { signedUrl: "https://example.test/x", token: "tok", path: "x" }, error: null }));
const from = vi.fn(() => ({ upload, download, remove, createSignedUploadUrl }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from } }))
}));

beforeEach(() => {
  upload.mockClear();
  download.mockClear();
  remove.mockClear();
  createSignedUploadUrl.mockClear();
  from.mockClear();
});

describe("supabase-server private storage", () => {
  it("does not throw on import even without env vars set (lazy client)", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(import("@/lib/storage/supabase-server")).resolves.toBeDefined();
  });

  it("createPrivateUploadKey produces an owner-scoped, unguessable key", async () => {
    const { createPrivateUploadKey } = await import("@/lib/storage/supabase-server");
    const key = createPrivateUploadKey("account-a", "fit");
    expect(key).toMatch(/^activity-imports\/account-a\/[0-9a-f-]+\.fit$/);
  });

  it("throws only when a function that needs the client is actually called without env vars", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { readPrivateUpload } = await import("@/lib/storage/supabase-server");
    await expect(readPrivateUpload("activity-imports/a/x.fit")).rejects.toThrow(/SUPABASE_URL/);
  });

  it("deletePrivateUpload calls .remove([key]) with exactly that key", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const { deletePrivateUpload } = await import("@/lib/storage/supabase-server");
    await deletePrivateUpload("activity-imports/a/x.fit");
    expect(remove).toHaveBeenCalledWith(["activity-imports/a/x.fit"]);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("deleteOwnedUploads calls .remove([keyA, keyB]) in one call", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const { deleteOwnedUploads } = await import("@/lib/storage/supabase-server");
    await deleteOwnedUploads(["activity-imports/a/x.fit", "activity-imports/a/y.fit"]);
    expect(remove).toHaveBeenCalledWith(["activity-imports/a/x.fit", "activity-imports/a/y.fit"]);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("a mocked not-found error from .remove(...) does not throw out of deletePrivateUpload", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    remove.mockResolvedValueOnce({ data: null as never, error: { message: "not found" } as never });
    const { deletePrivateUpload } = await import("@/lib/storage/supabase-server");
    await expect(deletePrivateUpload("activity-imports/a/gone.fit")).resolves.toBeUndefined();
  });

  it("a mocked not-found error from .remove(...) does not throw out of deleteOwnedUploads", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    remove.mockRejectedValueOnce(new Error("not found"));
    const { deleteOwnedUploads } = await import("@/lib/storage/supabase-server");
    await expect(deleteOwnedUploads(["activity-imports/a/gone.fit"])).resolves.toBeUndefined();
  });

  it("uploadPrivateFile and readPrivateUpload round-trip through the mocked client", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const { uploadPrivateFile, readPrivateUpload } = await import("@/lib/storage/supabase-server");
    await uploadPrivateFile("activity-imports/a/x.fit", Buffer.from("bytes"), "application/octet-stream");
    expect(upload).toHaveBeenCalledWith("activity-imports/a/x.fit", expect.any(Buffer), { contentType: "application/octet-stream", upsert: false });

    const bytes = await readPrivateUpload("activity-imports/a/x.fit");
    expect(bytes).toBeInstanceOf(Buffer);
  });

  it("createSignedUpload returns the token/path from the mocked client", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const { createSignedUpload } = await import("@/lib/storage/supabase-server");
    const result = await createSignedUpload("activity-imports/a/x.fit", "application/octet-stream");
    expect(result).toEqual({ token: "tok", path: "x", signedUrl: "https://example.test/x" });
  });
});
