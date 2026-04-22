import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from './config/api';
import BlockedUsersMiniCard from './components/BlockedUsersMiniCard';

interface Hotspot {
  lieu: string;
  count: number;
}

interface ImpactData {
  totalSignalements: number;
  openSignalements: number;
  closedSignalements: number;
  totalSurface: number;
  engagedBudget: number;
  budgetPerM2: number;
  averageResolutionDays: number;
  createdLast7Days: number;
  resolvedLast7Days: number;
  blockedUsersCount: number;
  hotspots: Hotspot[];
}

const emptyImpact: ImpactData = {
  totalSignalements: 0,
  openSignalements: 0,
  closedSignalements: 0,
  totalSurface: 0,
  engagedBudget: 0,
  budgetPerM2: 0,
  averageResolutionDays: 0,
  createdLast7Days: 0,
  resolvedLast7Days: 0,
  blockedUsersCount: 0,
  hotspots: [],
};

export default function ImpactPage() {
  const [impact, setImpact] = useState<ImpactData>(emptyImpact);
  const [loading, setLoading] = useState(false);

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      window.location.href = '/';
      throw new Error('Session invalide');
    }
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/';
      throw new Error('Session invalide');
    }
    return response;
  };

  const load = async () => {
    setLoading(true);
    try {
      const response = await authFetch(apiUrl('/api/analytics/impact'));
      if (!response.ok) throw new Error(await response.text());
      setImpact(await response.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="analytics-page texture-noise">
      <div className="analytics-header scroll-reveal">
        <div>
          <h2 className="gradient-text">Impact & performance</h2>
          <div>KPI de pilotage pour les decideurs.</div>
        </div>
        <div className="analytics-actions">
          <Link className="btn btn-secondary" to="/dashboard">Dashboard</Link>
          <Link className="btn btn-secondary" to="/analytics/criticality">Criticite</Link>
          <Link className="btn btn-secondary" to="/analytics/audit">Audit</Link>
          <Link className="btn btn-secondary" to="/analytics/charts">Graphiques</Link>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? 'Chargement...' : 'Rafraichir'}
          </button>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Total signalements</div><div className="analytics-kpi-value">{impact.totalSignalements}</div></div>
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Ouverts</div><div className="analytics-kpi-value">{impact.openSignalements}</div></div>
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Clotures</div><div className="analytics-kpi-value">{impact.closedSignalements}</div></div>
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Budget engage</div><div className="analytics-kpi-value">{impact.engagedBudget.toLocaleString()} Ar</div></div>
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Budget / m2</div><div className="analytics-kpi-value">{impact.budgetPerM2.toLocaleString()} Ar</div></div>
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Delai moyen resolution</div><div className="analytics-kpi-value">{impact.averageResolutionDays} j</div></div>
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Crees (7 jours)</div><div className="analytics-kpi-value">{impact.createdLast7Days}</div></div>
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Resolus (7 jours)</div><div className="analytics-kpi-value">{impact.resolvedLast7Days}</div></div>
      </div>

      <h3>Hotspots prioritaires</h3>
      <div className="analytics-table-wrap analytics-card hover-lift scroll-reveal">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Rang</th>
              <th>Lieu</th>
              <th>Signalements</th>
            </tr>
          </thead>
          <tbody>
            {impact.hotspots.map((hotspot, index) => (
              <tr key={`${hotspot.lieu}-${index}`}>
                <td>#{index + 1}</td>
                <td>{hotspot.lieu}</td>
                <td>{hotspot.count}</td>
              </tr>
            ))}
            {impact.hotspots.length === 0 && (
              <tr>
                <td colSpan={3}>Aucun hotspot pour le moment.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <BlockedUsersMiniCard authFetch={authFetch} />
    </div>
  );
}
