import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM } from '../config/map';
import { STYLE_URL } from '../config/api';

type MapReport = {
  id: number;
  latitude: number;
  longitude: number;
  typeProbleme?: string;
  description?: string;
  dateAjoute?: Date;
  statut?: string;
  surface?: number;
  niveau?: number;
  entrepriseNom?: string;
  budget?: number;
  avancement?: number;
};

type OfflineMaplibreMapProps = {
  reports: MapReport[];
};

const mapBounds: maplibregl.LngLatBoundsLike = [
  [47.37, -19.025],
  [47.679, -18.772],
];

const mapCenter: [number, number] = [47.5079, -18.8792];

const normalizeStatus = (status?: string) => {
  const value = (status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (value === 'en cours' || value === 'encours') return 'En cours';
  if (value === 'termine' || value === 'resolu' || value === 'resout') return 'Termine';
  return 'Nouveau';
};

const problemLabel = (type?: string) => {
  const labels: Record<string, string> = {
    'nid-de-poule': 'Nid de poule',
    'route-inondee': 'Route inondee',
    'route-endommagee': 'Route endommagee',
    'signalisation-manquante': 'Signalisation manquante',
    'eclairage-defectueux': 'Eclairage defectueux',
    autre: 'Autre',
  };
  return labels[type || ''] || 'Probleme routier';
};

const markerStyle = (type?: string) => {
  const mapping: Record<string, { color: string; letter: string }> = {
    'nid-de-poule': { color: '#ef4444', letter: 'N' },
    'route-inondee': { color: '#3b82f6', letter: 'I' },
    'route-endommagee': { color: '#f97316', letter: 'D' },
    'signalisation-manquante': { color: '#eab308', letter: 'S' },
    'eclairage-defectueux': { color: '#8b5cf6', letter: 'E' },
    autre: { color: '#6b7280', letter: 'A' },
  };
  return mapping[type || ''] || { color: '#10b981', letter: 'R' };
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const buildPopupContent = (report: MapReport) => {
  const container = document.createElement('div');
  container.className = 'popup-content';

  const rows: Array<[string, string]> = [
    ['Type', problemLabel(report.typeProbleme)],
    ['Date', report.dateAjoute ? report.dateAjoute.toLocaleDateString('fr-FR') : '-'],
    ['Statut', normalizeStatus(report.statut)],
    ['Niveau', String(toNumber(report.niveau, 0))],
    ['Surface', `${toNumber(report.surface, 0)} m2`],
    ['Entreprise', report.entrepriseNom || '-'],
    ['Budget', `${toNumber(report.budget, 0).toLocaleString()} Ar`],
    ['Avancement', `${toNumber(report.avancement, 0)}%`],
  ];

  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'popup-row';

    const left = document.createElement('span');
    left.className = 'popup-label';
    left.textContent = label;

    const right = document.createElement('span');
    right.className = 'popup-value';
    right.textContent = value;

    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  }

  if (report.description && report.description.trim()) {
    const row = document.createElement('div');
    row.className = 'popup-row';
    row.style.display = 'block';
    row.style.marginTop = '8px';

    const label = document.createElement('span');
    label.className = 'popup-label';
    label.textContent = 'Description';

    const value = document.createElement('div');
    value.className = 'popup-value';
    value.style.marginTop = '4px';
    value.textContent = report.description;

    row.appendChild(label);
    row.appendChild(value);
    container.appendChild(row);
  }

  return container;
};

const buildMarkerElement = (type?: string) => {
  const { color, letter } = markerStyle(type);
  const el = document.createElement('div');
  el.style.width = '36px';
  el.style.height = '36px';
  el.style.borderRadius = '50% 50% 50% 0';
  el.style.transform = 'rotate(-45deg)';
  el.style.background = color;
  el.style.border = '2px solid #fff';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.boxSizing = 'border-box';

  const text = document.createElement('span');
  text.style.transform = 'rotate(45deg)';
  text.style.fontWeight = '700';
  text.style.fontSize = '13px';
  text.style.color = '#fff';
  text.textContent = letter;
  el.appendChild(text);

  return el;
};

export default function OfflineMaplibreMap({ reports }: OfflineMaplibreMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: STYLE_URL,
      center: mapCenter,
      zoom: 12,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      maxBounds: mapBounds,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-left');

    map.on('error', (event: any) => {
      // Keep explicit errors for diagnostics when style/tiles/glyphs fail.
      console.error('MapLibre rendering error:', event?.error || event);
    });

    mapRef.current = map;

    return () => {
      for (const marker of markersRef.current) {
        marker.remove();
      }
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    for (const marker of markersRef.current) {
      marker.remove();
    }
    markersRef.current = [];

    const map = mapRef.current;
    if (!map) {
      return;
    }

    for (const report of reports) {
      if (!Number.isFinite(report.latitude) || !Number.isFinite(report.longitude)) {
        continue;
      }

      const markerEl = buildMarkerElement(report.typeProbleme);
      const popup = new maplibregl.Popup({ offset: 20 }).setDOMContent(buildPopupContent(report));

      const marker = new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
        .setLngLat([report.longitude, report.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [reports]);

  return <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />;
}

