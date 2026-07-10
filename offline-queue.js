/**
 * LedgerFlow — IndexedDB offline queue for return preparation & sync
 */
(function (global) {
    'use strict';

    const DB_NAME = 'ledgerflow-offline';
    const DB_VERSION = 1;
    const STORES = ['pendingReturns', 'gstr2bImports', 'syncQueue'];

    function openDb() {
        return new Promise((resolve, reject) => {
            if (!global.indexedDB) return reject(new Error('IndexedDB not supported'));
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                STORES.forEach(s => {
                    if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
                });
            };
        });
    }

    async function put(store, record) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(store, 'readwrite');
            tx.objectStore(store).put({ ...record, id: record.id || store + '_' + Date.now(), updatedAt: new Date().toISOString() });
            tx.oncomplete = () => resolve(record);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getAll(store) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(store, 'readonly');
            const req = tx.objectStore(store).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async function remove(store, id) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(store, 'readwrite');
            tx.objectStore(store).delete(id);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function queueReturn(clientId, returnType, month, portalJson) {
        return put('pendingReturns', { clientId, returnType, month, portalJson, status: 'pending' });
    }

    async function queueSync(action, payload) {
        return put('syncQueue', { action, payload, status: 'pending' });
    }

    async function flushSyncQueue(saveFn) {
        const items = await getAll('syncQueue');
        const results = [];
        for (const item of items) {
            try {
                if (saveFn) await saveFn(item);
                await remove('syncQueue', item.id);
                results.push({ id: item.id, ok: true });
            } catch (e) {
                results.push({ id: item.id, ok: false, error: e.message });
            }
        }
        return results;
    }

    global.LedgerFlowOffline = {
        VERSION: '1.0.0',
        queueReturn,
        queueSync,
        flushSyncQueue,
        getAll,
        put,
        remove
    };
})(typeof window !== 'undefined' ? window : global);