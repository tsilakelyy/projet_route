// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAgooGs6XiDVqu5FhDiBHC5Actg7n_CzP0",
  authDomain: "projet-route-1.firebaseapp.com",
  databaseURL: "https://projet-route-1-default-rtdb.firebaseio.com",
  projectId: "projet-route-1",
  storageBucket: "projet-route-1.firebasestorage.app",
  messagingSenderId: "224726348719",
  appId: "1:224726348719:web:7d8cfa5a7a8667f7d1355a",
  measurementId: "G-4NWKP64G49"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
