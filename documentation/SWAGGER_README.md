# Swagger Documentation - Projet RouteWatch

## Direct access
- UI: `http://localhost:8082/swagger-ui/index.html`
- OpenAPI JSON: `http://localhost:8082/v3/api-docs`

Swagger is configured to work directly on the current host (`/` server URL), so it opens correctly on any machine/IP without manual server override.

## Authentication
Swagger provides `Authorize` with JWT Bearer.

1. Run `POST /api/auth/login`
2. Copy `token` from the response
3. Click `Authorize`
4. Paste: `Bearer <token>`

## Requirements
- Backend started (Docker or local)
- Default backend port: `8082`

## Notes
- Swagger endpoint is public in security config.
- All controllers are auto-documented by Springdoc (`springdoc-openapi-starter-webmvc-ui`).
- Postman files are in `documentation/postman/`.
