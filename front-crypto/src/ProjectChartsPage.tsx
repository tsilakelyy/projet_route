import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from './config/api';
import BlockedUsersMiniCard from './components/BlockedUsersMiniCard';

interface Signalement {
  idSignalement: number;
  statut?: string;
  typeProbleme?: string;
}

interface ImpactData {
  totalSignalements: number;
  openSignalements: number;
  closedSignalements: number;
  engagedBudget: number;
  averageResolutionDays: number;
}

interface CriticalityRow {
  idSignalement: number;
  score: number;
  typeProbleme?: string;
}

const normalizeStatus = (status?: string) => {
  const normalized = (status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (normalized === 'en cours' || normalized === 'encours') return 'en cours';
  if (normalized === 'termine' || normalized === 'resolu' || normalized === 'resout') return 'termine';
  return 'nouveau';
};

export default function ProjectChartsPage() {
  const [loading, setLoading] = useState(false);
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [impact, setImpact] = useState<ImpactData>({
    totalSignalements: 0,
    openSignalements: 0,
    closedSignalements: 0,
    engagedBudget: 0,
    averageResolutionDays: 0,
  });
  const [criticality, setCriticality] = useState<CriticalityRow[]>([]);

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
      const [signalementsRes, impactRes, criticalityRes] = await Promise.all([
        authFetch(apiUrl('/api/signalements')),
        authFetch(apiUrl('/api/analytics/impact')),
        authFetch(apiUrl('/api/analytics/criticality')),
      ]);
      if (!signalementsRes.ok || !impactRes.ok || !criticalityRes.ok) {
        throw new Error('Erreur chargement des graphiques');
      }
      setSignalements(await signalementsRes.json());
      setImpact(await impactRes.json());
      setCriticality(await criticalityRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const byStatus = useMemo(() => {
    const stats: Record<string, number> = { nouveau: 0, 'en cours': 0, termine: 0 };
    signalements.forEach((signalement) => {
      const key = normalizeStatus(signalement.statut);
      stats[key] = (stats[key] || 0) + 1;
    });
    return [
      { label: 'Nouveau', value: stats.nouveau || 0 },
      { label: 'En cours', value: stats['en cours'] || 0 },
      { label: 'Termine', value: stats.termine || 0 },
    ];
  }, [signalements]);

  const byType = useMemo(() => {
    const stats = new Map<string, number>();
    signalements.forEach((signalement) => {
      const key = signalement.typeProbleme || 'autre';
      stats.set(key, (stats.get(key) || 0) + 1);
    });
    return Array.from(stats.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [signalements]);

  const topCriticality = useMemo(
    () => [...criticality].sort((a, b) => b.score - a.score).slice(0, 8),
    [criticality]
  );

  const maxType = Math.max(1, ...byType.map((item) => item.value));
  const maxCriticality = Math.max(1, ...topCriticality.map((item) => item.score));

  return (
    <div className="analytics-page texture-noise">
      <div className="analytics-header scroll-reveal">
        <div>
          <h2 className="gradient-text">Graphiques Projet</h2>
          <div>Vue globale d'avancement et de charge metier.</div>
        </div>
        <div className="analytics-actions">
          <Link className="btn btn-secondary" to="/dashboard">Dashboard</Link>
          <Link className="btn btn-secondary" to="/analytics/criticality">Criticite</Link>
          <Link className="btn btn-secondary" to="/analytics/audit">Audit</Link>
          <Link className="btn btn-secondary" to="/analytics/impact">Impact</Link>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? 'Chargement...' : 'Rafraichir'}
          </button>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Total signalements</div><div className="analytics-kpi-value">{impact.totalSignalements}</div></div>
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Ouverts</div><div className="analytics-kpi-value">{impact.openSignalements}</div></div>
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Clotures</div><div className="analytics-kpi-value">{impact.closedSignalements}</div></div>
        <div className="analytics-kpi analytics-card hover-lift stagger-item"><div className="analytics-kpi-label">Budget engage</div><div className="analytics-kpi-value">{Number(impact.engagedBudget || 0).toLocaleString()} Ar</div></div>
      </div>

      <div className="charts-grid">
        <section className="chart-card analytics-card hover-lift scroll-reveal">
          <h3>Repartition des statuts</h3>
          {byStatus.map((row) => {
            const pct = impact.totalSignalements > 0 ? (row.value / impact.totalSignalements) * 100 : 0;
            return (
              <div key={row.label} className="chart-row">
                <div className="chart-label">{row.label}</div>
                <div className="chart-bar-track">
                  <div className="chart-bar-fill status-bar" style={{ width: `${pct}%` }} />
                </div>
                <div className="chart-value">{row.value}</div>
              </div>
            );
          })}
        </section>

        <section className="chart-card analytics-card hover-lift scroll-reveal">
          <h3>Types de problemes (Top)</h3>
          {byType.map((row) => (
            <div key={row.label} className="chart-row">
              <div className="chart-label">{row.label}</div>
              <div className="chart-bar-track">
                <div className="chart-bar-fill type-bar" style={{ width: `${(row.value / maxType) * 100}%` }} />
              </div>
              <div className="chart-value">{row.value}</div>
            </div>
          ))}
        </section>

        <section className="chart-card chart-card-wide analytics-card hover-lift scroll-reveal">
          <h3>Top criticite</h3>
          {topCriticality.map((row) => (
            <div key={row.idSignalement} className="chart-row">
              <div className="chart-label">#{row.idSignalement} {row.typeProbleme || 'autre'}</div>
              <div className="chart-bar-track">
                <div className="chart-bar-fill criticality-bar" style={{ width: `${(row.score / maxCriticality) * 100}%` }} />
              </div>
              <div className="chart-value">{row.score}</div>
            </div>
          ))}
        </section>
      </div>

      <BlockedUsersMiniCard authFetch={authFetch} />
    </div>
  );
}
