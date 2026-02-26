<?php
// Base de données (MAMP : port 8889 par défaut, ajuster si besoin)
define('DB_HOST', 'localhost');
define('DB_PORT', '8889');
define('DB_NAME', 'safestep');
define('DB_USER', 'root');
define('DB_PASS', 'root');

// JWT
define('JWT_SECRET', 'safestep_jwt_secret_2026_changeme');
define('JWT_EXPIRE', 3600); // 1 heure

// APIs externes
define('OPENWEATHER_API_KEY', 'VOTRE_CLE_ICI');
