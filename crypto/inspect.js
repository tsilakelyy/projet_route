const MBTiles = require('@mapbox/mbtiles');
const path = require('path');

const mbtilesPath = path.join(__dirname, 'osm-2020-02-10-v3.11_madagascar_antananarivo.mbtiles');

new MBTiles(mbtilesPath, (err, mbtiles) => {
  if (err) {
    console.error('Erreur lors de l\'ouverture du fichier MBTiles:', err);
    process.exit(1);
  }

  // Obtenir les informations sur les métadonnées
  mbtiles.getInfo((err, info) => {
    if (err) {
      console.error('Erreur lors de la récupération des infos:', err);
      return;
    }

    console.log('Informations MBTiles:', JSON.stringify(info, null, 2));

    // Tester quelques tuiles autour d'Antananarivo
    const testTiles = [
      { z: 12, x: 2200, y: 1536 },
      { z: 12, x: 2201, y: 1536 },
      { z: 12, x: 2200, y: 1537 },
      { z: 10, x: 550, y: 384 },
      { z: 10, x: 551, y: 384 }
    ];

    testTiles.forEach(tile => {
      // Convertir Y XYZ vers TMS
      const tmsY = (1 << tile.z) - 1 - tile.y;
      mbtiles.getTile(tile.z, tile.x, tmsY, (err, data, headers) => {
        if (err) {
          console.log(`Tuile ${tile.z}/${tile.x}/${tile.y} (TMS: ${tmsY}) : NON TROUVÉE`);
        } else {
          console.log(`Tuile ${tile.z}/${tile.x}/${tile.y} (TMS: ${tmsY}) : TROUVÉE (${data.length} bytes)`);
        }
      });
    });
  });
});