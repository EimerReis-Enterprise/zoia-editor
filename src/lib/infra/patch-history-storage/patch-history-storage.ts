const DATABASE_NAME = 'zoia-scope'
const DATABASE_VERSION = 2
const STORE_NAME = 'patch-history'

type StoredRecord = {
  seriesId: string
  version: number
  value: unknown
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('patch-drafts')) {
        request.result.createObjectStore('patch-drafts')
      }
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        const store = request.result.createObjectStore(STORE_NAME, {
          keyPath: ['seriesId', 'version'],
        })
        store.createIndex('seriesId', 'seriesId')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Patch History storage failed to open.'))
  })
}

export async function readPatchHistoryRecords(
  seriesId: string,
): Promise<unknown[]> {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction
        .objectStore(STORE_NAME)
        .index('seriesId')
        .getAll(seriesId)
      request.onsuccess = () =>
        resolve(
          (request.result as StoredRecord[])
            .sort((left, right) => left.version - right.version)
            .map((record) => record.value),
        )
      request.onerror = () =>
        reject(request.error ?? new Error('Patch History could not be read.'))
    })
  } finally {
    database.close()
  }
}

export async function writePatchHistoryRecord(
  seriesId: string,
  version: number,
  value: unknown,
): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put({ seriesId, version, value })
      transaction.oncomplete = () => resolve()
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Patch Version could not be saved.'))
    })
  } finally {
    database.close()
  }
}
