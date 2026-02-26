<?php
require_once __DIR__ . '/../config/jwt.php';

function authenticate(): array {
    $headers = function_exists('getallheaders') ? getallheaders() : [];

    // Fallback si getallheaders() ne retourne pas Authorization
    if (empty($headers['Authorization'])) {
        $headers['Authorization'] = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? '';
    }

    $auth = $headers['Authorization'] ?? '';

    if (!str_starts_with($auth, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['error' => 'Token manquant']);
        exit;
    }

    $token = substr($auth, 7);

    try {
        return JWT::decode($token);
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode(['error' => $e->getMessage()]);
        exit;
    }
}
