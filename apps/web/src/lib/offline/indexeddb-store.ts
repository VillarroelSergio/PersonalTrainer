"use client";

import type { OutboxOperation, OutboxStore } from "./outbox";

const DB_NAME = "trainer-offline";
const DB_VERSION = 1;
const STORE_NAME = "outbox";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
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
