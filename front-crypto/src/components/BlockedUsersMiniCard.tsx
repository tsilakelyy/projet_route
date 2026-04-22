import { useEffect, useState } from 'react';
import { apiUrl } from '../config/api';

interface BlockedUser {
  idUtilisateur: number;
  nomUtilisateur: string;
  email: string;
  tentativesEchec?: number;
  dateModification?: string;
}

interface Props {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export default function BlockedUsersMiniCard({ authFetch }: Props) {
  const [users, setUsers] = useState<BlockedUser[]>([]);

  const load = async () => {
    try {
      const response = await authFetch(apiUrl('/api/analytics/blocked-users'));
      if (!response.ok) return;
      setUsers(await response.json());
    } catch {
      // Silent fail for side widget
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 25000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <aside className="blocked-mini-card">
      <div className="blocked-mini-title">Utilisateurs bloques</div>
      <div className="blocked-mini-list">
        {users.length === 0 && <div className="blocked-mini-empty">Aucun compte bloque</div>}
        {users.map((user) => (
          <div key={user.idUtilisateur} className="blocked-mini-item">
            <div className="blocked-mini-name">{user.nomUtilisateur}</div>
            <div className="blocked-mini-email">{user.email}</div>
            <div className="blocked-mini-meta">{user.tentativesEchec || 0} essais</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
