// Dexie.js — stockage local IndexedDB pour le mode offline

const db = new Dexie('SafeStepDB');

db.version(1).stores({
  epis:      '++localId, id, tag_ref, status, category, site_id, synced',
  syncQueue: '++id, action, entity_type, data, client_timestamp',
});

// Sauvegarde les EPIs récupérés du serveur en local
async function saveEpisLocally(epis) {
  await db.epis.clear();
  await db.epis.bulkPut(epis.map(e => ({ ...e, synced: true })));
}

// Retourne les EPIs depuis le stockage local
async function getEpisLocally() {
  return db.epis.toArray();
}

// Ajoute une action en file d'attente (quand offline)
async function queueAction(action, entityType, data) {
  await db.syncQueue.add({
    action,
    entity_type: entityType,
    data,
    client_timestamp: new Date().toISOString(),
  });
}

// Rejoue la file d'attente vers le serveur
async function flushSyncQueue(token) {
  const pending = await db.syncQueue.toArray();
  if (pending.length === 0) return;

  const response = await fetch(`${API_BASE}/api/sync/index.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ events: pending }),
  });

  if (response.ok) {
    await db.syncQueue.clear();
    console.log(`[Sync] ${pending.length} action(s) synchronisée(s)`);
  }
}
