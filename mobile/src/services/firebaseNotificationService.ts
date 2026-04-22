// mobile/src/services/firebaseNotificationService.ts - VERSION REALTIME DATABASE
import { db } from '../firebase';
import { ref, onValue, DataSnapshot } from 'firebase/database';
import { LocalNotifications } from '@capacitor/local-notifications';
import { matchesCurrentUser, parseCurrentUser } from './currentUser';

class FirebaseNotificationService {
  private unsubscribeStatusChanges: (() => void) | null = null;

  // Garde en mémoire les statuts précédents pour détecter les changements
  private previousStatuses: Record<string, string> = {};

  /**
   * Initialise le service de notifications
   */
  async initialize() {
    try {
      const permission = await LocalNotifications.requestPermissions();
      if (!permission.display) {
        console.warn('Permission de notification refusée');
        return;
      }

      this.subscribeToStatusChanges();
    } catch (error) {
      console.error('Erreur initialisation notifications:', error);
    }
  }

  /**
   * S'abonne aux changements de statut des signalements via Realtime Database
   */
  private subscribeToStatusChanges() {
    const currentUser = parseCurrentUser();
    if (!currentUser) {
      console.warn("Utilisateur non connecté, impossible de s'abonner aux notifications");
      return;
    }

    // onValue se déclenche à chaque modification du nœud 'signalements'
    const unsubscribe = onValue(
      ref(db, 'signalements'),
      (snapshot: DataSnapshot) => {
        if (!snapshot.exists()) return;

        snapshot.forEach((child) => {
          const signalement = child.val();
          const signalementId = child.key!;
          const newStatus: string = signalement?.statut ?? '';

          // Ignorer les signalements qui n'appartiennent pas à l'utilisateur
          const signalementUserId = signalement?.idUser ?? signalement?.Id_User ?? signalement?.id_user;
          if (!matchesCurrentUser(currentUser, signalementUserId)) return;

          const oldStatus = this.previousStatuses[signalementId];

          // Premier chargement : on mémorise sans notifier
          if (oldStatus === undefined) {
            this.previousStatuses[signalementId] = newStatus;
            return;
          }

          // Changement de statut détecté
          if (oldStatus !== newStatus) {
            this.previousStatuses[signalementId] = newStatus;
            this.showStatusChangeNotification(signalementId, oldStatus, newStatus);
          }
        });
      },
      (error) => {
        console.error('Erreur écoute changements statut:', error);
      }
    );

    this.unsubscribeStatusChanges = unsubscribe;
  }

  /**
   * Affiche une notification locale pour un changement de statut
   */
  private async showStatusChangeNotification(
    signalementId: string,
    oldStatus: string,
    newStatus: string
  ) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: 'Changement de statut',
            body: `Le statut de votre signalement a changé : ${oldStatus} → ${newStatus}`,
            largeBody: '',
            sound: 'beep.wav',
            schedule: { at: new Date() },
            attachments: [],
            actionTypeId: '',
            extra: { signalementId, oldStatus, newStatus },
          },
        ],
      });
    } catch (error) {
      console.error('Erreur affichage notification:', error);
    }
  }

  /**
   * Nettoie les abonnements et le cache des statuts
   */
  cleanup() {
    this.unsubscribeStatusChanges?.();
    this.unsubscribeStatusChanges = null;
    this.previousStatuses = {};
  }
}

export const firebaseNotificationService = new FirebaseNotificationService();
