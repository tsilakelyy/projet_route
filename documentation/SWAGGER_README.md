# Swagger - Projet RouteWatch

## Acces direct
Apres demarrage du backend, Swagger est accessible sans configuration manuelle:

- UI: `http://localhost:8082/swagger-ui/index.html`
- OpenAPI JSON: `http://localhost:8082/v3/api-docs`
- OpenAPI YAML: `http://localhost:8082/v3/api-docs.yaml`

## Prerequis

1. Demarrer le projet (`docker compose up -d`) ou lancer le backend Spring Boot localement.
2. Verifier que le backend ecoute sur `8082`.

## Utilisation rapide

1. Ouvrir `http://localhost:8082/swagger-ui/index.html`.
2. Cliquer sur `Authorize`.
3. Coller le token JWT (format: `Bearer <token>`).
4. Tester les endpoints via `Try it out`.

## Notes techniques

- Swagger est expose par `springdoc-openapi`.
- Les routes de documentation sont publiques dans la securite Spring:
  - `/swagger-ui/**`
  - `/v3/api-docs/**`
- Le schema JWT Bearer est declare dans la configuration OpenAPI pour un usage direct du bouton `Authorize`.

## Lien Postman

Collection et environnement prets a importer:

- `documentation/postman/ProjetRoute.postman_collection.json`
- `documentation/postman/ProjetRoute.local.postman_environment.json`
