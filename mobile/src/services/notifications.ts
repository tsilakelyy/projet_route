import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

// Initialiser les notifications push
export const initPushNotifications = async () => {
  try {
    // Demander la permission pour les notifications
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // S'inscrire aux notifications push
    await PushNotifications.register();

    // Écouter l'événement d'inscription
    await PushNotifications.addListener('registration', (token) => {
      console.log('Push registration success, token: ' + token.value);
      // TODO: Envoyer le token au backend pour l'enregistrement
      // sendTokenToBackend(token.value);
    });

    // Écouter les erreurs d'inscription
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on registration: ' + JSON.stringify(error));
    });

    // Écouter les notifications reçues lorsque l'application est en premier plan
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received: ' + JSON.stringify(notification));
      // Afficher une notification locale
      showLocalNotification(notification);
    });

    // Écouter les notifications sur lesquelles l'utilisateur a cliqué
    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed: ' + JSON.stringify(notification));
      // TODO: Gérer l'action de l'utilisateur (navigation vers une page spécifique, etc.)
    });

    return true;
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return false;
  }
};

// Afficher une notification locale
export const showLocalNotification = async (notification: any) => {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title: notification.title || 'Notification',
          body: notification.body || 'Vous avez une nouvelle notification',
          id: Date.now(),
          schedule: { at: new Date() },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#488AFF',
        },
      ],
    });
  } catch (error) {
    console.error('Error showing local notification:', error);
  }
};

// Initialiser les notifications locales
export const initLocalNotifications = async () => {
  try {
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      const res = await LocalNotifications.requestPermissions();
      if (res.display !== 'granted') {
        console.log('Local notification permission denied');
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error initializing local notifications:', error);
    return false;
  }
};
