"use client";

import type { OutboxOperation, OutboxStore } from "./outbox";
import type { OfflineSnapshot, OfflineSnapshotStore } from "./snapshot";

const DB_NAME = "trainer-offline";
const DB_VERSION = 2;
const STORE_NAME = "outbox";
const SNAPSHOT_STORE_NAME = "snapshots";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) request.result.createObjectStore(SNAPSHOT_STORE_NAME, { keyPath: "userId" });
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
