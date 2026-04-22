# Postman - Projet RouteWatch

## Fichiers a importer (directement)

- Collection: `documentation/postman/ProjetRoute.postman_collection.json`
- Environnement local: `documentation/postman/ProjetRoute.local.postman_environment.json`

Ces deux fichiers sont preconfigures pour fonctionner sans edition manuelle apres import.

## Couverture fonctionnelle

La collection couvre toutes les routes backend exposees par les controllers Spring Boot:

- Health & docs (`/`, `/api/auth/test`, Swagger, OpenAPI)
- Auth (login/register, mobile, firebase, users, params, lock, logout)
- Entreprises (CRUD)
- Lieux (CRUD + recherche par ville)
- Signalements (CRUD + sync + stats + notifications)
- Travaux (CRUD + historique + stats)
- Historiques travaux (CRUD)
- Sync (`/api/sync/full`, `/firebase-to-local`, `/local-to-firebase`)
- Analytics (`criticality`, `audit`, `impact`, `blocked-users`)
- Presence sync (`heartbeat`, `pending-sync`, `ack-sync`, `web/mobile-active`)
- Discovery & visitor (`/api/discovery/ping`, `/api/visitors/signalements`)

## Variables deja configurees

Exemples:

- `baseUrl = http://localhost:8082`
- `managerEmail = rojo.rabenanahary@gmail.com`
- `managerPassword = admin1234`
- IDs de travail (`signalementId`, `travauxId`, `entrepriseId`, etc.)

Les IDs et le token sont remplis automatiquement par les scripts Postman sur les requetes de creation/login.

## Import dans Postman

1. Ouvrir Postman.
2. `Import` -> selectionner les 2 fichiers JSON ci-dessus.
3. Choisir l'environnement `ProjetRoute Local`.
4. Executer `01 - Auth / POST /api/auth/login (manager)` pour initialiser `authToken`.

## Execution Newman (CI/CLI)

```bash
newman run documentation/postman/ProjetRoute.postman_collection.json -e documentation/postman/ProjetRoute.local.postman_environment.json
```

## URL utiles

- API backend: `http://localhost:8082`
- Swagger UI: `http://localhost:8082/swagger-ui/index.html`
- OpenAPI JSON: `http://localhost:8082/v3/api-docs`
