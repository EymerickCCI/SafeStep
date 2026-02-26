# Guide de déploiement — SafeStep

> À destination du dev front pour la mise en ligne

---

## 1. Fichiers à uploader sur l'hébergeur

Uploader **tout le contenu** du repo à la racine de ton hébergement (via FTP ou Git) :

```
SafeStep/
├── api/
├── config/
│   ├── config.example.php   ← à dupliquer en config.php
│   └── database.php
├── middleware/
├── public/                  ← frontend (ton HTML/CSS va ici)
│   ├── index.html
│   ├── css/
│   ├── js/
│   ├── icons/               ← mettre icon-192.png et icon-512.png
│   ├── manifest.json
│   └── sw.js
├── .htaccess
└── safestep.sql
```

---

## 2. Créer le fichier config.php

Sur le serveur, copier `config/config.example.php` → `config/config.php` et remplir :

```php
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');        // 3306 sur la plupart des hébergeurs
define('DB_NAME', 'nom_de_ta_bdd');
define('DB_USER', 'utilisateur_bdd');
define('DB_PASS', 'mot_de_passe_bdd');

define('JWT_SECRET', 'choisir_une_chaine_longue_et_aleatoire');
define('JWT_EXPIRE', 3600);

define('OPENWEATHER_API_KEY', 'TA_CLE_OPENWEATHERMAP');
```

> ⚠️ Ne jamais commiter ce fichier — il est dans le .gitignore

---

## 3. Importer la base de données

Dans phpMyAdmin de ton hébergeur :
1. Créer une base de données (noter le nom, user, password)
2. Sélectionner la base → onglet **Importer** → choisir `safestep.sql`

---

## 4. Mettre à jour l'URL de l'API dans le frontend

Dans `public/js/app.js`, ligne 1 :

```js
// Remplacer localhost par l'URL de prod
const API_BASE = 'https://ton-domaine.fr/SafeStep';
```

Et dans `public/sw.js`, mettre à jour les chemins du cache selon l'URL finale.

---

## 5. Vérifier le .htaccess

Le fichier `.htaccess` à la racine est indispensable pour que le header JWT fonctionne.
S'assurer que `mod_rewrite` est activé sur l'hébergeur (c'est le cas sur la quasi-totalité des hébergeurs mutualisés).

---

## 6. Test rapide après déploiement

Ouvrir dans Postman, changer la variable `base_url` :
```
https://ton-domaine.fr/SafeStep
```
Lancer **Login ✅ 200** → si tu reçois un token, tout fonctionne.

---

## Compte de test

Un compte est déjà créé en BDD locale (à recréer en prod via `/api/auth/register.php`) :
- Email : `test@safestep.fr`
- Mot de passe : `Test1234`
