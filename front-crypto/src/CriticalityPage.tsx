import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from './config/api';
import BlockedUsersMiniCard from './components/BlockedUsersMiniCard';

interface CriticalityRow {
  idSignalement: number;
  typeProbleme?: string;
  lieu?: string;
  description?: string;
  statut?: string;
  score: number;
  dangerFactor: number;
  surfaceFactor: number;
  agingFactor: number;
  statusFactor: number;
  trafficFactor: number;
  sensitiveFactor: number;
  priorityLabel: string;
}

const priorityClass = (priority?: string) => {
  const normalized = (priority || '').toLowerCase();
  if (normalized.includes('crit')) return 'priority-critical';
  if (normalized.includes('haut')) return 'priority-high';
  if (normalized.includes('moy')) return 'priority-medium';
  return 'priority-low';
};

export default function CriticalityPage() {
  const [rows, setRows] = useState<CriticalityRow[]>([]);
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
      const response = await authFetch(apiUrl('/api/analytics/criticality'));
      if (!response.ok) throw new Error(await response.text());
      setRows(await response.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const kpis = useMemo(() => {
    const total = rows.length;
    const critical = rows.filter((row) => row.score >= 75).length;
    const high = rows.filter((row) => row.score >= 55 && row.score < 75).length;
    const average = total ? Math.round((rows.reduce((sum, row) => sum + row.score, 0) / total) * 100) / 100 : 0;
    return { total, critical, high, average };
  }, [rows]);

  return (
    <div className="analytics-page texture-noise">
      <div className="analytics-header scroll-reveal">
        <div>
          <h2 className="gradient-text">Moteur de criticite</h2>
          <div>Priorisation intelligente des interventions.</div>
        </div>
        <div className="analytics-actions">
          <Link className="btn btn-secondary" to="/dashboard">Dashboard</Link>
          <Link className="btn btn-secondary" to="/analytics/audit">Audit</Link>
          <Link className="btn btn-secondary" to="/analytics/impact">Impact</Link>
          <Link className="btn btn-secondary" to="/analytics/charts">Graphiques</Link>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? 'Chargement...' : 'Rafraichir'}
          </button>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Signalements evalues</div><div className="analytics-kpi-value">{kpis.total}</div></div>
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Priorite critique</div><div className="analytics-kpi-value">{kpis.critical}</div></div>
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Priorite haute</div><div className="analytics-kpi-value">{kpis.high}</div></div>
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Score moyen</div><div className="analytics-kpi-value">{kpis.average}</div></div>
      </div>

      <div className="analytics-table-wrap analytics-card hover-lift scroll-reveal">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Priorite</th>
              <th>Score</th>
              <th>Type</th>
              <th>Lieu</th>
              <th>Danger</th>
              <th>Surface</th>
              <th>Anciennete</th>
              <th>Trafic</th>
              <th>Zone sensible</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.idSignalement}>
                <td>{row.idSignalement}</td>
                <td><span className={`priority-pill ${priorityClass(row.priorityLabel)}`}>{row.priorityLabel}</span></td>
                <td>{row.score}</td>
                <td>{row.typeProbleme || '-'}</td>
                <td>{row.lieu || '-'}</td>
                <td>{row.dangerFactor}</td>
                <td>{row.surfaceFactor}</td>
                <td>{row.agingFactor}</td>
                <td>{row.trafficFactor}</td>
                <td>{row.sensitiveFactor}</td>
                <td>{row.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BlockedUsersMiniCard authFetch={authFetch} />
    </div>
  );
}
