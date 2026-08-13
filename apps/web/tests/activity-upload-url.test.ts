import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";

const createSignedUploadUrl = vi.fn(async (path: string) => ({
  data: { signedUrl: `https://example.supabase.co/storage/v1/object/upload/sign/trainer-private/${path}?token=tok`, token: "tok", path },
  error: null
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from: vi.fn(() => ({ createSignedUploadUrl })) } }))
}));

beforeEach(() => {
  createSignedUploadUrl.mockClear();
});

async function importHandler() {
  return import("@/app/api/v1/activity-imports/upload-url/handler");
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/activity-imports/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/v1/activity-imports/upload-url", () => {
  it("rejects when unauthenticated", async () => {
    const { createActivityImportUploadUrlResponse } = await importHandler();
    const response = await createActivityImportUploadUrlResponse(jsonRequest({ name: "carrera.gpx", sizeBytes: 10, mimeType: "" }), null);
    expect(response.status).toBe(401);
  });

  it("rejects a declared size over MAX_UPLOAD_BYTES", async () => {
    const { createActivityImportUploadUrlResponse } = await importHandler();
    const { MAX_UPLOAD_BYTES } = await import("@/features/endurance/domain/storage");
    const response = await createActivityImportUploadUrlResponse(
      jsonRequest({ name: "carrera.gpx", sizeBytes: MAX_UPLOAD_BYTES + 1, mimeType: "" }),
      { id: "owner-a" }
    );
    expect(response.status).toBe(413);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("rejects an unsupported extension", async () => {
    const { createActivityImportUploadUrlResponse } = await importHandler();
    const response = await createActivityImportUploadUrlResponse(jsonRequest({ name: "carrera.csv", sizeBytes: 10, mimeType: "" }), { id: "owner-a" });
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_ACTIVITY_FILE");
  });

  it("rejects a mimeType that doesn't match the extension", async () => {
    const { createActivityImportUploadUrlResponse } = await importHandler();
    const response = await createActivityImportUploadUrlResponse(jsonRequest({ name: "carrera.gpx", sizeBytes: 10, mimeType: "application/pdf" }), { id: "owner-a" });
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_ACTIVITY_FILE");
  });

  it("returns a storage key scoped to the authenticated user and the data the browser needs to PUT directly", async () => {
    const { createActivityImportUploadUrlResponse } = await importHandler();
    const response = await createActivityImportUploadUrlResponse(jsonRequest({ name: "carrera.gpx", sizeBytes: 10, mimeType: "" }), { id: "owner-a" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.storageKey).toMatch(/^activity-imports\/owner-a\/[0-9a-f-]+\.gpx$/);
    expect(body.data.signedUrl).toContain(body.data.storageKey);
    expect(body.data.token).toBe("tok");
    expect(createSignedUploadUrl).toHaveBeenCalledWith(body.data.storageKey);
  });
});
