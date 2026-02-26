<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = authenticate();
$db   = Database::connect();

$id = $_GET['id'] ?? null;
if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'Paramètre id requis']);
    exit;
}

$stmt = $db->prepare('SELECT * FROM epis WHERE id = ?');
$stmt->execute([$id]);
$epi = $stmt->fetch();

if (!$epi) {
    http_response_code(404);
    echo json_encode(['error' => 'EPI non trouvé']);
    exit;
}

// Seul le propriétaire ou un admin peut agir sur cet EPI
if ((int)$epi['user_id'] !== (int)$user['sub'] && $user['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Accès refusé']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode($epi);

} elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $body = json_decode(file_get_contents('php://input'), true);

    $status   = $body['status']   ?? $epi['status'];
    $category = $body['category'] ?? $epi['category'];
    $tag_ref  = $body['tag_ref']  ?? $epi['tag_ref'];
    $site_id  = array_key_exists('site_id', $body ?? []) ? $body['site_id'] : $epi['site_id'];

    $stmt = $db->prepare('UPDATE epis SET status = ?, category = ?, tag_ref = ?, site_id = ? WHERE id = ?');
    $stmt->execute([$status, $category, $tag_ref, $site_id, $id]);

    echo json_encode(['message' => 'EPI mis à jour']);

} elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $stmt = $db->prepare('DELETE FROM epis WHERE id = ?');
    $stmt->execute([$id]);

    echo json_encode(['message' => 'EPI supprimé']);

} else {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée']);
}
