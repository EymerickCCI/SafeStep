<?php
// Base de données (MAMP : port 8889 par défaut, ajuster si besoin)
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'safestep');
define('DB_USER', 'AdminSafeStep');
define('DB_PASS', 'l!exAy5o?sS5Vkp9');

// JWT
define('JWT_SECRET', 'FhjTEB6e81greqgr45GRRwN291grNBon');
define('JWT_EXPIRE', 3600); // 1 heure

// APIs externes
define('OPENWEATHER_API_KEY', getenv('OPENWEATHER_API_KEY'));
