import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { useMap } from 'react-leaflet';

type OfflinePlaceLabelsLayerProps = {
  url: string;
};

type SupportedLayer = 'place' | 'poi' | 'transportation_name' | 'water_name';

type LabelFeature = {
  layer: SupportedLayer;
  label: string;
  lat: number;
  lng: number;
};

const SUPPORTED_LAYERS: SupportedLayer[] = ['place', 'poi', 'transportation_name', 'water_name'];
const SOURCE_MAX_ZOOM = 14;

const LAYER_MIN_ZOOM: Record<SupportedLayer, number> = {
  place: 12,
  poi: 14,
  transportation_name: 14,
  water_name: 13,
};

const LAYER_PRIORITY: Record<SupportedLayer, number> = {
  place: 0,
  water_name: 1,
  transportation_name: 2,
  poi: 3,
};

const LAYER_MAX_LABELS: Record<SupportedLayer, number> = {
  place: 48,
  water_name: 28,
  transportation_name: 46,
  poi: 34,
};

const LAYER_GRID_SIZE: Record<SupportedLayer, number> = {
  place: 126,
  water_name: 108,
  transportation_name: 92,
  poi: 88,
};

const LAYER_CLASS: Record<SupportedLayer, string> = {
  place: 'offline-label-place',
  poi: 'offline-label-poi',
  transportation_name: 'offline-label-road',
  water_name: 'offline-label-water',
};

const MAX_LABELS = 160;
const VIEWPORT_MARGIN = 24;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const tileUrl = (template: string, z: number, x: number, y: number) =>
  template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

const normalizeLabel = (input?: unknown) =>
  typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';

const isUsableLabel = (label: string) => {
  if (!label) {
    return false;
  }
  if (label.length < 3) {
    return false;
  }
  return true;
};

const pickFeatureLabel = (properties: Record<string, unknown>) =>
  normalizeLabel(properties['name:fr']) ||
  normalizeLabel(properties['name:en']) ||
  normalizeLabel(properties.name) ||
  normalizeLabel(properties.name_int);

const mercatorTile = (lat: number, lng: number, z: number) => {
  const scale = 2 ** z;
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
};

const tileRangeForBounds = (bounds: L.LatLngBounds, z: number) => {
  const northWest = mercatorTile(bounds.getNorth(), bounds.getWest(), z);
  const southEast = mercatorTile(bounds.getSouth(), bounds.getEast(), z);
  const limit = (2 ** z) - 1;

  const minX = clamp(Math.floor(northWest.x), 0, limit);
  const maxX = clamp(Math.floor(southEast.x), 0, limit);
  const minY = clamp(Math.floor(northWest.y), 0, limit);
  const maxY = clamp(Math.floor(southEast.y), 0, limit);

  const tiles: Array<{ z: number; x: number; y: number }> = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      tiles.push({ z, x, y });
    }
  }
  return tiles;
};

const clampSourceZoom = (zoom: number) => clamp(zoom, 0, SOURCE_MAX_ZOOM);

const lineCenter = (coords: number[][]) => {
  if (!coords.length) return null;
  return coords[Math.floor(coords.length / 2)];
};

const polygonCenter = (coords: number[][][]) => {
  if (!coords.length || !coords[0].length) return null;
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (const [lng, lat] of coords[0]) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
    return null;
  }
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
};

const featurePosition = (geometry: { type: string; coordinates: any }): [number, number] | null => {
  if (!geometry) return null;

  if (geometry.type === 'Point') {
    return geometry.coordinates as [number, number];
  }
  if (geometry.type === 'MultiPoint') {
    return geometry.coordinates?.[0] || null;
  }
  if (geometry.type === 'LineString') {
    return lineCenter(geometry.coordinates);
  }
  if (geometry.type === 'MultiLineString') {
    return lineCenter(geometry.coordinates?.[0] || []);
  }
  if (geometry.type === 'Polygon') {
    return polygonCenter(geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return polygonCenter(geometry.coordinates?.[0] || []);
  }

  return null;
};

const decodeTileLabels = (buffer: ArrayBuffer, z: number, x: number, y: number) => {
  const vt = new VectorTile(new Pbf(new Uint8Array(buffer)));
  const labels: LabelFeature[] = [];

  for (const layerName of SUPPORTED_LAYERS) {
    const tileLayer = vt.layers[layerName];
    if (!tileLayer) {
      continue;
    }

    for (let i = 0; i < tileLayer.length; i += 1) {
      const feature = tileLayer.feature(i);
      const properties = feature.properties as Record<string, unknown>;
      const label = pickFeatureLabel(properties);
      if (!label) {
        continue;
      }

      const geoJson = feature.toGeoJSON(x, y, z) as any;
      const coords = featurePosition(geoJson?.geometry);
      if (!coords) {
        continue;
      }

      const [lng, lat] = coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }

      labels.push({
        layer: layerName,
        label,
        lat,
        lng,
      });
    }
  }

  return labels;
};

export default function OfflinePlaceLabelsLayer({ url }: OfflinePlaceLabelsLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);
  const tileCacheRef = useRef<Map<string, Promise<LabelFeature[]>>>(new Map());

  useEffect(() => {
    const layer = L.layerGroup();
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      layer.clearLayers();
      map.removeLayer(layer);
      layerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    let cancelled = false;

    const fetchLabelsForTile = async (z: number, x: number, y: number) => {
      const cacheKey = `${z}/${x}/${y}`;
      const cached = tileCacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      const work = (async () => {
        try {
          const response = await fetch(tileUrl(url, z, x, y));
          if (!response.ok) {
            return [];
          }
          const data = await response.arrayBuffer();
          return decodeTileLabels(data, z, x, y);
        } catch {
          return [];
        }
      })();

      tileCacheRef.current.set(cacheKey, work);
      return work;
    };

    const renderLabels = async () => {
      const labelsLayer = layerRef.current;
      if (!labelsLayer) {
        return;
      }

      labelsLayer.clearLayers();

      const currentZoom = map.getZoom();
      if (currentZoom < 11.5) {
        return;
      }

      const sourceZoom = clampSourceZoom(Math.round(currentZoom));
      const visibleBounds = map.getBounds().pad(0.06);
      const tiles = tileRangeForBounds(visibleBounds, sourceZoom);
      const tileLabels = await Promise.all(tiles.map((tile) => fetchLabelsForTile(tile.z, tile.x, tile.y)));

      if (cancelled) {
        return;
      }

      const dedup = new Set<string>();
      const occupiedCells = new Set<string>();
      const perLayerCounts: Record<SupportedLayer, number> = {
        place: 0,
        water_name: 0,
        transportation_name: 0,
        poi: 0,
      };

      const viewport = map.getSize();
      const visibleLabels: LabelFeature[] = [];

      for (const labels of tileLabels) {
        for (const item of labels) {
          if (currentZoom < LAYER_MIN_ZOOM[item.layer]) {
            continue;
          }

          if (!visibleBounds.contains([item.lat, item.lng])) {
            continue;
          }

          if (!isUsableLabel(item.label)) {
            continue;
          }

          const dedupKey = `${item.layer}|${item.label}|${item.lat.toFixed(4)}|${item.lng.toFixed(4)}`;
          if (dedup.has(dedupKey)) {
            continue;
          }

          const point = map.latLngToContainerPoint([item.lat, item.lng]);
          if (
            point.x < VIEWPORT_MARGIN ||
            point.y < VIEWPORT_MARGIN ||
            point.x > viewport.x - VIEWPORT_MARGIN ||
            point.y > viewport.y - VIEWPORT_MARGIN
          ) {
            continue;
          }

          if (perLayerCounts[item.layer] >= LAYER_MAX_LABELS[item.layer]) {
            continue;
          }

          const gridSize = LAYER_GRID_SIZE[item.layer];
          const cellX = Math.floor(point.x / gridSize);
          const cellY = Math.floor(point.y / gridSize);
          const cellKey = `${item.layer}|${cellX}|${cellY}`;
          if (occupiedCells.has(cellKey)) {
            continue;
          }

          dedup.add(dedupKey);
          occupiedCells.add(cellKey);
          perLayerCounts[item.layer] += 1;
          visibleLabels.push(item);
        }
      }

      visibleLabels
        .sort((a, b) => LAYER_PRIORITY[a.layer] - LAYER_PRIORITY[b.layer] || a.label.localeCompare(b.label))
        .slice(0, MAX_LABELS)
        .forEach((item) => {
          const anchor = L.circleMarker([item.lat, item.lng], {
            radius: 0,
            opacity: 0,
            fillOpacity: 0,
            interactive: false,
          });

          anchor.bindTooltip(item.label, {
            permanent: true,
            direction: 'center',
            className: `offline-map-label ${LAYER_CLASS[item.layer]}`,
            opacity: 1,
            interactive: false,
          });

          anchor.addTo(labelsLayer);
        });
    };

    renderLabels();
    map.on('moveend', renderLabels);
    map.on('zoomend', renderLabels);

    return () => {
      cancelled = true;
      map.off('moveend', renderLabels);
      map.off('zoomend', renderLabels);
    };
  }, [map, url]);

  return null;
}
