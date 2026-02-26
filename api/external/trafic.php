<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

require_once __DIR__ . '/../../middleware/auth.php';

$user = authenticate();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée']);
    exit;
}

$origine     = $_GET['origine']     ?? null;
$destination = $_GET['destination'] ?? null;

if (!$origine || !$destination) {
    http_response_code(400);
    echo json_encode(['error' => 'Paramètres origine et destination requis']);
    exit;
}

// Appel API TomTom Routing (remplacer la clé par la vôtre)
$apiKey = 'VOTRE_CLE_TOMTOM';

// Géocodage simple : on construit l'URL avec les noms de villes
$url = "https://api.tomtom.com/routing/1/calculateRoute/" . urlencode($origine) . ":" . urlencode($destination) . "/json?key={$apiKey}&travelMode=car&traffic=true";

$response = @file_get_contents($url);

if ($response !== false) {
    $data  = json_decode($response, true);
    $route = $data['routes'][0]['summary'] ?? null;

    if ($route) {
        $minutes = round($route['travelTimeInSeconds'] / 60);
        $km      = round($route['lengthInMeters'] / 1000, 1);

        echo json_encode([
            'origine'          => $origine,
            'destination'      => $destination,
            'duree_minutes'    => $minutes,
            'distance_km'      => $km,
            'trafic_inclus'    => true,
        ]);
        exit;
    }
}

// Fallback mock si l'API est indisponible ou non configurée
echo json_encode([
    'origine'       => $origine,
    'destination'   => $destination,
    'duree_minutes' => rand(15, 90),
    'distance_km'   => rand(10, 80),
    'trafic_inclus' => false,
    'note'          => 'Données estimées (API trafic non configurée)',
]);
