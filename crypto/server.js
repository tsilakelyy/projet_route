const express = require('express');
const path = require('path');
const MBTiles = require('@mapbox/mbtiles');

const app = express();
const port = 3000;

// Servir les fichiers statiques
const publicDir = path.join(__dirname, 'public');
const stylesDir = path.join(__dirname, 'styles');

app.use(express.static(publicDir));
app.use('/styles', express.static(stylesDir));

let mbtiles;
let mbtilesInfo = null;

const mbtilesPath = path.join(__dirname, 'osm-2020-02-10-v3.11_madagascar_antananarivo.mbtiles');

console.log('Chargement du fichier MBTiles:', mbtilesPath);

new MBTiles(mbtilesPath, (err, tiles) => {
  if (err) {
    console.error('Erreur lors du chargement du fichier MBTiles:', err);
    return;
  }

  mbtiles = tiles;
  console.log('MBTiles chargÃ© avec succÃ¨s');

  mbtiles.getInfo((infoError, info) => {
    if (infoError) {
      console.error('Erreur lors de la lecture des mÃ©tadonnÃ©es:', infoError);
      return;
    }
    mbtilesInfo = info;
    console.log(`MBTiles chargÃ©: format=${info.format}, bounds=[${info.bounds}], center=[${info.center}]`);
  });
});

function serveTile(req, res) {
  if (!mbtiles) {
    return res.status(500).send('MBTiles non disponible');
  }

  const z = parseInt(req.params.z, 10);
  const x = parseInt(req.params.x, 10);
  const y = parseInt(req.params.y, 10);
  const ext = (req.params.ext || 'png').toLowerCase();

  if (isNaN(z) || isNaN(x) || isNaN(y)) {
    return res.status(400).send('CoordonnÃ©es invalides');
  }

  // @mapbox/mbtiles attend des coordonnees XYZ directement.
  mbtiles.getTile(z, x, y, (tileErr, tile, headers) => {
    if (tileErr) {
      console.log(`Tuile non trouvÃ©e: ${z}/${x}/${y}`);
      return res.status(404).send('Tuile non trouvÃ©e');
    }

    if (headers) {
      res.set(headers);
    }
    if (ext === 'pbf' && !res.getHeader('Content-Type')) {
      res.set('Content-Type', 'application/x-protobuf');
    }
    
    return res.send(tile);
  });
}

// Routes pour les tuiles
app.get('/tiles/:z/:x/:y.:ext', serveTile);
app.get('/tiles/:z/:x/:y', serveTile);
app.get('/data/antananarivo/:z/:x/:y.:ext', serveTile);
app.get('/data/antananarivo/:z/:x/:y', serveTile);
// Compatibilite: certains clients resolvent les tuiles en /styles/data/...
app.get('/styles/data/antananarivo/:z/:x/:y.:ext', serveTile);
app.get('/styles/data/antananarivo/:z/:x/:y', serveTile);

// Route pour les mÃ©tadonnÃ©es
app.get('/metadata', (req, res) => {
  if (!mbtilesInfo) {
    return res.status(503).json({ error: 'MÃ©tadonnÃ©es non disponibles' });
  }
  return res.json(mbtilesInfo);
});

// Route de santÃ©
app.get('/health', (req, res) => {
  const status = mbtiles ? 'OK' : 'DÃ©marrage';
  res.json({ status: status, service: 'carte-server' });
});

// Route racine
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Serveur de cartes dÃ©marrÃ© sur le port ${port}`);
});

