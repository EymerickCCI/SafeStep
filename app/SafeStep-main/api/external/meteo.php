<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = authenticate();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée']);
    exit;
}

$ville = $_GET['ville'] ?? null;

// Résolution de la ville depuis site_id si fourni
if (!$ville && !empty($_GET['site_id'])) {
    $db   = Database::connect();
    $stmt = $db->prepare('SELECT ville FROM sites WHERE id = ?');
    $stmt->execute([$_GET['site_id']]);
    $site = $stmt->fetch();
    $ville = $site['ville'] ?? null;
}

if (!$ville) {
    http_response_code(400);
    echo json_encode(['error' => 'Paramètre ville ou site_id requis']);
    exit;
}

$url      = "https://api.openweathermap.org/data/2.5/weather?q=" . urlencode($ville) . "&appid=" . OPENWEATHER_API_KEY . "&units=metric&lang=fr";
$response = @file_get_contents($url);

if ($response === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Impossible de récupérer les données météo']);
    exit;
}

$data = json_decode($response, true);

if (isset($data['cod']) && $data['cod'] !== 200) {
    http_response_code(404);
    echo json_encode(['error' => 'Ville non trouvée']);
    exit;
}

$windSpeed = $data['wind']['speed']    ?? 0;
$temp      = $data['main']['temp']     ?? 20;
$rain      = $data['rain']['1h']       ?? 0;

// Alerte si conditions défavorables pour travaux BTP
$alerte = null;
if ($windSpeed > 10) $alerte = "Vent fort ({$windSpeed} m/s) — travaux en hauteur déconseillés";
if ($temp < 0)       $alerte = "Température négative ({$temp}°C) — risque de verglas";
if ($rain > 5)       $alerte = "Fortes précipitations ({$rain} mm/h) — sol glissant";

echo json_encode([
    'ville'       => $ville,
    'temperature' => $temp,
    'description' => $data['weather'][0]['description'] ?? null,
    'wind_speed'  => $windSpeed,
    'humidity'    => $data['main']['humidity'] ?? null,
    'rain_1h'     => $rain,
    'alerte'      => $alerte,
]);
