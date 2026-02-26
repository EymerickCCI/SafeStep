<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = authenticate();
$db   = Database::connect();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare('
        SELECT e.*, s.name AS site_name
        FROM epis e
        LEFT JOIN sites s ON e.site_id = s.id
        WHERE e.user_id = ?
    ');
    $stmt->execute([$user['sub']]);
    echo json_encode($stmt->fetchAll());

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['tag_ref']) || empty($body['status']) || empty($body['category'])) {
        http_response_code(400);
        echo json_encode(['error' => 'tag_ref, status et category sont requis']);
        exit;
    }

    $validStatus   = ['conforme', 'a_inspecter', 'endommage', 'en_maintenance'];
    $validCategory = ['casque', 'harnais', 'detecteur_gaz', 'gants', 'gilet', 'autre'];

    if (!in_array($body['status'], $validStatus) || !in_array($body['category'], $validCategory)) {
        http_response_code(400);
        echo json_encode(['error' => 'Valeur status ou category invalide']);
        exit;
    }

    $stmt = $db->prepare('INSERT INTO epis (user_id, site_id, tag_ref, status, category) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([
        $user['sub'],
        $body['site_id'] ?? null,
        $body['tag_ref'],
        $body['status'],
        $body['category'],
    ]);

    http_response_code(201);
    echo json_encode(['id' => (int)$db->lastInsertId(), 'message' => 'EPI créé']);

} else {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée']);
}
