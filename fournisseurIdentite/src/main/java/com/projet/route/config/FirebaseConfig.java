package com.projet.route.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@Configuration
public class FirebaseConfig {

    private static final Logger LOGGER = LoggerFactory.getLogger(FirebaseConfig.class);

    public static volatile boolean RTDB_AVAILABLE = false;

    @Value("${firebase.service-account-path:${FIREBASE_SERVICE_ACCOUNT_PATH:}}")
    private String firebaseServiceAccountPath;

    @PostConstruct
    public void initFirebase() {
        if (!FirebaseApp.getApps().isEmpty()) {
            LOGGER.info("FirebaseApp déjà initialisé, skip initialisation.");
            checkRealtimeDbAvailability();
            return;
        }

        if (firebaseServiceAccountPath == null || firebaseServiceAccountPath.isBlank()) {
            LOGGER.warn("Firebase disabled: FIREBASE_SERVICE_ACCOUNT_PATH is not set");
            return;
        }

        try (InputStream serviceAccount = new FileInputStream(firebaseServiceAccountPath)) {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .setDatabaseUrl("https://projet-route-1-default-rtdb.firebaseio.com")
                    .build();

            FirebaseApp.initializeApp(options);
            LOGGER.info("Firebase initialized for Realtime Database from {}", firebaseServiceAccountPath);

            checkRealtimeDbAvailability();

        } catch (IOException e) {
            LOGGER.error("Firebase initialization failed using path {}: {}", firebaseServiceAccountPath, e.getMessage(), e);
        }
    }

    /**
     * Vérifie que la Realtime Database est joignable en lisant .info/connected
     * via un listener (l'Admin SDK Java n'expose pas DatabaseReference.get()).
     */
    private void checkRealtimeDbAvailability() {
        try {
            CountDownLatch latch = new CountDownLatch(1);
            final boolean[] reached = {false};

            FirebaseDatabase.getInstance()
                    .getReference(".info/connected")
                    .addListenerForSingleValueEvent(new ValueEventListener() {
                        @Override
                        public void onDataChange(DataSnapshot snapshot) {
                            reached[0] = true;
                            latch.countDown();
                        }

                        @Override
                        public void onCancelled(DatabaseError error) {
                            LOGGER.warn("RTDB check cancelled: {}", error.getMessage());
                            latch.countDown();
                        }
                    });

            // Attendre max 10 secondes
            boolean timedOut = !latch.await(10, TimeUnit.SECONDS);
            RTDB_AVAILABLE = !timedOut && reached[0];

            if (RTDB_AVAILABLE) {
                LOGGER.info("✅ Realtime Database disponible.");
            } else {
                LOGGER.warn("⚠️ Realtime Database non joignable (timeout ou annulé).");
            }
        } catch (Exception e) {
            RTDB_AVAILABLE = false;
            LOGGER.warn("Impossible de vérifier Realtime Database: {}", e.getMessage());
        }
    }
}