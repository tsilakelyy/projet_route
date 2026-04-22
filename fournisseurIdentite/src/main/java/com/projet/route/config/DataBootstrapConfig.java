package com.projet.route.config;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.UserRecord;
import com.projet.route.models.Entreprise;
import com.projet.route.models.ParametreAuth;
import com.projet.route.models.Role;
import com.projet.route.models.Utilisateur;
import com.projet.route.repository.EntrepriseRepository;
import com.projet.route.repository.ParametreAuthRepository;
import com.projet.route.repository.RoleRepository;
import com.projet.route.repository.UtilisateurRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Configuration
public class DataBootstrapConfig {
    private static final Logger LOGGER = LoggerFactory.getLogger(DataBootstrapConfig.class);
    private static final String DEFAULT_MANAGER_PASSWORD = "admin1234";

    @Value("${bootstrap.primary-manager.username:rojo.rabenanahary}")
    private String primaryManagerUsername;

    @Value("${bootstrap.primary-manager.email:rojo.rabenanahary@gmail.com}")
    private String primaryManagerEmail;

    @Value("${bootstrap.primary-manager.password:admin1234}")
    private String primaryManagerPassword;

    @Value("${bootstrap.legacy-manager.enabled:true}")
    private boolean legacyManagerEnabled;

    @Value("${bootstrap.legacy-manager.username:adminfirebase}")
    private String legacyManagerUsername;

    @Value("${bootstrap.legacy-manager.email:adminfirebase@gmail.com}")
    private String legacyManagerEmail;

    @Value("${bootstrap.legacy-manager.password:admin1234}")
    private String legacyManagerPassword;

    @Bean
    CommandLineRunner bootstrapData(
            RoleRepository roleRepository,
            UtilisateurRepository utilisateurRepository,
            ParametreAuthRepository parametreAuthRepository,
            EntrepriseRepository entrepriseRepository
    ) {
        return args -> {
            ensureRole(roleRepository, "UTILISATEUR");
            Role managerRole = ensureRole(roleRepository, "MANAGER");

            Utilisateur primaryManager = ensureManager(
                    utilisateurRepository,
                    managerRole,
                    primaryManagerUsername,
                    primaryManagerEmail,
                    primaryManagerPassword
            );
            syncManagerToFirebase(primaryManager);

            String normalizedPrimaryEmail = normalizeEmail(primaryManagerEmail);
            String normalizedLegacyEmail = normalizeEmail(legacyManagerEmail);
            if (legacyManagerEnabled && !normalizedLegacyEmail.equalsIgnoreCase(normalizedPrimaryEmail)) {
                Utilisateur legacyManager = ensureManager(
                        utilisateurRepository,
                        managerRole,
                        legacyManagerUsername,
                        legacyManagerEmail,
                        legacyManagerPassword
                );
                syncManagerToFirebase(legacyManager);
            }

            ensureAuthParam(parametreAuthRepository, "limite_tentatives", "3",
                    "Nombre maximum de tentatives de connexion avant blocage");
            ensureAuthParam(parametreAuthRepository, "duree_session_minutes", "60",
                    "Duree de vie d'une session en minutes");
            ensureAuthParam(parametreAuthRepository, "prix_par_m2", "100000",
                    "Prix forfaitaire par m2 pour le calcul automatique du budget");

            ensureEntreprises(entrepriseRepository, Arrays.asList(
                    "Colas Madagascar",
                    "Societe Routiere de Madagascar",
                    "TP Madagascar",
                    "BTP Construction",
                    "Route Express",
                    "Infra Madagascar",
                    "Travaux Publics Antananarivo",
                    "Genie Civil Madagascar"
            ));
        };
    }

    private Role ensureRole(RoleRepository roleRepository, String nom) {
        Role existing = roleRepository.findByNom(nom);
        if (existing != null) {
            return existing;
        }
        Role role = new Role();
        role.setNom(nom);
        return roleRepository.save(role);
    }

    private Utilisateur ensureManager(
            UtilisateurRepository utilisateurRepository,
            Role managerRole,
            String username,
            String email,
            String password
    ) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedUsername = normalizeText(username, "manager");
        String normalizedPassword = normalizePassword(password);

        Optional<Utilisateur> managerOpt = utilisateurRepository.findByEmail(normalizedEmail);
        Utilisateur manager = managerOpt.orElseGet(Utilisateur::new);

        manager.setNomUtilisateur(normalizedUsername);
        manager.setEmail(normalizedEmail);
        manager.setMotDePasse(normalizedPassword);
        manager.setRole(managerRole);
        manager.setSourceAuth("local");
        return utilisateurRepository.save(manager);
    }

    private void syncManagerToFirebase(Utilisateur manager) {
        if (manager == null) {
            return;
        }
        if (manager.getEmail() == null || manager.getEmail().isBlank()) {
            return;
        }
        if (!isFirebaseCompatiblePassword(manager.getMotDePasse())) {
            LOGGER.warn(
                    "Firebase manager sync skipped for {}: password must contain at least 6 characters",
                    manager.getEmail()
            );
            return;
        }
        if (FirebaseApp.getApps().isEmpty()) {
            LOGGER.info("Firebase not initialized yet; manager {} kept local only.", manager.getEmail());
            return;
        }

        try {
            FirebaseAuth auth = FirebaseAuth.getInstance();
            try {
                UserRecord existing = auth.getUserByEmail(manager.getEmail());
                if (manager.getNomUtilisateur() != null
                        && !manager.getNomUtilisateur().isBlank()
                        && !manager.getNomUtilisateur().equals(existing.getDisplayName())) {
                    UserRecord.UpdateRequest updateRequest = new UserRecord.UpdateRequest(existing.getUid())
                            .setDisplayName(manager.getNomUtilisateur());
                    auth.updateUser(updateRequest);
                }
                return;
            } catch (Exception ignored) {
                // user not found in Firebase Auth
            }

            UserRecord.CreateRequest createRequest = new UserRecord.CreateRequest()
                    .setEmail(manager.getEmail())
                    .setPassword(manager.getMotDePasse());
            if (manager.getNomUtilisateur() != null && !manager.getNomUtilisateur().isBlank()) {
                createRequest.setDisplayName(manager.getNomUtilisateur());
            }

            auth.createUser(createRequest);
            LOGGER.info("Firebase manager account ensured for {}", manager.getEmail());
        } catch (Exception e) {
            LOGGER.warn("Unable to sync manager {} to Firebase: {}", manager.getEmail(), e.getMessage());
        }
    }

    private void ensureAuthParam(
            ParametreAuthRepository parametreAuthRepository,
            String cle,
            String valeur,
            String description
    ) {
        if (parametreAuthRepository.findByCle(cle).isPresent()) {
            return;
        }
        ParametreAuth param = new ParametreAuth();
        param.setCle(cle);
        param.setValeur(valeur);
        param.setDescription(description);
        parametreAuthRepository.save(param);
    }

    private void ensureEntreprises(EntrepriseRepository entrepriseRepository, List<String> noms) {
        for (String nom : noms) {
            if (entrepriseRepository.findByNom(nom).isPresent()) {
                continue;
            }
            entrepriseRepository.save(new Entreprise(nom));
        }
    }

    private String normalizeEmail(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase();
        return normalized.isBlank() ? "adminfirebase@gmail.com" : normalized;
    }

    private String normalizeText(String value, String fallback) {
        String normalized = value == null ? "" : value.trim();
        return normalized.isBlank() ? fallback : normalized;
    }

    private String normalizePassword(String value) {
        String normalized = value == null ? "" : value.trim();
        return normalized.length() >= 6 ? normalized : DEFAULT_MANAGER_PASSWORD;
    }

    private boolean isFirebaseCompatiblePassword(String password) {
        return password != null && password.length() >= 6;
    }
}
