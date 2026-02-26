<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

/**
 * POST /api/sync/
 * Rejoue une file d'actions stockées offline par Dexie.js
 * Body: { "events": [ { "action": "CREATE|UPDATE|DELETE", "entity_type": "epi", "data": {...}, "client_timestamp": "..." } ] }
 */

$user = authenticate();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée']);
    exit;
}

$body   = json_decode(file_get_contents('php://input'), true);
$events = $body['events'] ?? [];

if (empty($events) || !is_array($events)) {
    http_response_code(400);
    echo json_encode(['error' => 'Tableau events requis']);
    exit;
}

$db      = Database::connect();
$results = [];

foreach ($events as $event) {
    $action      = strtoupper($event['action']      ?? '');
    $entityType  = $event['entity_type'] ?? '';
    $data        = $event['data']        ?? [];
    $clientTs    = $event['client_timestamp'] ?? date('Y-m-d H:i:s');

    try {
        if ($entityType === 'epi') {
            if ($action === 'CREATE') {
                $stmt = $db->prepare('INSERT INTO epis (user_id, site_id, tag_ref, status, category) VALUES (?, ?, ?, ?, ?)');
                $stmt->execute([$user['sub'], $data['site_id'] ?? null, $data['tag_ref'], $data['status'], $data['category']]);
                $newId = $db->lastInsertId();

                // Enregistre l'événement de sync
                $db->prepare('INSERT INTO sync_events (user_id, entity_type, epi_id, action, client_timestamp) VALUES (?, ?, ?, ?, ?)')
                   ->execute([$user['sub'], 'epi', $newId, 'CREATE', $clientTs]);

                $results[] = ['status' => 'ok', 'action' => 'CREATE', 'id' => (int)$newId];

            } elseif ($action === 'UPDATE' && !empty($data['id'])) {
                $stmt = $db->prepare('UPDATE epis SET status = ?, category = ?, tag_ref = ?, site_id = ? WHERE id = ? AND user_id = ?');
                $stmt->execute([$data['status'], $data['category'], $data['tag_ref'], $data['site_id'] ?? null, $data['id'], $user['sub']]);

                $db->prepare('INSERT INTO sync_events (user_id, entity_type, epi_id, action, client_timestamp) VALUES (?, ?, ?, ?, ?)')
                   ->execute([$user['sub'], 'epi', $data['id'], 'UPDATE', $clientTs]);

                $results[] = ['status' => 'ok', 'action' => 'UPDATE', 'id' => (int)$data['id']];

            } elseif ($action === 'DELETE' && !empty($data['id'])) {
                $stmt = $db->prepare('DELETE FROM epis WHERE id = ? AND user_id = ?');
                $stmt->execute([$data['id'], $user['sub']]);

                $db->prepare('INSERT INTO sync_events (user_id, entity_type, epi_id, action, client_timestamp) VALUES (?, ?, ?, ?, ?)')
                   ->execute([$user['sub'], 'epi', $data['id'], 'DELETE', $clientTs]);

                $results[] = ['status' => 'ok', 'action' => 'DELETE', 'id' => (int)$data['id']];
            }
        } else {
            $results[] = ['status' => 'ignored', 'reason' => "entity_type '$entityType' non géré"];
        }
    } catch (Exception $e) {
        $results[] = ['status' => 'error', 'action' => $action, 'message' => $e->getMessage()];
    }
}

echo json_encode(['synced' => count(array_filter($results, fn($r) => $r['status'] === 'ok')), 'results' => $results]);
