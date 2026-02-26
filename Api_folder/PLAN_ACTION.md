# SafeStep PWA — Plan d'action

> Projet de cours — Rendu final à 16h30 par mail à legac.cyril@nerdspirit.fr

---

## Contexte

PWA pour techniciens BTP travaillant en zones sans connectivité (tunnels, sous-sols).
L'app gère les **EPI (équipements de protection individuelle)** avec synchronisation hors-ligne et données externes (météo + trafic).

---

## Répartition de l'équipe

| Rôle | Qui |
|---|---|
| Frontend (HTML/CSS/JS PWA) | Personne dédiée |
| Base de données (MySQL) | Personne dédiée |
| Backend PHP + API + JWT + Offline | Toi (+ simulations équipe) |

---

## Stack technique

- **Backend** : PHP 8 + PDO (MySQL via MAMP)
- **Auth** : JWT (Authorization: Bearer)
- **Frontend** : HTML/CSS/JS vanilla (PWA = manifest + service worker)
- **Offline** : Dexie.js (IndexedDB wrapper)
- **APIs externes** : OpenWeatherMap (météo) + une API trafic (ex: TomTom ou mock)
- **Déploiement** : à déterminer (hébergement mutualisé ou VPS)

---

## Structure du projet

```
SafeStep/
├── api/
│   ├── auth/
│   │   ├── login.php          # POST /api/auth/login → retourne JWT
│   │   └── register.php       # POST /api/auth/register
│   ├── epis/
│   │   ├── index.php          # GET /api/epis (liste) + POST (créer)
│   │   └── item.php           # GET/PUT/DELETE /api/epis/{id}
│   └── external/
│       ├── meteo.php          # GET /api/external/meteo
│       └── trafic.php         # GET /api/external/trafic
├── config/
│   ├── database.php           # Connexion PDO
│   └── jwt.php                # Encode/decode JWT
├── middleware/
│   └── auth.php               # Vérification du token Bearer
├── public/                    # Frontend (géré par l'autre personne)
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js                  # Service Worker
│   └── js/
│       └── db.js              # Dexie.js (offline)
├── sql/
│   └── safestep.sql           # Script BDD (géré par l'autre personne)
└── README.md
```

---

## Ce qu'il faut implémenter (priorités)

### 1. Base de données (à faire en premier)

Tables minimales :
- `users` : id, email, password_hash, created_at
- `epis` : id, user_id, nom, type, date_expiration, statut, synced_at

### 2. Authentification JWT

- `POST /api/auth/login` → vérifie email/password → retourne token JWT
- Chaque endpoint protégé lit le header `Authorization: Bearer <token>` et le valide
- Si absent ou invalide → **401**

### 3. CRUD EPI

- `GET /api/epis` → liste des EPIs de l'utilisateur connecté → **200**
- `POST /api/epis` → créer un EPI (champs requis : nom, type, date_expiration) → **201** ou **400** si incomplet
- `PUT /api/epis/{id}` → modifier → **200** ou **404**
- `DELETE /api/epis/{id}` → supprimer → **200** ou **404**

### 4. APIs externes (simple, juste récupérer et retransmettre)

- `GET /api/external/meteo?ville=Paris` → appel OpenWeatherMap → retourne données simplifiées
- `GET /api/external/trafic?origine=...&destination=...` → appel API trafic → retourne temps estimé

### 5. Offline (Dexie.js — côté frontend)

- Stocker les EPIs en IndexedDB via Dexie.js
- Queue de sync : quand offline, on stocke les mutations en attente
- Au retour en ligne : on rejoue la queue vers l'API
- Testé via mode avion du navigateur

---

## Codes HTTP à gérer

| Code | Cas |
|---|---|
| 200 | Succès |
| 201 | Ressource créée |
| 400 | Requête incomplète / données manquantes |
| 401 | Token absent, invalide ou expiré |
| 404 | Ressource introuvable |
| 500 | Erreur serveur |

---

## Critères d'évaluation (ce que le prof va tester)

1. **401** — accès sans token ou avec token corrompu → doit retourner 401
2. **400** — envoi d'un POST avec champs manquants → doit retourner 400
3. **Persistance offline** — saisir des données en mode avion, recharger, se reconnecter → les données doivent survivre et se synchro
4. **Météo + Trafic** — affichage de données pertinentes sur l'interface

---

## Livrables à rendre

- URL live de l'application déployée
- Lien GitHub (code propre, commenté)
- Code source complet
- Documentation technique (README suffit)

---

## Ordre de travail recommandé

1. Créer la BDD + tables SQL
2. Config PDO + middleware JWT
3. Route login → génération token
4. CRUD EPIs avec protection JWT
5. Routes APIs externes (météo + trafic)
6. Tester les codes HTTP (Postman ou curl)
7. Brancher le frontend sur l'API
8. Implémenter Dexie.js + sync offline
9. Tester le scénario mode avion
10. Déployer + écrire le README

---

## Notes

- Pas de framework backend (PHP natif + PDO)
- JWT sans librairie externe si possible (HMAC SHA256 manuel) — sinon `firebase/php-jwt` via Composer
- OpenWeatherMap a une offre gratuite (clé API à créer)
- Pour le trafic, une réponse mockée est acceptable si l'API est bloquée
