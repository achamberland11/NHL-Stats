// Async cache backend for API responses.
// Primary: IndexedDB (large budget). Fallback: localStorage.
// Includes quota-triggered eviction and a one-time migration of the old
// localStorage cache into IndexedDB.

const DB_NAME = "nhl_stats";
const DB_VERSION = 1;
const STORE_NAME = "cache";
const LEGACY_PREFIX = "nhl_stats_cache";
const DEFAULT_TTL = 24 * 60 * 60 * 1000;
const ROSTER_TTL = DEFAULT_TTL * 7;

const useIndexedDB = typeof indexedDB !== "undefined";

let dbPromise = null;

function isQuotaError(err) {
  return (
    !!err &&
    (err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function estimateSize(value) {
  try {
    return typeof value === "string"
      ? value.length
      : JSON.stringify(value).length;
  } catch (err) {
    return 0;
  }
}

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!useIndexedDB) {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });

  dbPromise = dbPromise.then(async (db) => {
    try {
      await migrateLegacy(db);
      await removeExpired(db);
    } catch (err) {
      console.error("Cache init failed:", err);
    }
    return db;
  });

  return dbPromise;
}

function rawGet(db, key) {
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, "readonly");
    const request = txn.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function rawPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, "readwrite");
    txn.objectStore(STORE_NAME).put({ key, ...value });
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
    txn.onabort = () => reject(txn.error || new Error("txn aborted"));
  });
}

function rawDelete(db, keys) {
  if (!keys || keys.length === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, "readwrite");
    const store = txn.objectStore(STORE_NAME);
    for (const key of keys) store.delete(key);
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
    txn.onabort = () => reject(txn.error || new Error("txn aborted"));
  });
}

function rawAll(db) {
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, "readonly");
    const request = txn.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function removeExpired(db) {
  const entries = await rawAll(db);
  const expired = entries.filter(
    (e) => Date.now() - e.timestamp >= (e.ttl || DEFAULT_TTL),
  );
  if (expired.length) await rawDelete(db, expired.map((e) => e.key));
}

async function idbPutWithEviction(db, key, value) {
  try {
    await rawPut(db, key, value);
    return true;
  } catch (err) {
    if (!isQuotaError(err)) throw err;
  }

  await removeExpired(db);
  try {
    await rawPut(db, key, value);
    return true;
  } catch (err) {
    // Drop the largest entries one at a time until the write fits.
    const entries = (await rawAll(db)).filter((e) => e.key !== key);
    entries.sort((a, b) => estimateSize(b.data) - estimateSize(a.data));
    for (const entry of entries) {
      try {
        await rawDelete(db, [entry.key]);
        await rawPut(db, key, value);
        return true;
      } catch (err) {
        // keep evicting
      }
    }
  }
  return false;
}

////// localStorage fallback
function legacyGet(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value && typeof value === "object" && "data" in value) return value;
    return { data: value, timestamp: Date.now() };
  } catch (err) {
    console.error("Failed to parse cached entry:", key, err);
    return null;
  }
}

function legacySet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function legacyKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) keys.push(key);
  }
  return keys;
}

function legacyDelete(keys) {
  for (const key of keys) localStorage.removeItem(key);
}

function legacyExpiredKeys() {
  return legacyKeys().filter((key) => {
    if (!key.startsWith(LEGACY_PREFIX)) return false;
    const value = legacyGet(key);
    return value && Date.now() - value.timestamp >= (value.ttl || DEFAULT_TTL);
  });
}

function legacyPutWithEviction(key, value) {
  try {
    legacySet(key, value);
    return true;
  } catch (err) {
    legacyDelete(legacyExpiredKeys());
    try {
      legacySet(key, value);
      return true;
    } catch (err) {
      const entries = legacyKeys()
        .filter((k) => k !== key)
        .map((k) => ({
          key: k,
          size: estimateSize(localStorage.getItem(k)),
        }))
        .sort((a, b) => b.size - a.size);
      for (const entry of entries) {
        localStorage.removeItem(entry.key);
        try {
          legacySet(key, value);
          return true;
        } catch (err) {
          // keep evicting
        }
      }
    }
  }
  return false;
}

////// Migration from the old localStorage cache
let migrated = false;

function migrateLegacy(db) {
  if (migrated) return Promise.resolve();

  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LEGACY_PREFIX)) keys.push(key);
  }
  if (keys.length === 0) {
    migrated = true;
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, "readwrite");
    const store = txn.objectStore(STORE_NAME);
    for (const key of keys) {
      const value = legacyGet(key);
      if (!value) continue;
      const ttl = key.includes("_roster_") ? ROSTER_TTL : DEFAULT_TTL;
      store.put({
        key,
        data: value.data,
        timestamp: value.timestamp,
        ttl: value.ttl || ttl,
      });
    }
    txn.oncomplete = () => {
      for (const key of keys) localStorage.removeItem(key);
      migrated = true;
      resolve();
    };
    txn.onerror = () => reject(txn.error);
    txn.onabort = () => reject(txn.error || new Error("migration aborted"));
  });
}

////// Public API
export async function storageGet(key) {
  if (useIndexedDB) {
    try {
      const db = await openDb();
      return await rawGet(db, key);
    } catch (err) {
      console.error("IndexedDB read failed, falling back to localStorage:", err);
    }
  }
  return legacyGet(key);
}

export async function storageSet(key, value) {
  if (useIndexedDB) {
    try {
      const db = await openDb();
      const ok = await idbPutWithEviction(db, key, value);
      if (ok) return true;
    } catch (err) {
      console.error("IndexedDB write failed:", err);
    }
  }
  return legacyPutWithEviction(key, value);
}

export async function removeCacheKeys(keys) {
  if (useIndexedDB) {
    try {
      const db = await openDb();
      await rawDelete(db, keys);
    } catch (err) {
      console.error("IndexedDB delete failed:", err);
    }
  }
  legacyDelete(keys);
}