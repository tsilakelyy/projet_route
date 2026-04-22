# Système de Synchronisation Bidirectionnelle

## Vue d'ensemble

Ce système permet une synchronisation bidirectionnelle entre le module mobile (APK) et le module web, assurant que les données sont toujours à jour sur les deux plateformes.

## Architecture

### Composants Mobile

1. **mobile/src/services/syncService.ts**
   - Service principal de synchronisation
   - Gère la synchronisation des utilisateurs, signalements et travaux
   - Envoie des heartbeats pour indiquer que le mobile est actif
   - Vérifie si le module web est actif
   - Gère les demandes de synchronisation en attente

2. **mobile/src/components/SyncStatus.vue**
   - Composant Vue qui affiche l'état de la synchronisation
   - Affiche le statut du module web (actif/inactif)
   - Permet de lancer manuellement une synchronisation
   - Vérifie automatiquement les synchronisations en attente

3. **mobile/src/components/BackendStatus.vue**
   - Affiche l'état de la connexion au backend
   - Permet de rafraîchir la connexion manuellement

### Composants Backend

1. **fournisseurIdentite/src/main/java/com/projet/route/controller/PresenceSyncController.java**
   - Gère les heartbeats des clients (mobile/web)
   - Gère les demandes de synchronisation
   - Suit les acknowledgements de synchronisation

2. **fournisseurIdentite/src/main/java/com/projet/route/controller/WebActiveController.java**
   - Endpoint pour vérifier si le module web est actif
   - Endpoint pour vérifier si le module mobile est actif

3. **fournisseurIdentite/src/main/java/com/projet/route/service/PresenceSyncService.java**
   - Service qui suit la présence des clients
   - Gère les demandes de synchronisation
   - Stocke les timestamps des heartbeats

## Fonctionnement

### Détection Mutuelle

1. **Mobile détecte Web** :
   - Le mobile appelle régulièrement `/api/presence/web-active`
   - Si le web répond, il est considéré comme actif
   - Le composant SyncStatus affiche le statut en temps réel

2. **Web détecte Mobile** :
   - Le web appelle `/api/presence/mobile-active`
   - Le backend vérifie s'il a reçu un heartbeat récent du mobile
   - Le web peut adapter son comportement en conséquence

### Synchronisation des Données

1. **Synchronisation automatique** :
   - Le mobile envoie un heartbeat toutes les 15 secondes
   - Le mobile vérifie les synchronisations en attente toutes les 30 secondes
   - Le mobile vérifie si le web est actif toutes les 30 secondes

2. **Synchronisation manuelle** :
   - L'utilisateur peut cliquer sur le bouton "Synchroniser"
   - Le mobile synchronise tous les données (utilisateurs, signalements, travaux)
   - Le mobile demande au web de synchroniser ses données

3. **Synchronisation bidirectionnelle** :
   - Le backend sert de point central pour les données
   - Firebase est utilisé comme couche de synchronisation supplémentaire
   - Les modifications sont propagées dans les deux sens

## Endpoints API

### Présence

- `POST /api/presence/heartbeat` : Envoie un heartbeat
  ```json
  {
    "clientType": "mobile" | "web",
    "clientId": "string",
    "timestamp": number
  }
  ```

- `GET /api/presence/web-active?maxAgeSeconds=60` : Vérifie si le web est actif
  ```json
  {
    "active": boolean,
    "lastSeen": string,
    "secondsSinceLastSeen": number
  }
  ```

- `GET /api/presence/mobile-active?maxAgeSeconds=60` : Vérifie si le mobile est actif
  ```json
  {
    "active": boolean,
    "lastSeen": string,
    "secondsSinceLastSeen": number
  }
  ```

- `POST /api/presence/request-sync` : Demande une synchronisation
  ```json
  {
    "source": "mobile" | "web",
    "requestedBy": "string"
  }
  ```

- `GET /api/presence/pending-sync?target=mobile` : Vérifie les synchronisations en attente
  ```json
  {
    "hasPending": boolean,
    "requestId": number,
    "source": string,
    "requestedBy": string,
    "createdAt": string
  }
  ```

- `POST /api/presence/ack-sync` : Acknowledge une synchronisation
  ```json
  {
    "target": "mobile" | "web",
    "requestId": number
  }
  ```

### Données

- `GET /api/utilisateurs` : Récupère tous les utilisateurs
- `GET /api/signalements` : Récupère tous les signalements
- `GET /api/travaux` : Récupère tous les travaux
- `POST /api/signalements` : Crée un nouveau signalement
- `PUT /api/signalements/{id}` : Met à jour un signalement
- `DELETE /api/signalements/{id}` : Supprime un signalement

## Utilisation

### Dans les Composants Vue

```vue
<template>
  <SyncStatus />
  <BackendStatus />
</template>

<script setup lang="ts">
import SyncStatus from '@/components/SyncStatus';
import BackendStatus from '@/components/BackendStatus';
</script>
```

### Dans le Code TypeScript

```typescript
import { syncService } from '@/services/syncService';

// Synchroniser toutes les données
const result = await syncService.syncAll();

// Synchroniser uniquement les utilisateurs
const usersResult = await syncService.syncUtilisateurs();

// Vérifier si le web est actif
const isWebActive = await syncService.isWebModuleActive();

// Demander une synchronisation au web
await syncService.requestSync('mobile', 'manual-sync');

// S'abonner aux changements de statut
syncService.onSyncStatusChange((status) => {
  console.log('Statut de synchronisation:', status);
});
```

## Stockage Local

Les données synchronisées sont stockées dans le localStorage du navigateur/appareil :

- `utilisateurs` : Liste des utilisateurs synchronisés
- `signalements` : Liste des signalements synchronisés
- `travaux` : Liste des travaux synchronisés
- `mobileClientId` : Identifiant unique du client mobile

## Dépannage

### Le module web n'est pas détecté

1. Vérifiez que le backend est en cours d'exécution
2. Vérifiez que le web et le mobile sont sur le même réseau WiFi
3. Vérifiez que le pare-feu n'est pas bloquant les connexions

### La synchronisation échoue

1. Vérifiez la connexion au backend avec le composant BackendStatus
2. Vérifiez les logs du backend pour les erreurs
3. Essayez de forcer une synchronisation manuelle

### Les données ne sont pas à jour

1. Vérifiez que la synchronisation automatique est activée
2. Vérifiez que les heartbeats sont envoyés régulièrement
3. Essayez de forcer une synchronisation manuelle

## Optimisations

1. **Heartbeat régulier** : Le mobile envoie un heartbeat toutes les 15 secondes
2. **Vérification automatique** : Le mobile vérifie les synchronisations en attente toutes les 30 secondes
3. **Cache local** : Les données sont stockées localement pour un accès rapide
4. **Sync sélective** : Possibilité de synchroniser uniquement certains types de données

## Notes

- Le système de synchronisation utilise le backend comme point central
- Firebase est utilisé comme couche de synchronisation supplémentaire pour la redondance
- Les synchronisations sont idempotentes : elles peuvent être répétées sans effet secondaire
- Le système est conçu pour être résilient aux déconnexions temporaires
