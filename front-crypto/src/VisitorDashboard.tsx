import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiUrl, TILE_URL } from './config/api';
import { ANTANANARIVO_BOUNDS, MAP_DEFAULT_ZOOM, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from './config/map';
import OfflineVectorTileLayer from './components/OfflineVectorTileLayer';
import OfflinePlaceLabelsLayer from './components/OfflinePlaceLabelsLayer';
import { firebaseSyncService } from './services/firebaseSyncService';

delete (L.Icon.Default.prototype as any)._getIconUrl;

interface PhotoEntry {
  url: string;
  addedBy?: string;
  addedAt?: string;
}

interface Report {
  id: number;
  latitude: number;
  longitude: number;
  surface: number;
  niveau: number;
  photos: PhotoEntry[];
  typeProbleme?: string;
  description: string;
  dateAjoute: Date;
  statut: string;
  budget: number;
  avancement: number;
  entrepriseNom?: string;
  lieuNom?: string;
  lieuVille?: string;
  lieuDescription?: string;
}

type DraftReport = {
  typeProbleme: string;
  surface: string;
  description: string;
};

const markerIcon = (color: string, symbol: string) =>
  L.divIcon({
    className: 'custom-marker custom-marker-modern',
    html: `<div style="position:relative;width:46px;height:56px;display:flex;align-items:flex-start;justify-content:center;">
      <svg width="46" height="56" viewBox="0 0 46 56" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
        <path d="M23 54C23 54 39 33.5 39 21.8C39 12.95 31.84 5.8 23 5.8C14.16 5.8 7 12.95 7 21.8C7 33.5 23 54 23 54Z" fill="${color}" />
        <circle cx="23" cy="21.8" r="12.2" fill="#ffffff" fill-opacity="0.97" />
        <circle cx="23" cy="21.8" r="15.4" fill="none" stroke="#ffffff" stroke-width="2.3" />
        <text x="23" y="26.6" text-anchor="middle" font-size="13.4" font-weight="800" fill="#1f2937" font-family="Segoe UI, Arial, sans-serif">${symbol}</text>
      </svg>
    </div>`,
    iconSize: [46, 56],
    iconAnchor: [23, 54],
    popupAnchor: [0, -50],
  });

const icons: Record<string, L.DivIcon> = {
  'nid-de-poule': markerIcon('#ef4444', 'NP'),
  'route-inondee': markerIcon('#3b82f6', 'IN'),
  'route-endommagee': markerIcon('#f97316', 'DE'),
  'signalisation-manquante': markerIcon('#eab308', 'SM'),
  'eclairage-defectueux': markerIcon('#8b5cf6', 'ED'),
  autre: markerIcon('#6b7280', 'OT'),
  default: markerIcon('#10b981', 'OK'),
};

const normStatus = (status?: string) => {
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

const problemShort = (type?: string) => {
  const label = problemLabel(type);
  return label.charAt(0).toUpperCase() || 'R';
};

const parsePhotos = (value: unknown): PhotoEntry[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item: any) => {
        if (typeof item === 'string') {
          const url = item.trim();
          return url ? { url, addedBy: 'legacy', addedAt: undefined } : null;
        }
        const url = String(item?.url || '').trim();
        if (!url) return null;
        return {
          url,
          addedBy: String(item?.addedBy || 'unknown'),
          addedAt: item?.addedAt ? String(item.addedAt) : undefined,
        } as PhotoEntry;
      })
      .filter((photo): photo is PhotoEntry => photo !== null);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return parsePhotos(JSON.parse(trimmed));
      } catch {
        return [];
      }
    }
  }
  return [];
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

function MapClickCapture({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      if (!enabled) {
        return;
      }
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export default function VisitorDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportModeEnabled, setReportModeEnabled] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [draftReport, setDraftReport] = useState<DraftReport>({
    typeProbleme: '',
    surface: '',
    description: '',
  });
  const [draftPhotos, setDraftPhotos] = useState<PhotoEntry[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sigRes, travRes] = await Promise.all([fetch(apiUrl('/api/signalements')), fetch(apiUrl('/api/travaux'))]);
      if (!sigRes.ok || !travRes.ok) {
        throw new Error('Chargement signalements/travaux impossible');
      }
      const [signalements, travaux] = await Promise.all([sigRes.json(), travRes.json()]);
      const mapTravaux = new Map<number, any>();
      for (const travail of travaux) {
        mapTravaux.set(Number(travail?.signalement?.idSignalement), travail);
      }

      const normalizedReports = signalements
        .map((signalement: any) => {
          const travail = mapTravaux.get(Number(signalement.idSignalement));
          const latitude = toNumber(signalement.latitude, Number.NaN);
          const longitude = toNumber(signalement.longitude, Number.NaN);

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
          }

          return {
            id: Number(signalement.idSignalement),
            latitude,
            longitude,
            surface: toNumber(signalement.surface, 0),
            niveau: toNumber(signalement.niveau, 1),
            photos: parsePhotos(signalement.photos),
            typeProbleme: signalement.typeProbleme,
            description: signalement.description || '',
            dateAjoute: signalement.dateAjoute ? new Date(signalement.dateAjoute) : new Date(),
            statut: signalement.statut || 'nouveau',
            budget: toNumber(travail?.budget, 0),
            avancement: toNumber(travail?.avancement, 0),
            entrepriseNom: travail?.entreprise?.nom || '',
            lieuNom: signalement?.lieu?.libelle || '',
            lieuVille: signalement?.lieu?.ville || '',
            lieuDescription: signalement?.lieu?.description || '',
          } as Report;
        })
        .filter((report: Report | null): report is Report => report !== null);

      setReports(normalizedReports);
    } catch (error) {
      console.error('Erreur chargement visiteurs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    
    // Synchronisation automatique avec Firebase
    const unsubscribeSignalements = firebaseSyncService.subscribeToSignalements((firebaseSignalements) => {
      const mappedReports = firebaseSignalements.map((signalement) => {
        const latitude = toNumber(signalement.latitude, Number.NaN);
        const longitude = toNumber(signalement.longitude, Number.NaN);
        
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }
        
        return {
          id: Number(signalement.id),
          latitude,
          longitude,
          surface: toNumber(signalement.surface, 0),
          niveau: toNumber(signalement.niveau, 1),
          photos: parsePhotos(signalement.photos),
          typeProbleme: signalement.typeProbleme,
          description: signalement.description || '',
          dateAjoute: signalement.dateAjoute || new Date(),
          statut: signalement.statut || 'nouveau',
          budget: toNumber(signalement.budget, 0),
          avancement: toNumber(signalement.avancement, 0),
          entrepriseNom: signalement.entrepriseNom || '',
          lieuNom: signalement.lieuNom || '',
          lieuVille: signalement.lieuVille || '',
          lieuDescription: signalement.lieuDescription || '',
        } as Report;
      }).filter((report: Report | null): report is Report => report !== null);
      
      setReports(mappedReports);
    });
    
    return () => {
      if (unsubscribeSignalements) {
        unsubscribeSignalements();
      }
    };
  }, [loadData]);

  const recap = useMemo(() => {
    const count = reports.length;
    const totalSurface = reports.reduce((sum, report) => sum + report.surface, 0);
    const totalBudget = reports.reduce((sum, report) => sum + (report.budget || 0), 0);
    const averageAvancement = count
      ? Math.round((reports.reduce((sum, report) => sum + (report.avancement || 0), 0) / count) * 100) / 100
      : 0;
    return { count, totalSurface, totalBudget, averageAvancement };
  }, [reports]);

  const recentReports = useMemo(
    () => [...reports].sort((a, b) => b.dateAjoute.getTime() - a.dateAjoute.getTime()).slice(0, 5),
    [reports]
  );

  const resetDraft = () => {
    setSelectedPoint(null);
    setDraftReport({ typeProbleme: '', surface: '', description: '' });
    setDraftPhotos([]);
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Lecture fichier impossible: ${file.name}`));
      reader.readAsDataURL(file);
    });

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      alert('Sélectionnez au moins une image valide.');
      return;
    }

    try {
      const encodedPhotos = await Promise.all(imageFiles.map((file) => fileToDataUrl(file)));
      const entries = encodedPhotos.map((url) => ({ url, addedBy: 'web-visitor', addedAt: new Date().toISOString() } as PhotoEntry));
      setDraftPhotos((prev) => [...prev, ...entries]);
    } catch (error) {
      console.error('Erreur lors du chargement des photos:', error);
      alert('Erreur lors du chargement des photos.');
    }
    event.target.value = '';
  };

  const removePhoto = (index: number) => {
    setDraftPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReport = async () => {
    if (!selectedPoint) {
      window.alert('Cliquez d abord sur la carte pour choisir une zone.');
      return;
    }
    if (!draftReport.typeProbleme) {
      window.alert('Selectionnez le type de probleme.');
      return;
    }
    const surface = Number(draftReport.surface);
    if (!Number.isFinite(surface) || surface <= 0) {
      window.alert('Entrez une surface valide.');
      return;
    }

    const currentUserRaw = localStorage.getItem('currentUser');
    const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;
    const idUser = currentUser?.id ? String(currentUser.id) : 'web-visitor';

    setSubmittingReport(true);
    try {
      const response = await fetch(apiUrl('/api/signalements'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: selectedPoint.lat,
          longitude: selectedPoint.lng,
          idUser,
          surface,
          niveau: 1,
          typeProbleme: draftReport.typeProbleme,
          description: draftReport.description.trim(),
          photos: draftPhotos,
          statut: 'nouveau',
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await loadData();
      setReportModeEnabled(false);
      resetDraft();
    } catch (error) {
      console.error('Erreur creation signalement web:', error);
      window.alert('Creation signalement impossible. Verifiez le backend.');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="visitor-dashboard">
      <header className="visitor-header">
        <div className="visitor-logo">
          <div className="visitor-logo-icon">RW</div>
          <span className="visitor-logo-text">RouteWatch</span>
        </div>
        <nav className="visitor-nav">
          <Link to="/">Espace Gestionnaire</Link>
        </nav>
      </header>

      <div className="visitor-content">
        <div className="visitor-map" style={{ height: 'calc(100vh - 81px)', minHeight: '700px' }}>
          {!loading && reports.length === 0 && (
            <div className="tile-offline-warning">
              Aucun signalement en base pour le moment. Les icones de signalement s'affichent automatiquement des
              qu'au moins un signalement est enregistre.
            </div>
          )}
          <MapContainer
            center={[-18.8792, 47.5079]}
            zoom={MAP_DEFAULT_ZOOM}
            minZoom={MAP_MIN_ZOOM}
            maxZoom={MAP_MAX_ZOOM}
            zoomAnimation={false}
            fadeAnimation={false}
            markerZoomAnimation={false}
            maxBounds={ANTANANARIVO_BOUNDS}
            maxBoundsViscosity={0.85}
            zoomSnap={0.25}
            zoomDelta={0.5}
            wheelPxPerZoomLevel={95}
            style={{ height: '100%', width: '100%' }}
          >
            <OfflineVectorTileLayer url={TILE_URL} />
            <OfflinePlaceLabelsLayer url={TILE_URL} />
            <MapClickCapture enabled={reportModeEnabled} onPick={(lat, lng) => setSelectedPoint({ lat, lng })} />
            {selectedPoint && reportModeEnabled && (
              <Marker position={[selectedPoint.lat, selectedPoint.lng]} icon={icons.default}>
                <Popup>
                  <div>Zone selectionnee pour nouveau signalement</div>
                </Popup>
              </Marker>
            )}
            {reports.map((report) => (
              <Marker
                key={report.id}
                position={[report.latitude, report.longitude]}
                icon={icons[report.typeProbleme || ''] || icons.default}
                eventHandlers={{
                  mouseover: (event) => {
                    event.target.openPopup();
                  },
                  mouseout: (event) => {
                    event.target.closePopup();
                  },
                }}
              >
                <Popup className="custom-popup">
                  <div className="popup-content">
                    <div className="popup-row">
                      <span className="popup-label">Type</span>
                      <span className="popup-value">{problemLabel(report.typeProbleme)}</span>
                    </div>
                    <div className="popup-row">
                      <span className="popup-label">Date</span>
                      <span className="popup-value">{report.dateAjoute.toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="popup-row">
                      <span className="popup-label">Statut</span>
                      <span className="popup-value">{normStatus(report.statut)}</span>
                    </div>
                    <div className="popup-row">
                      <span className="popup-label">Surface</span>
                      <span className="popup-value">{report.surface} m2</span>
                    </div>
                    <div className="popup-row">
                      <span className="popup-label">Niveau</span>
                      <span className="popup-value">{report.niveau}</span>
                    </div>
                    <div className="popup-row">
                      <span className="popup-label">Budget</span>
                      <span className="popup-value">{(report.budget || 0).toLocaleString()} Ar</span>
                    </div>
                    <div className="popup-row">
                      <span className="popup-label">Entreprise</span>
                      <span className="popup-value">{report.entrepriseNom || '-'}</span>
                    </div>
                    <div className="popup-row">
                      <span className="popup-label">Lieu</span>
                      <span className="popup-value">
                        {report.lieuNom || '-'}
                        {report.lieuVille ? ` (${report.lieuVille})` : ''}
                      </span>
                    </div>
                    <div className="popup-row">
                      <span className="popup-label">Avancement</span>
                      <span className="popup-value">{report.avancement || 0}%</span>
                    </div>
                    {report.lieuDescription && (
                      <div className="popup-row" style={{ display: 'block', marginTop: 8 }}>
                        <span className="popup-label">Description du lieu</span>
                        <div className="popup-value" style={{ marginTop: 4 }}>
                          {report.lieuDescription}
                        </div>
                      </div>
                    )}
                    <div className="popup-row" style={{ display: 'block', marginTop: 8 }}>
                      <span className="popup-label">Description</span>
                      <div className="popup-value" style={{ marginTop: 4 }}>
                        {report.description || 'Aucune description'}
                      </div>
                    </div>
                    {report.photos.length > 0 && (
                      <div className="popup-row" style={{ display: 'block', marginTop: 8 }}>
                        <span className="popup-label">Photos</span>
                        <div className="popup-value" style={{ marginTop: 4 }}>
                          {report.photos.map((photo, index) => (
                            <a
                              key={`${report.id}-photo-${index}`}
                              href={photo.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'block' }}
                            >
                              Voir photo {index + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <aside className="visitor-sidebar">
          <h3 className="visitor-sidebar-title">Recapitulatif</h3>
          <button
            onClick={() => {
              if (reportModeEnabled) {
                setReportModeEnabled(false);
                resetDraft();
                return;
              }
              setReportModeEnabled(true);
            }}
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: 12 }}
          >
            {reportModeEnabled ? 'Annuler le signalement' : "Faire un signalement d'ici"}
          </button>
          {reportModeEnabled && (
            <div className="recap-card" style={{ display: 'block' }}>
              <div className="recap-label" style={{ marginBottom: 8, fontWeight: 700 }}>Nouveau signalement</div>
              <div className="recap-label" style={{ marginBottom: 8 }}>
                {selectedPoint
                  ? `Zone: ${selectedPoint.lat.toFixed(5)}, ${selectedPoint.lng.toFixed(5)}`
                  : 'Etape 1: cliquez une zone sur la carte'}
              </div>
              <select
                value={draftReport.typeProbleme}
                onChange={(event) => setDraftReport((prev) => ({ ...prev, typeProbleme: event.target.value }))}
                style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 8 }}
              >
                <option value="">Type de probleme</option>
                <option value="nid-de-poule">Nid de poule</option>
                <option value="route-inondee">Route inondee</option>
                <option value="route-endommagee">Route endommagee</option>
                <option value="signalisation-manquante">Signalisation manquante</option>
                <option value="eclairage-defectueux">Eclairage defectueux</option>
                <option value="autre">Autre</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Surface (m2)"
                value={draftReport.surface}
                onChange={(event) => setDraftReport((prev) => ({ ...prev, surface: event.target.value }))}
                style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 8 }}
              />
              <textarea
                rows={3}
                placeholder="Description"
                value={draftReport.description}
                onChange={(event) => setDraftReport((prev) => ({ ...prev, description: event.target.value }))}
                style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 8, resize: 'vertical' }}
              />
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 700 }}>Photos</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  style={{ width: '100%', padding: 8, borderRadius: 8 }}
                />
                {draftPhotos.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {draftPhotos.map((photo, index) => (
                      <div key={index} style={{ position: 'relative', width: 80, height: 80 }}>
                        <img
                          src={photo.url}
                          alt={`Photo ${index + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255, 0, 0, 0.8)',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 'bold',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleSubmitReport}
                className="btn btn-secondary"
                disabled={submittingReport}
                style={{ width: '100%' }}
              >
                {submittingReport ? 'Envoi...' : 'Envoyer le signalement'}
              </button>
            </div>
          )}
          <div className="recap-card">
            <div className="recap-info">
              <span className="recap-label">Points</span>
              <span className="recap-value">{recap.count}</span>
            </div>
          </div>
          <div className="recap-card">
            <div className="recap-info">
              <span className="recap-label">Surface totale</span>
              <span className="recap-value">{recap.totalSurface} m2</span>
            </div>
          </div>
          <div className="recap-card">
            <div className="recap-info">
              <span className="recap-label">Avancement moyen</span>
              <span className="recap-value">{recap.averageAvancement}%</span>
            </div>
          </div>
          <div className="recap-card">
            <div className="recap-info">
              <span className="recap-label">Budget total</span>
              <span className="recap-value">{recap.totalBudget.toLocaleString()} Ar</span>
            </div>
          </div>

          <button onClick={loadData} className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}>
            {loading ? 'Actualisation...' : 'Actualiser'}
          </button>

          <div className="legend-card">
            <h4 className="legend-title">Derniers signalements</h4>
            {recentReports.length === 0 && <div className="legend-label">Aucun signalement disponible.</div>}
            {recentReports.map((report) => (
              <div key={report.id} className="legend-item" style={{ alignItems: 'flex-start' }}>
                <div className="legend-color">{problemShort(report.typeProbleme)}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{problemLabel(report.typeProbleme)}</div>
                  <div className="legend-label">{report.description || 'Aucune description'}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
