<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { onMounted } from 'vue';
import { initPushNotifications, initLocalNotifications } from './services/notifications';

onMounted(async () => {
  // Initialiser les notifications locales
  await initLocalNotifications();
  
  // Initialiser les notifications push
  await initPushNotifications();
});
</script>
