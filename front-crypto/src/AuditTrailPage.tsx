import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from './config/api';
import BlockedUsersMiniCard from './components/BlockedUsersMiniCard';

interface AuditLog {
  id: number;
  entityType: string;
  entityId?: string;
  action: string;
  actor?: string;
  details?: string;
  createdAt: string;
}

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
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
      const response = await authFetch(apiUrl('/api/analytics/audit?limit=120'));
      if (!response.ok) throw new Error(await response.text());
      setLogs(await response.json());
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
          <h2 className="gradient-text">Traçabilite & audit</h2>
          <div>Historique probant des actions critiques.</div>
        </div>
        <div className="analytics-actions">
          <Link className="btn btn-secondary" to="/dashboard">Dashboard</Link>
          <Link className="btn btn-secondary" to="/analytics/criticality">Criticite</Link>
          <Link className="btn btn-secondary" to="/analytics/impact">Impact</Link>
          <Link className="btn btn-secondary" to="/analytics/charts">Graphiques</Link>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? 'Chargement...' : 'Rafraichir'}
          </button>
        </div>
      </div>

      <div className="analytics-table-wrap analytics-card hover-lift scroll-reveal">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Entite</th>
              <th>ID</th>
              <th>Acteur</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString('fr-FR')}</td>
                <td>{log.action}</td>
                <td>{log.entityType}</td>
                <td>{log.entityId || '-'}</td>
                <td>{log.actor || '-'}</td>
                <td>{log.details || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BlockedUsersMiniCard authFetch={authFetch} />
    </div>
  );
}
