# Postman Documentation - Projet RouteWatch

## Files to import
- `documentation/postman/ProjetRoute.postman_collection.new.json`
- `documentation/postman/ProjetRoute.local.postman_environment.json`

A standard alias is also provided:
- `documentation/postman/ProjetRoute.postman_collection.json`

## Direct import (no manual setup)
1. Open Postman
2. Click `Import`
3. Import the collection and environment files above
4. Select environment `ProjetRoute Local`
5. Run `01 - Auth > POST /api/auth/login (manager)` first

The login request stores `authToken` automatically for protected endpoints.

## Default values (already prefilled)
- `baseUrl`: `http://localhost:8082`
- `managerEmail`: `adminfirebase@gmail.com`
- `managerPassword`: `admin1234`
- IDs (`signalementId`, `travauxId`, etc.) are auto-filled by test scripts

## Functional coverage
The collection includes all backend REST functionalities from controllers:
- Health + docs
- Auth + users + params + lock management
- Entreprises
- Lieux
- Signalements
- Travaux
- Historiques travaux
- Sync
- Analytics
- Presence sync
- Discovery + visitor endpoints
- Cleanup

## Newman (CLI)
```bash
newman run documentation/postman/ProjetRoute.postman_collection.new.json -e documentation/postman/ProjetRoute.local.postman_environment.json --bail
```

## Quick troubleshooting
- `401`: run login request again to refresh `authToken`
- `404`: verify backend is running on `http://localhost:8082`
- `500`: check backend logs and database connectivity
