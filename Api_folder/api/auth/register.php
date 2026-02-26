<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/jwt.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);

if (empty($body['email']) || empty($body['password']) || empty($body['first_name']) || empty($body['last_name'])) {
    http_response_code(400);
    echo json_encode(['error' => 'email, password, first_name et last_name sont requis']);
    exit;
}

$db = Database::connect();

$stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$body['email']]);
if ($stmt->fetch()) {
    http_response_code(400);
    echo json_encode(['error' => 'Email déjà utilisé']);
    exit;
}

$validRoles = ['technicien', 'chef_de_chantier', 'admin'];
$role = in_array($body['role'] ?? '', $validRoles) ? $body['role'] : 'technicien';

$stmt = $db->prepare('INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([
    $body['email'],
    password_hash($body['password'], PASSWORD_DEFAULT),
    $body['first_name'],
    $body['last_name'],
    $role,
]);

$id    = $db->lastInsertId();
$token = JWT::encode(['sub' => (int)$id, 'email' => $body['email'], 'role' => $role]);

http_response_code(201);
echo json_encode([
    'token' => $token,
    'user'  => [
        'id'         => (int)$id,
        'email'      => $body['email'],
        'first_name' => $body['first_name'],
        'last_name'  => $body['last_name'],
        'role'       => $role,
    ],
]);
