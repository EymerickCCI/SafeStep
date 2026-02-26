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

$apiKey = '5hMuoeGLB2iNFDsVVair0pyAA0BkCz2u';

// Étape 1 : Géocodage ville → coordonnées GPS via TomTom Search API
function geocode(string $ville, string $apiKey): ?string {
    $url      = "https://api.tomtom.com/search/2/geocode/" . urlencode($ville) . ".json?key={$apiKey}&limit=1";
    $response = @file_get_contents($url);
    if (!$response) return null;
    $data = json_decode($response, true);
    $pos  = $data['results'][0]['position'] ?? null;
    if (!$pos) return null;
    return $pos['lat'] . ',' . $pos['lon'];
}

$coordOrigine     = geocode($origine, $apiKey);
$coordDestination = geocode($destination, $apiKey);

if (!$coordOrigine || !$coordDestination) {
    // Fallback mock si géocodage échoue
    echo json_encode([
        'origine'       => $origine,
        'destination'   => $destination,
        'duree_minutes' => rand(15, 90),
        'distance_km'   => rand(10, 80),
        'trafic_inclus' => false,
        'note'          => 'Géocodage impossible, données estimées',
    ]);
    exit;
}

// Étape 2 : Calcul d'itinéraire avec coordonnées réelles
$url      = "https://api.tomtom.com/routing/1/calculateRoute/{$coordOrigine}:{$coordDestination}/json?key={$apiKey}&travelMode=car&traffic=true";
$response = @file_get_contents($url);

if ($response !== false) {
    $data  = json_decode($response, true);
    $route = $data['routes'][0]['summary'] ?? null;

    if ($route) {
        $minutes = round($route['travelTimeInSeconds'] / 60);
        $km      = round($route['lengthInMeters'] / 1000, 1);

        echo json_encode([
            'origine'       => $origine,
            'destination'   => $destination,
            'duree_minutes' => $minutes,
            'distance_km'   => $km,
            'trafic_inclus' => true,
        ]);
        exit;
    }
}

// Fallback mock si l'API routing échoue
echo json_encode([
    'origine'       => $origine,
    'destination'   => $destination,
    'duree_minutes' => rand(15, 90),
    'distance_km'   => rand(10, 80),
    'trafic_inclus' => false,
    'note'          => 'Données estimées (erreur API routing)',
]);
