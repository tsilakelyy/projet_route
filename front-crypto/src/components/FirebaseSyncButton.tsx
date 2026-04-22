// front-crypto/src/components/FirebaseSyncButton.tsx - VERSION CORRIGÉE
import React, { useState, useEffect } from 'react';
import { firebaseSyncService } from '../services/firebaseSyncService';
import { isFirebaseInitialized } from '../firebase';

interface FirebaseSyncButtonProps {
  onSyncComplete?: (success: boolean, message: string) => void;
}

const FirebaseSyncButton: React.FC<FirebaseSyncButtonProps> = ({ onSyncComplete }) => {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Formater le temps de la dernière synchronisation
  const formatLastSyncTime = () => {
    if (!lastSyncTime) {
      return 'Jamais';
    }

    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours} h`;
    return `Il y a ${days} j`;
  };

  // Gérer la synchronisation - VERSION CORRIGÉE
  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus(null);

    try {
      // Vérifier si Firebase est correctement initialisé
      if (!isFirebaseInitialized()) {
        throw new Error('Firebase n\'est pas correctement initialisé. Vérifiez votre configuration.');
      }

      // 1. Synchroniser PostgreSQL ↔ Firebase via backend
      console.log('🔄 Synchronisation PostgreSQL ↔ Firebase...');
      const backendResponse = await fetch('/api/sync/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        throw new Error(`Sync backend échouée: ${backendResponse.status} - ${errorText}`);
      }
      
      const backendResult = await backendResponse.json();
      console.log('✅ Sync backend réussie:', backendResult);

      // 2. Synchroniser avec Firebase frontend
      console.log('🔄 Synchronisation frontend Firebase...');
      const frontendResult = await firebaseSyncService.syncAll();

      const finalMessage = `✅ Synchronisation avec Firebase réussie`;

      setSyncStatus({
        success: frontendResult.success,
        message: finalMessage
      });

      if (frontendResult.success) {
        setLastSyncTime(new Date());
      }

      // Notifier le composant parent
      if (onSyncComplete) {
        onSyncComplete(frontendResult.success, finalMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const finalErrorMessage = `Erreur de synchronisation: ${errorMessage}`;
      
      setSyncStatus({
        success: false,
        message: finalErrorMessage
      });

      console.error('❌ Erreur synchronisation:', error);

      // Notifier le composant parent
      if (onSyncComplete) {
        onSyncComplete(false, finalErrorMessage);
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="firebase-sync-container">
      <button 
        className="btn btn-primary" 
        onClick={handleSync} 
        disabled={syncing}
      >
        {syncing ? 'Synchronisation...' : 'Synchroniser Firebase'}
      </button>

      {lastSyncTime && (
        <div className="last-sync">
          <p>Dernière synchronisation: {formatLastSyncTime()}</p>
        </div>
      )}

      {syncStatus && (
        <div className={`sync-status ${syncStatus.success ? 'success' : 'error'}`}>
          <p>{syncStatus.message}</p>
        </div>
      )}
    </div>
  );
};

export default FirebaseSyncButton;
