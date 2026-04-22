# Projet RouteWatch

Projet multi-modules:

- `fournisseurIdentite`: backend Spring Boot (API, auth, sync Firebase)
- `front-crypto`: interface web manager/visiteur (React + Vite)
- `mobile`: application Ionic/Capacitor (web + Android)
- `crypto`: service carte offline (MBTiles)
- `docker-compose.yml`: orchestration complète

## Démarrage rapide (machine neuve)

1. Copier le dossier du projet
2. Lancer:

```bash
docker compose build
docker compose up -d
```

Aucune dépendance `node_modules`, `dist`, `target` n'est requise dans le dépôt pour ce démarrage.

Les images Docker reconstruisent elles-mêmes :

- `fournisseurIdentite/target` via Maven dans l'image backend
- `crypto/node_modules` dans l'image `carte`
- `front-crypto/node_modules` dans l'image `web`
- `mobile/node_modules` dans l'image `mobile`

Autrement dit, avant la livraison Google Form, vous pouvez supprimer localement `target/`, `node_modules/`, `dist/` et autres artefacts générés : `docker compose build` doit repartir des `pom.xml` et `package-lock.json`.

Important :

- `docker compose build` reconstruit ces artefacts dans les images Docker, pas dans les dossiers Windows du projet
- il est donc normal de ne pas voir `target/` ni `node_modules/` apparaître sur le disque juste après un build Docker

## Suppression Windows Sans Blocage

Pour éviter les erreurs de suppression dans l'Explorateur Windows :

- ouvrez le projet via le chemin court `C:\proute`
- utilisez le script `scripts\open-short-path.cmd` si besoin
- si vous avez les droits administrateur Windows, lancez une fois `scripts\enable-long-paths-admin.cmd`, puis redémarrez Windows

Pourquoi :

- le vrai problème vient surtout des chemins trop longs sous `mobile\node_modules`
- depuis `C:\proute`, les chemins sont beaucoup plus courts et le bouton Supprimer de l'Explorateur fonctionne beaucoup mieux
- après activation de `LongPathsEnabled`, Windows gère aussi mieux les suppressions de dossiers très profonds

## URLs utiles

- Web manager: `http://localhost:5173`
- Mobile (version web): `http://localhost:8100`
- Backend API: `http://localhost:8082`
- Swagger: `http://localhost:8082/swagger-ui/index.html`
- OpenAPI JSON: `http://localhost:8082/v3/api-docs`
- Carte offline: `http://localhost:3000`

## Postman (import direct)

- Collection: `documentation/postman/ProjetRoute.postman_collection.json`
- Environnement local: `documentation/postman/ProjetRoute.local.postman_environment.json`

## Firebase

Le backend lit la clé service account via:

- variable: `FIREBASE_SERVICE_ACCOUNT_PATH=/app/firebase/firebase-service-account.json`
- volume Docker: `FIREBASE_SERVICE_ACCOUNT_DIR` (par défaut `./fournisseurIdentite/src/main/resources/firebase`)

Compte manager bootstrap (créé automatiquement au démarrage backend):

- email: `rojo.rabenanahary@gmail.com`
- username: `rojo.rabenanahary`
- mot de passe par défaut: `admin1234`

Variables configurables dans `.env`:

- `BOOTSTRAP_PRIMARY_MANAGER_USERNAME`
- `BOOTSTRAP_PRIMARY_MANAGER_EMAIL`
- `BOOTSTRAP_PRIMARY_MANAGER_PASSWORD`
- `BOOTSTRAP_LEGACY_MANAGER_ENABLED`

## Build APK Android (reproductible)

Depuis la racine:

```bash
npm --prefix mobile run apk:build:debug
```

Cette commande:

1. réinstalle les dépendances si `mobile/node_modules` est absent
2. reconstruit `mobile/dist`
3. lance `cap sync android`
4. génère l'APK debug via Gradle

APK généré:

- `mobile/android/app/build/outputs/apk/debug/app-debug.apk`

## Préparer l'envoi Google Form (< 100 Mo)

Depuis la racine:

```bash
npm run prepare:submission
```

Cette commande supprime automatiquement les dossiers générés (`node_modules`, `dist`, `target`, `build` Android, logs JVM) et affiche la taille finale du projet.

## Commandes utiles

- Build Docker: `npm run docker:build`
- Start Docker: `npm run docker:up`
- Stop Docker: `npm run docker:down`
- Seed Firebase demo users: `npm run seed:firebase-demo`
