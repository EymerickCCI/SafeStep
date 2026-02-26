import { db, type SyncItem } from '../db';
import api, { getEndpoint } from './api';

export async function addToSyncQueue(action: 'CREATE' | 'UPDATE' | 'DELETE', entity: 'epi', data: any) {
  await db.syncQueue.add({
    action,
    entity,
    data,
    timestamp: Date.now()
  });
  
  // Try to sync immediately if online
  if (navigator.onLine) {
    syncWithServer().catch(console.error);
  }
}

let isSyncingInternal = false;

export async function syncWithServer() {
  if (isSyncingInternal) return;
  
  const queue = await db.syncQueue.toArray();
  if (queue.length === 0) return;

  isSyncingInternal = true;
  const backendMode = localStorage.getItem('safestep_backend_mode') || 'node';

  try {
    let response;
    if (backendMode === 'php') {
      // PHP expects { "events": [...] } as per SafeStep-main/api/sync/index.php
      const events = queue.map(item => ({
        action: item.action,
        entity_type: item.entity,
        data: item.data,
        client_timestamp: new Date(item.timestamp).toISOString().slice(0, 19).replace('T', ' ')
      }));
      response = await api.post(getEndpoint('/sync'), { events });
    } else {
      // Node expects { "changes": [...] }
      response = await api.post(getEndpoint('/sync'), { changes: queue });
    }

    // Check for success (PHP returns synced count, Node returns success boolean)
    if (response.data.success || response.data.synced !== undefined) {
      await db.syncQueue.clear();
      console.log('Sync successful');
      
      // Refresh local data from server to be sure
      const epiResponse = await api.get(getEndpoint('/epi'));
      
      if (!epiResponse.data || !Array.isArray(epiResponse.data)) {
        console.warn("Sync: Expected array from server, got:", epiResponse.data);
        return;
      }

      const data = epiResponse.data;
      const seenIds = new Set();
      const validData = data
        .filter((item: any) => {
          if (item && (item.id !== undefined && item.id !== null)) {
            const id = Number(item.id);
            if (!isNaN(id) && !seenIds.has(id)) {
              seenIds.add(id);
              return true;
            }
          }
          return false;
        })
        .map((item: any) => ({ ...item, id: Number(item.id) }));
        
      if (validData.length > 0) {
        await db.epi.bulkPut(validData);
      }
    }
  } catch (error) {
    console.error('Sync failed, will retry later', error);
  } finally {
    isSyncingInternal = false;
  }
}

// Listen for online status
window.addEventListener('online', () => {
  syncWithServer().catch(console.error);
});
