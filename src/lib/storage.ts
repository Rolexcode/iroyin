"use client";

import type { IroyinCase } from "./types";

const DB_NAME = "iroyin-local";
const DB_VERSION = 1;
const STORE_NAME = "cases";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "caseId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCase(caseFile: IroyinCase): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(caseFile);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadCase(caseId: string): Promise<IroyinCase | null> {
  const database = await openDatabase();
  const result = await new Promise<IroyinCase | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(caseId);
    request.onsuccess = () => resolve(request.result as IroyinCase | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  if (!result) return null;
  if (Date.parse(result.expiresAt) <= Date.now()) {
    await deleteCase(caseId);
    return null;
  }
  return result;
}

export async function deleteCase(caseId: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(caseId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function clearExpiredCases(): Promise<void> {
  const database = await openDatabase();
  const all = await new Promise<IroyinCase[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as IroyinCase[]);
    request.onerror = () => reject(request.error);
  });
  database.close();
  await Promise.all(all.filter((item) => Date.parse(item.expiresAt) <= Date.now()).map((item) => deleteCase(item.caseId)));
}
