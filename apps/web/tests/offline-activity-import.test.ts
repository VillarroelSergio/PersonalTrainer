import { describe, expect, it, vi } from "vitest";
import {
  readyImportToWizardState,
  stageActivityImportOffline,
  submitStagedActivityImport,
  type OfflineImportFile,
  type OfflineImportFileStore
} from "@/features/endurance/domain/activity-import-offline";
import { createAccountScopedOutboxStore, createMemoryOutboxStore, flushOutbox, type OutboxOperation } from "@/lib/offline/outbox";

function memoryFileStore(): OfflineImportFileStore {
  const files = new Map<string, OfflineImportFile>();
  return {
    async get(userId, fileId) {
      const file = files.get(`${userId}:${fileId}`);
      return file?.userId === userId ? file : undefined;
    },
    async put(file) {
      files.set(`${file.userId}:${file.id}`, file);
    },
    async remove(userId, fileId) {
      files.delete(`${userId}:${fileId}`);
    },
    async list(userId) {
      return [...files.values()].filter((file) => file.userId === userId);
    }
  };
}

describe("offline activity import staging", () => {
  it("stages the selected file as a scoped Blob and queues only metadata", async () => {
    const fileStore = memoryFileStore();
    const file = new File(["<gpx>sample</gpx>"], "carrera.gpx", { type: "application/gpx+xml" });
    const ids = ["file-1", "op-1"];

    const result = await stageActivityImportOffline({
      file,
      userId: "user-a",
      fileStore,
      createId: () => ids.shift()!
    });

    expect(result.operation).toMatchObject({
      id: "op-1",
      kind: "stage_activity_import",
      payload: {
        fileId: "file-1",
        userId: "user-a",
        originalName: "carrera.gpx",
        sizeBytes: file.size,
        mimeType: "application/gpx+xml"
      }
    });
    expect(result.operation.kind).toBe("stage_activity_import");
    if (result.operation.kind !== "stage_activity_import") throw new Error("expected staged import operation");
    expect(JSON.stringify(result.operation.payload)).not.toContain("<gpx>sample</gpx>");

    const staged = await fileStore.get("user-a", "file-1");
    expect(staged?.blob).toBeInstanceOf(Blob);
    if (!staged?.blob) throw new Error("expected staged blob");
    expect(await staged.blob.text()).toBe("<gpx>sample</gpx>");
    expect(await fileStore.get("user-b", "file-1")).toBeUndefined();
  });

  it("replays a staged import by signing, uploading the Blob, confirming analysis, and then removing the local file", async () => {
    const fileStore = memoryFileStore();
    const staged = await stageActivityImportOffline({
      file: new File(["<gpx>sample</gpx>"], "carrera.gpx", { type: "application/gpx+xml" }),
      userId: "user-a",
      fileStore,
      createId: vi.fn().mockReturnValueOnce("file-1").mockReturnValueOnce("op-1")
    });
    const operation = staged.operation as OutboxOperation;

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { storageKey: "activity-imports/user-a/upload.gpx", signedUrl: "https://storage.example/upload" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "import-1", status: "analyzed" } }), { status: 200 }));

    await expect(submitStagedActivityImport(operation, { fileStore, fetchFn })).resolves.toEqual({ status: "ok" });

    expect(fetchFn).toHaveBeenNthCalledWith(1, "/api/v1/activity-imports/upload-url", expect.objectContaining({ method: "POST" }));
    expect(fetchFn).toHaveBeenNthCalledWith(2, "https://storage.example/upload", expect.objectContaining({ method: "PUT", body: expect.any(Blob) }));
    expect(fetchFn).toHaveBeenNthCalledWith(3, "/api/v1/activity-imports", expect.objectContaining({ method: "POST" }));
    expect(fetchFn.mock.calls[0]![1]!.body).not.toContain("<gpx>sample</gpx>");
    expect(fetchFn.mock.calls[2]![1]!.body).not.toContain("<gpx>sample</gpx>");
    const ready = await fileStore.get("user-a", "file-1");
    expect(ready).toMatchObject({ status: "ready_to_save", importData: { id: "import-1", status: "analyzed" } });
    expect(ready?.blob).toBeNull();
  });

  it("keeps the staged Blob when upload or confirm cannot complete", async () => {
    const fileStore = memoryFileStore();
    const staged = await stageActivityImportOffline({
      file: new File(["<gpx>sample</gpx>"], "carrera.gpx", { type: "application/gpx+xml" }),
      userId: "user-a",
      fileStore,
      createId: vi.fn().mockReturnValueOnce("file-1").mockReturnValueOnce("op-1")
    });

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { storageKey: "activity-imports/user-a/upload.gpx", signedUrl: "https://storage.example/upload" } }), { status: 200 }))
      .mockRejectedValueOnce(new TypeError("offline"));

    await expect(submitStagedActivityImport(staged.operation as OutboxOperation, { fileStore, fetchFn })).resolves.toEqual({ status: "network_error" });
    expect(await fileStore.get("user-a", "file-1")).toBeDefined();
  });

  it("does not list or flush another account's staged import operation", async () => {
    const userAOperation: OutboxOperation = {
      id: "op-a",
      kind: "stage_activity_import",
      createdAt: 1,
      status: "pending",
      payload: { fileId: "file-a", userId: "user-a", originalName: "a.gpx", sizeBytes: 1, mimeType: "application/gpx+xml", sha256: "a" }
    };
    const userBOperation: OutboxOperation = {
      id: "op-b",
      kind: "stage_activity_import",
      createdAt: 2,
      status: "pending",
      payload: { fileId: "file-b", userId: "user-b", originalName: "b.gpx", sizeBytes: 1, mimeType: "application/gpx+xml", sha256: "b" }
    };
    const baseStore = createMemoryOutboxStore([userAOperation, userBOperation]);
    const scopedStore = createAccountScopedOutboxStore(baseStore, "user-b");
    const submitted: string[] = [];

    expect((await scopedStore.all()).map((operation) => operation.id)).toEqual(["op-b"]);
    const summary = await flushOutbox(scopedStore, async (operation) => {
      submitted.push(operation.id);
      return { status: "ok" };
    });

    expect(summary.synced).toBe(1);
    expect(submitted).toEqual(["op-b"]);
    expect((await baseStore.all()).map((operation) => operation.id)).toEqual(["op-a"]);
  });

  it("refuses to replay a staged import when the active account differs from the file owner", async () => {
    const fileStore = memoryFileStore();
    const staged = await stageActivityImportOffline({
      file: new File(["<gpx>sample</gpx>"], "carrera.gpx", { type: "application/gpx+xml" }),
      userId: "user-a",
      fileStore,
      createId: vi.fn().mockReturnValueOnce("file-1").mockReturnValueOnce("op-1")
    });
    const fetchFn = vi.fn();

    await expect(submitStagedActivityImport(staged.operation, { fileStore, fetchFn, currentUserId: "user-b" })).resolves.toEqual({ status: "network_error" });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(await fileStore.get("user-a", "file-1")).toBeDefined();
  });

  it("keeps a ready-to-save local import state after replay so the user can commit it later", async () => {
    const fileStore = memoryFileStore();
    const staged = await stageActivityImportOffline({
      file: new File(["<gpx>sample</gpx>"], "carrera.gpx", { type: "application/gpx+xml" }),
      userId: "user-a",
      fileStore,
      createId: vi.fn().mockReturnValueOnce("file-1").mockReturnValueOnce("op-1")
    });
    const importData = {
      id: "import-1",
      status: "analyzed" as const,
      format: "gpx",
      errorCode: null,
      analysis: { sport: "running" as const, startedAt: "2026-08-10T08:00:00Z", durationS: 600, distanceM: 1000, metrics: [] },
      duplicateOfActivityId: null
    };
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { storageKey: "activity-imports/user-a/upload.gpx", signedUrl: "https://storage.example/upload" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: importData }), { status: 200 }));

    await submitStagedActivityImport(staged.operation, { fileStore, fetchFn, currentUserId: "user-a" });
    const ready = await fileStore.get("user-a", "file-1");

    expect(readyImportToWizardState(ready!)).toEqual({
      importData,
      name: "carrera",
      sport: "running"
    });
  });
});
