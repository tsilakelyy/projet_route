# web

Application Web principale (manager + visiteur) pour RouteWatch.

## Variables
- `VITE_API_URL=`: laisser vide pour meme origine (`/api`) en Docker/Nginx.
- `VITE_TILE_URL=`: par defaut `/data/antananarivo/{z}/{x}/{y}.pbf` (proxy vers service `carte`).
- `VITE_STYLE_URL=`: par defaut `/styles/bright/style.json`.

## Execution locale (dev)
```bash
npm install
npm run dev
```

## Build local
```bash
npm run build
```

## Build Docker
```bash
docker-compose build web
docker-compose up -d web
```
