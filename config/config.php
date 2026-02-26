<?php
// Chargement du fichier .env
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        if (!str_contains($line, '=')) continue;
        [$name, $value] = explode('=', $line, 2);
        putenv(trim($name) . '=' . trim($value));
    }
}

define('DB_HOST',            getenv('DB_HOST')         ?: 'localhost');
define('DB_PORT',            getenv('DB_PORT')         ?: '3306');
define('DB_NAME',            getenv('DB_NAME')         ?: 'safestep');
define('DB_USER',            getenv('DB_USER')         ?: 'root');
define('DB_PASS',            getenv('DB_PASS')         ?: '');
define('JWT_SECRET',         getenv('JWT_SECRET')      ?: 'changeme');
define('JWT_EXPIRE',         3600);
define('OPENWEATHER_API_KEY', getenv('WEATHER_API_KEY') ?: '');
define('TOMTOM_API_KEY',      getenv('TRAFFIC_API_KEY') ?: '');
