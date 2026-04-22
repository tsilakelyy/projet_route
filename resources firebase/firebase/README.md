# Configuration Firebase

Ce dossier contient les fichiers de configuration nécessaires pour utiliser Firebase dans le projet.

## Étapes de configuration

1. Créer un projet Firebase sur la console Firebase (https://console.firebase.google.com/)
2. Activer Firestore Database dans votre projet Firebase
3. Activer Authentication dans votre projet Firebase
4. Générer une clé de compte de service:
   - Allez dans les paramètres de votre projet Firebase
   - Sélectionnez "Comptes de service"
   - Cliquez sur "Générer une nouvelle clé privée"
   - Téléchargez le fichier JSON
5. Renommez le fichier JSON en `firebase-service-account.json` et remplacez le fichier placeholder dans ce dossier
6. Copiez les informations de configuration Firebase depuis la console et mettez à jour les fichiers suivants:
   - `mobile/src/firebase.ts`
   - `front-crypto/src/firebase.ts`

## Variables d'environnement Firebase

Pour les applications mobile et web, vous pouvez définir les variables d'environnement suivantes:

- `VITE_FIREBASE_API_KEY`: Clé API de votre projet Firebase
- `VITE_FIREBASE_AUTH_DOMAIN`: Domaine d'authentification Firebase
- `VITE_FIREBASE_PROJECT_ID`: ID de votre projet Firebase
- `VITE_FIREBASE_STORAGE_BUCKET`: Bucket de stockage Firebase
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: ID de l'expéditeur de messages Firebase
- `VITE_FIREBASE_APP_ID`: ID de l'application Firebase
- `VITE_FIREBASE_VAPID_KEY`: Clé VAPID pour les notifications push (optionnel)

## Sécurité

⚠️ IMPORTANT: Ne commitez jamais le fichier `firebase-service-account.json` dans un dépôt public. Ce fichier contient des informations sensibles qui permettent d'accéder à votre projet Firebase.
