"use client";

import type { OutboxOperation, OutboxStore } from "./outbox";
import type { OfflineSnapshot, OfflineSnapshotStore } from "./snapshot";
import type { OfflineImportFile, OfflineImportFileStore } from "@/features/endurance/domain/activity-import-offline";

const DB_NAME = "trainer-offline";
const DB_VERSION = 3;
const STORE_NAME = "outbox";
const SNAPSHOT_STORE_NAME = "snapshots";
const FILE_STORE_NAME = "files";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) request.result.createObjectStore(SNAPSHOT_STORE_NAME, { keyPath: "userId" });
      if (!request.result.objectStoreNames.contains(FILE_STORE_NAME)) {
        const store = request.result.createObjectStore(FILE_STORE_NAME, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Real browser-only implementation of the outbox contract from outbox.ts. Not unit-tested (no DOM/IndexedDB in the vitest node environment) — same declared limitation as the FIT/TCX/GPX private storage adapter in Fase 4; the flush logic it plugs into is tested against a memory store instead. */
export function createIndexedDbOutboxStore(): OutboxStore {
  return {
    async all() {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result as OutboxOperation[]);
        request.onerror = () => reject(request.error);
      });
    },
    async put(operation) {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(operation);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async remove(id) {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  };
}

/** Real browser-only implementation of the snapshot contract from snapshot.ts. Not unit-tested (no DOM/IndexedDB in the vitest node environment) — same declared limitation as createIndexedDbOutboxStore above. */
export function createIndexedDbSnapshotStore(): OfflineSnapshotStore {
  return {
    async get(userId) {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(SNAPSHOT_STORE_NAME, "readonly");
        const request = tx.objectStore(SNAPSHOT_STORE_NAME).get(userId);
        request.onsuccess = () => resolve(request.result as OfflineSnapshot | undefined);
        request.onerror = () => reject(request.error);
      });
    },
    async put(snapshot) {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(SNAPSHOT_STORE_NAME, "readwrite");
        tx.objectStore(SNAPSHOT_STORE_NAME).put(snapshot);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async remove(userId) {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(SNAPSHOT_STORE_NAME, "readwrite");
        tx.objectStore(SNAPSHOT_STORE_NAME).delete(userId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  };
}

export function createIndexedDbImportFileStore(): OfflineImportFileStore {
  return {
    async get(userId, fileId) {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_STORE_NAME, "readonly");
        const request = tx.objectStore(FILE_STORE_NAME).get(fileId);
        request.onsuccess = () => {
          const file = request.result as OfflineImportFile | undefined;
          resolve(file?.userId === userId ? file : undefined);
        };
        request.onerror = () => reject(request.error);
      });
    },
    async put(file) {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_STORE_NAME, "readwrite");
        tx.objectStore(FILE_STORE_NAME).put(file);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async remove(userId, fileId) {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_STORE_NAME, "readwrite");
        const store = tx.objectStore(FILE_STORE_NAME);
        const request = store.get(fileId);
        request.onsuccess = () => {
          const file = request.result as OfflineImportFile | undefined;
          if (file?.userId === userId) store.delete(fileId);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async list(userId) {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_STORE_NAME, "readonly");
        const request = tx.objectStore(FILE_STORE_NAME).index("userId").getAll(userId);
        request.onsuccess = () => resolve(request.result as OfflineImportFile[]);
        request.onerror = () => reject(request.error);
      });
    }
  };
}
