# Système de Détection Automatique du Backend

## Vue d'ensemble

Ce système permet à l'application mobile Capacitor de découvrir automatiquement le backend sur le réseau WiFi sans aucune configuration manuelle de la part de l'utilisateur.

## Architecture

### Composants Mobile

1. **mobile/src/config/api.ts**
   - Contient les constantes de configuration (BACKEND_DISCOVERY_PORT, BACKEND_DISCOVERY_PATH, DISCOVERY_TIMEOUT)
   - Implémente la fonction `getLocalIpAddress()` pour obtenir l'adresse IP locale
   - Implémente la fonction `discoverBackend()` qui scanne le sous-réseau
   - Implémente un système de cache pour stocker l'IP du backend découverte
   - Fournit les fonctions `resolveApiHost()` et `getApiBaseUrl()` pour résoudre l'URL de l'API
   - Exporte `refreshApiBaseUrl()` pour forcer une nouvelle découverte
   - Exporte `getBackendStatus()` pour vérifier l'état de la connexion

2. **mobile/src/services/api.ts**
   - Service API qui utilise `getApiBaseUrl()` pour toutes les requêtes HTTP
   - Fournit les méthodes `get()`, `post()`, `put()`, `del()` pour les requêtes HTTP
   - Fournit `refreshConnection()` et `checkConnection()` pour gérer la connexion

3. **mobile/src/components/BackendStatus.tsx**
   - Composant Vue qui affiche l'état de la connexion au backend
   - Affiche l'URL du backend, l'état de la connexion
   - Permet de rafraîchir la connexion manuellement
   - Vérifie automatiquement l'état toutes les 30 secondes

### Composants Backend

1. **fournisseurIdentite/src/main/java/com/projet/route/controller/NetworkDiscoveryController.java**
   - Contrôleur Spring Boot avec l'endpoint `/api/discovery/ping`
   - Renvoie "pong" pour confirmer que le backend est accessible

## Configuration du Backend

Le backend doit être configuré pour écouter sur toutes les interfaces réseau :

```properties
server.address=0.0.0.0
server.port=8082
```

Ces configurations sont déjà présentes dans :
- `application-docker.properties` (pour Docker)
- `application.properties` (avec des valeurs par défaut)

## Fonctionnement

### Détection du Backend

1. L'application mobile tente d'abord de se connecter à localhost
2. Sur Android, elle vérifie d'abord l'adresse spéciale de l'émulateur (10.0.2.2)
3. Elle utilise ensuite `getLocalIpAddress()` pour déterminer le sous-réseau
4. Elle scanne le sous-réseau en priorisant les adresses courantes (1, 2, 100, 254)
5. Si aucun backend n'est trouvé, elle essaie des plages IP courantes (192.168.0.x, 192.168.1.x, etc.)

### Cache de l'URL

L'URL du backend découverte est mise en cache pour éviter de scanner le réseau à chaque requête. Le cache peut être rafraîchi manuellement avec `refreshApiBaseUrl()`.

### Vérification de l'État

Le composant BackendStatus vérifie automatiquement l'état de la connexion toutes les 30 secondes et affiche :
- L'URL du backend
- L'état de la connexion (connecté/déconnecté)
- Les messages d'erreur éventuels

## Utilisation

### Dans les Services

Pour effectuer des requêtes HTTP vers le backend, utilisez le service API :

```typescript
import { get, post, put, del } from '@/services/api';

// Exemple de requête GET
const response = await get('/api/users');

// Exemple de requête POST
const result = await post('/api/users', { name: 'John' });
```

### Dans les Composants

Pour afficher l'état de la connexion, utilisez le composant BackendStatus :

```vue
<template>
  <BackendStatus />
</template>

<script setup lang="ts">
import BackendStatus from '@/components/BackendStatus';
</script>
```

## Optimisations

1. **Timeout court** (500ms) pour éviter de bloquer l'interface utilisateur
2. **Priorisation des adresses IP courantes** pour accélérer la découverte
3. **Cache de l'URL** pour éviter de scanner le réseau à chaque requête
4. **Vérification automatique** de l'état de la connexion toutes les 30 secondes

## Plateformes Supportées

- **Android natif** : Détection automatique complète avec scan du sous-réseau
- **Web** : Utilise localhost par défaut
- **iOS** : Utilise l'hôte configuré par défaut (peut être étendu pour supporter la détection automatique)

## Dépannage

### Le backend n'est pas détecté

1. Vérifiez que le backend est en cours d'exécution
2. Vérifiez que le backend écoute sur toutes les interfaces (server.address=0.0.0.0)
3. Vérifiez que le mobile et le backend sont sur le même réseau WiFi
4. Vérifiez que le pare-feu n'est pas bloquant les connexions sur le port 8082

### La connexion est instable

1. Vérifiez la qualité du signal WiFi
2. Vérifiez que le backend n'a pas de problèmes de performance
3. Essayez de rafraîchir la connexion manuellement avec le bouton "Rafraîchir"

## Notes

- Le système de détection automatique est optimisé pour les réseaux WiFi domestiques typiques
- Le scan du réseau peut prendre plusieurs secondes sur les grands réseaux
- Le cache de l'URL est stocké en mémoire et est perdu lorsque l'application est fermée
