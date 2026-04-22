package com.projet.route.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.io.InputStream;

@Component
public class FirebaseInitializer {

    private static final Logger LOGGER = LoggerFactory.getLogger(FirebaseInitializer.class);

    @PostConstruct
    public void init() {
        try {
            InputStream serviceAccount = getClass().getClassLoader()
                    .getResourceAsStream("firebase/firebase-service-account.json");

            if (serviceAccount == null) {
                LOGGER.error("Fichier firebase-service-account.json introuvable !");
                return;
            }

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .build();

            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(options);
                LOGGER.info("Firebase initialisé correctement !");
            } else {
                LOGGER.info("Firebase déjà initialisé");
            }

        } catch (Exception e) {
            LOGGER.error("Erreur lors de l'initialisation de Firebase: ", e);
        }
    }
}
