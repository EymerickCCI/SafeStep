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

if (empty($body['email']) || empty($body['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Email et mot de passe requis']);
    exit;
}

$db = Database::connect();
$stmt = $db->prepare('SELECT * FROM users WHERE email = ?');
$stmt->execute([$body['email']]);
$user = $stmt->fetch();

if (!$user || !password_verify($body['password'], $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Identifiants incorrects']);
    exit;
}

$token = JWT::encode([
    'sub'   => $user['id'],
    'email' => $user['email'],
    'role'  => $user['role'],
]);

echo json_encode([
    'token' => $token,
    'user'  => [
        'id'         => $user['id'],
        'email'      => $user['email'],
        'first_name' => $user['first_name'],
        'last_name'  => $user['last_name'],
        'role'       => $user['role'],
    ],
]);
