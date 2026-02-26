<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = authenticate();
$db   = Database::connect();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée']);
    exit;
}

$stmt = $db->prepare('
    SELECT s.*
    FROM sites s
    INNER JOIN site_user su ON s.id = su.site_id
    WHERE su.user_id = ?
');
$stmt->execute([$user['sub']]);
echo json_encode($stmt->fetchAll());
