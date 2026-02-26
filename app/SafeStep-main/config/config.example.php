<?php
// Copier ce fichier en config.php et remplir les valeurs

// Base de données (MAMP : port 8889 par défaut)
define('DB_HOST', 'localhost');
define('DB_PORT', '8889');
define('DB_NAME', 'safestep');
define('DB_USER', 'root');
define('DB_PASS', 'root');

// JWT
define('JWT_SECRET', 'CHANGER_CE_SECRET');
define('JWT_EXPIRE', 3600);

// APIs externes
define('OPENWEATHER_API_KEY', 'VOTRE_CLE_OPENWEATHERMAP');
