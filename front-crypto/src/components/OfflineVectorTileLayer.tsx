import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet.vectorgrid';
import { useMap } from 'react-leaflet';

type OfflineVectorTileLayerProps = {
  url: string;
};

const hiddenStyle = {
  weight: 0,
  opacity: 0,
  fillOpacity: 0,
};

const roadColor = (klass?: string) => {
  switch (klass) {
    case 'motorway':
      return '#c7725f';
    case 'trunk':
      return '#cf8168';
    case 'primary':
      return '#d39b68';
    case 'secondary':
      return '#d5b080';
    case 'tertiary':
      return '#c9bb95';
    case 'minor':
      return '#b9a88a';
    default:
      return '#8f816d';
  }
};

const roadWeight = (zoom = 12) => {
  if (zoom <= 6) return 0.45;
  if (zoom <= 10) return 1.3;
  if (zoom <= 12) return 2.2;
  if (zoom <= 14) return 3.4;
  if (zoom <= 16) return 4.8;
  return 6.2;
};

const vectorTileLayerStyles: Record<string, any> = {
  water: () => ({
    fill: true,
    fillColor: '#9ecae8',
    fillOpacity: 1,
    color: '#9ecae8',
    weight: 0.2,
    opacity: 1,
  }),
  waterway: (_: unknown, zoom: number) => ({
    color: '#67a8cd',
    weight: zoom >= 14 ? 2.3 : zoom >= 12 ? 1.2 : 0.6,
    opacity: 1,
  }),
  landcover: () => ({
    fill: true,
    fillColor: '#d8e5c4',
    fillOpacity: 0.9,
    color: '#d8e5c4',
    weight: 0.2,
    opacity: 1,
  }),
  landuse: () => ({
    fill: true,
    fillColor: '#cfdeba',
    fillOpacity: 0.72,
    color: '#cfdeba',
    weight: 0.2,
    opacity: 1,
  }),
  park: () => ({
    fill: true,
    fillColor: '#bbdca7',
    fillOpacity: 0.78,
    color: '#bbdca7',
    weight: 0.2,
    opacity: 1,
  }),
  boundary: () => ({
    color: '#85837d',
    weight: 0.9,
    opacity: 0.6,
    dashArray: '3,2',
  }),
  aeroway: () => ({
    color: '#a3a09a',
    weight: 1.1,
    opacity: 0.78,
  }),
  transportation: (properties: any, zoom: number) => ({
    color: roadColor(properties?.class),
    weight: roadWeight(zoom),
    opacity: 0.96,
  }),
  building: (_: unknown, zoom: number) =>
    zoom >= 12.5
      ? {
          fill: true,
          fillColor: '#dcccb7',
          fillOpacity: 0.7,
          color: '#c4b299',
          weight: 0.35,
          opacity: 0.82,
        }
      : hiddenStyle,
  water_name: () => hiddenStyle,
  transportation_name: () => hiddenStyle,
  place: () => hiddenStyle,
  poi: () => hiddenStyle,
  housenumber: () => hiddenStyle,
};

export default function OfflineVectorTileLayer({ url }: OfflineVectorTileLayerProps) {
  const map = useMap();

  useEffect(() => {
    const vectorGridFactory = (L as any)?.vectorGrid?.protobuf;
    if (!vectorGridFactory) {
      console.error('Leaflet.VectorGrid indisponible.');
      return;
    }

    const layer = vectorGridFactory(url, {
      vectorTileLayerStyles,
      interactive: false,
      minZoom: 0,
      maxNativeZoom: 14,
      maxZoom: 22,
      attribution:
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    });

    layer.addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [map, url]);

  return null;
}
