import { useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get, set, update, serverTimestamp } from 'firebase/database';
import { firebaseSyncService } from '../services/firebaseSyncService';

interface AutoSyncRealtimeDBProps {
  userId?: string;
  userEmail?: string;
  userName?: string;
}

const AutoSyncRealtimeDB: React.FC<AutoSyncRealtimeDBProps> = ({ userId, userEmail, userName }) => {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.log('Utilisateur non connecté, synchronisation automatique désactivée');
        return;
      }

      console.log('Utilisateur connecté, démarrage de la synchronisation automatique avec Realtime DB');

      try {
        // Lire l'entrée existante de l'utilisateur
        const userRef = ref(db, `utilisateurs/${user.uid}`);
        const snapshot = await get(userRef);

        const now = serverTimestamp(); // { ".sv": "timestamp" } — résolu par Firebase

        if (snapshot.exists()) {
          // Mise à jour partielle : on conserve dateCreation existante
          await update(userRef, {
            nomUtilisateur:    userName || user.displayName || user.email?.split('@')[0] || '',
            email:             user.email || userEmail || '',
            role:              'MANAGER',
            estBloque:         false,
            tentativesEchec:   0,
            dateModification:  now,
            dateSync:          now,
            source:            'web' as const,
          });
          console.log('Utilisateur mis à jour dans Realtime DB');
        } else {
          // Création complète
          await set(userRef, {
            nomUtilisateur:    userName || user.displayName || user.email?.split('@')[0] || '',
            email:             user.email || userEmail || '',
            role:              'MANAGER',
            estBloque:         false,
            tentativesEchec:   0,
            dateCreation:      now,
            dateModification:  now,
            dateSync:          now,
            source:            'web' as const,
          });
          console.log('Utilisateur créé dans Realtime DB');
        }

        // Synchroniser les données backend → Realtime DB
        await syncDataToRealtimeDB();
      } catch (error) {
        console.error('Erreur lors de la synchronisation automatique avec Realtime DB:', error);
      }
    });

    return () => unsubscribe();
  }, [userId, userEmail, userName]);

  const syncDataToRealtimeDB = async () => {
    try {
      console.log('Début synchronisation Realtime DB...');

      // 1. Déclencher la sync PostgreSQL → Firebase côté backend
      const syncResponse = await fetch('/api/sync/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!syncResponse.ok) {
        throw new Error(`Erreur sync backend: ${syncResponse.status}`);
      }

      const syncResult = await syncResponse.json();
      console.log('Sync backend résultat:', syncResult);

      // 2. Sync côté frontend via firebaseSyncService (Realtime DB)
      const syncResultFront = await firebaseSyncService.syncAll();
      console.log('Sync frontend résultat:', syncResultFront);

      if (syncResultFront.success) {
        console.log('Synchronisation Realtime DB terminée avec succès');
      } else {
        console.error('Erreur synchronisation Realtime DB:', syncResultFront.message);
      }
    } catch (error) {
      console.error('Erreur lors de la synchronisation des données Realtime DB:', error);
      // Fallback : sync locale uniquement
      try {
        const localSync = await firebaseSyncService.syncAll();
        console.log('Sync locale fallback:', localSync);
      } catch (localError) {
        console.error('Erreur sync locale:', localError);
      }
    }
  };

  return null;
};

export default AutoSyncRealtimeDB;