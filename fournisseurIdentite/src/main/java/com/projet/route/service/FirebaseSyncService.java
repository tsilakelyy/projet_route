package com.projet.route.service;

import com.google.firebase.database.*;
import com.google.firebase.FirebaseApp;
import com.projet.route.models.HistoriquesTravaux;
import com.projet.route.models.Signalement;
import com.projet.route.models.Travaux;
import com.projet.route.models.Utilisateur;
import com.projet.route.repository.EntrepriseRepository;
import com.projet.route.repository.HistoriquesTravauxRepository;
import com.projet.route.repository.SignalementRepository;
import com.projet.route.repository.TravauxRepository;
import com.projet.route.repository.UtilisateurRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.context.event.EventListener;
import org.springframework.boot.context.event.ApplicationReadyEvent;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

@Service
public class FirebaseSyncService {

    private static final Logger LOGGER = LoggerFactory.getLogger(FirebaseSyncService.class);

    @Autowired
    private SignalementRepository signalementRepository;

    @Autowired
    private TravauxRepository travauxRepository;

    @Autowired
    private HistoriquesTravauxRepository historiquesTravauxRepository;

    @Autowired
    private EntrepriseRepository entrepriseRepository;

    @Autowired
    private TravauxService travauxService;

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    /** Flag pour éviter de spammer les erreurs si la RTDB est injoignable. */
    private volatile boolean realtimeDbReachable = true;

    // ─────────────────────────────────────────────────────────────────────────
    // Infrastructure
    // ─────────────────────────────────────────────────────────────────────────

   private DatabaseReference getDatabaseRef() {
    if (!isFirebaseConfigured()) throw new RuntimeException("Firebase not configured");
    return FirebaseDatabase.getInstance("https://projet-route-1-default-rtdb.firebaseio.com").getReference();
}

    /**
     * Lit un nœud RTDB de façon synchrone via CountDownLatch.
     * L'Admin SDK Java n'expose pas DatabaseReference.get() comme le client SDK.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> readNode(String path) throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(1);
        final Map<String, Object>[] result = new Map[]{null};
        final DatabaseError[] dbError = new DatabaseError[]{null};

        getDatabaseRef().child(path).addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                Object val = snapshot.getValue();
                if (val instanceof Map) {
                    result[0] = (Map<String, Object>) val;
                }
                latch.countDown();
            }

            @Override
            public void onCancelled(DatabaseError error) {
                dbError[0] = error;
                latch.countDown();
            }
        });

        boolean ok = latch.await(30, TimeUnit.SECONDS);
        if (!ok) throw new RuntimeException("Timeout reading RTDB node: " + path);
        if (dbError[0] != null) throw new RuntimeException("RTDB error: " + dbError[0].getMessage());
        return result[0];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // API publique — alias "ToFirestore" pour compatibilité controllers existants
    // ─────────────────────────────────────────────────────────────────────────

    /** Alias conservé pour SignalementController / TravauxController. */
    public void syncSignalementToFirestore(Signalement signalement) {
        try {
            syncSignalementToRealtime(signalement);
        } catch (ExecutionException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Sync signalement failed: " + e.getMessage(), e);
        }
    }

    /** Alias conservé pour TravauxController. */
    public void syncTravauxToFirestore(Travaux travaux) {
        try {
            syncTravauxToRealtime(travaux);
        } catch (ExecutionException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Sync travaux failed: " + e.getMessage(), e);
        }
    }

    /** Alias conservé pour TravauxController. */
    public void syncHistoriquesTravauxToFirestore(HistoriquesTravaux historique) {
        try {
            syncHistoriquesTravauxToRealtime(historique);
        } catch (ExecutionException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Sync historique failed: " + e.getMessage(), e);
        }
    }

    /**
     * Supprime un signalement de la Realtime Database.
     * Alias conservé pour SignalementController.
     */
    public void deleteSignalementFromFirestore(Signalement signalement) {
        if (!isFirebaseConfigured() || !realtimeDbReachable) return;
        try {
            String docId = signalement.getFirestoreId() != null
                    ? signalement.getFirestoreId()
                    : signalement.getIdSignalement().toString();

            CountDownLatch latch = new CountDownLatch(1);
            final DatabaseError[] err = {null};
            getDatabaseRef().child("signalements").child(docId)
                    .removeValue((error, ref) -> {
                        err[0] = error;
                        latch.countDown();
                    });
            latch.await(15, TimeUnit.SECONDS);
            if (err[0] != null) {
                LOGGER.error("RTDB delete signalement error: {}", err[0].getMessage());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.error("Interrupted while deleting signalement from RTDB", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Synchronisation globale
    // ─────────────────────────────────────────────────────────────────────────

    public void syncSignalementsToLocal() {
        syncSignalementsToLocalWithStats();
    }

    public Map<String, Object> syncFull() {
        Map<String, Object> report = new HashMap<>();
        List<String> errors = new ArrayList<>();

        if (!isFirebaseConfigured()) {
            report.put("pull", Map.of("signalements", 0, "travaux", 0, "historiquesTravaux", 0));
            report.put("push", Map.of("signalements", 0, "travaux", 0, "historiquesTravaux", 0, "utilisateurs", 0));
            report.put("errors", List.of("firebase_not_configured_or_realtime_missing"));
            report.put("syncedAt", LocalDateTime.now().toString());
            LOGGER.warn("syncFull skipped: Firebase Realtime Database not configured.");
            return report;
        }

        SyncStats pullStats;
        try {
            pullStats = syncSignalementsToLocalWithStats();
        } catch (Exception e) {
            pullStats = new SyncStats();
            errors.add("pull_failed: " + e.getMessage());
        }

        int pushedSignalements = 0, pushedTravaux = 0, pushedHistoriques = 0, pushedUtilisateurs = 0;

        if (realtimeDbReachable) {
            try {
                for (Signalement s : signalementRepository.findAll()) {
                    try { syncSignalementToRealtime(s); pushedSignalements++; }
                    catch (Exception e) { errors.add("push_signalement_" + s.getIdSignalement() + ": " + e.getMessage()); }
                }

                for (Travaux t : travauxRepository.findAll()) {
                    try { syncTravauxToRealtime(t); pushedTravaux++; }
                    catch (Exception e) { errors.add("push_travaux_" + t.getId() + ": " + e.getMessage()); }
                }

                for (HistoriquesTravaux h : historiquesTravauxRepository.findAll()) {
                    try { syncHistoriquesTravauxToRealtime(h); pushedHistoriques++; }
                    catch (Exception e) { errors.add("push_historique_" + h.getId() + ": " + e.getMessage()); }
                }

                for (Utilisateur user : utilisateurRepository.findAll()) {
                    if (user.getRole() != null && "MANAGER".equalsIgnoreCase(user.getRole().getNom())) continue;

                    String docId = user.getIdUtilisateur().toString();
                    Map<String, Object> data = new HashMap<>();
                    data.put("nomUtilisateur", user.getNomUtilisateur());
                    data.put("email", user.getEmail());
                    data.put("motDePasse", user.getMotDePasse());
                    data.put("sourceAuth", user.getSourceAuth());
                    data.put("estBloque", user.getEstBloque());
                    data.put("tentativesEchec", user.getTentativesEchec());
                    data.put("dateCreation", user.getDateCreation() != null ? user.getDateCreation().toString() : null);
                    data.put("dateModification", user.getDateModification() != null ? user.getDateModification().toString() : null);

                    setValueSync(getDatabaseRef().child("utilisateurs").child(docId), data);
                    pushedUtilisateurs++;
                }

            } catch (Exception e) {
                realtimeDbReachable = false;
                errors.add("push_failed: " + e.getMessage());
                LOGGER.error("Error pushing to Realtime Database: {}", e.getMessage(), e);
            }
        } else {
            errors.add("push_skipped: realtimeDb_unreachable");
            LOGGER.warn("Push skipped: Realtime Database marked as unreachable.");
        }

        report.put("pull", Map.of(
                "signalements", pullStats.pulledSignalements,
                "travaux", pullStats.pulledTravaux,
                "historiquesTravaux", pullStats.pulledHistoriques
        ));
        report.put("push", Map.of(
                "signalements", pushedSignalements,
                "travaux", pushedTravaux,
                "historiquesTravaux", pushedHistoriques,
                "utilisateurs", pushedUtilisateurs
        ));
        report.put("errors", errors);
        report.put("syncedAt", LocalDateTime.now().toString());
        return report;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pull : RTDB → PostgreSQL
    // ─────────────────────────────────────────────────────────────────────────

    private SyncStats syncSignalementsToLocalWithStats() {
        SyncStats stats = new SyncStats();

        if (!isFirebaseConfigured()) {
            LOGGER.info("syncSignalementsToLocalWithStats: Firebase not configured -> skip");
            return stats;
        }

        try {
            // Signalements
            Map<String, Object> signalementsMap = readNode("signalements");
            if (signalementsMap != null) {
                for (Map.Entry<String, Object> entry : signalementsMap.entrySet()) {
                    try {
                        String key = entry.getKey();
                        @SuppressWarnings("unchecked")
                        Map<String, Object> data = (Map<String, Object>) entry.getValue();

                        Signalement signalement = signalementRepository.findByFirestoreId(key);
                        if (signalement == null) {
                            signalement = new Signalement();
                            signalement.setFirestoreId(key);
                        }

                        signalement.setLatitude(parseBigDecimal(data.get("latitude")));
                        signalement.setLongitude(parseBigDecimal(data.get("longitude")));
                        signalement.setSurface(parseBigDecimal(data.get("surface")));
                        signalement.setIdUser(readString(data.get("Id_User"), readString(data.get("id_user"), "")));
                        signalement.setTypeProbleme(readString(data.get("type_probleme"), null));
                        signalement.setDescription(readString(data.get("description"), null));
                        signalement.setStatut(travauxService.normalizeStatut(readString(data.get("statut"), "nouveau")));
                        signalement.setNiveau(clampNiveau(parseInteger(data.get("niveau"))));
                        if (data.containsKey("photos")) {
                            signalement.setPhotosPayload(data.get("photos"));
                        }
                        signalement.setDateAjoute(parseDateTime(data.get("date_ajoute")));
                        signalement.setDateStatutMaj(parseDateTime(data.get("date_statut_maj")));

                        signalementRepository.save(signalement);
                        stats.pulledSignalements++;
                    } catch (Exception e) {
                        LOGGER.error("Error processing signalement {}: {}", entry.getKey(), e.getMessage());
                    }
                }
            }

            // Travaux
            Map<String, Object> travauxMap = readNode("travaux");
            if (travauxMap != null) {
                for (Map.Entry<String, Object> entry : travauxMap.entrySet()) {
                    try {
                        String key = entry.getKey();
                        @SuppressWarnings("unchecked")
                        Map<String, Object> data = (Map<String, Object>) entry.getValue();

                        Travaux travaux = travauxRepository.findByFirestoreId(key);
                        if (travaux == null) {
                            travaux = new Travaux();
                            travaux.setFirestoreId(key);
                        }

                        String signalementRef = readString(data.get("id_signalement"), null);
                        if (signalementRef != null) {
                            Signalement sig = signalementRepository.findByFirestoreId(signalementRef);
                            travaux.setSignalement(sig);
                        }

                        String entrepriseId = readString(data.get("id_entreprise"), null);
                        if (entrepriseId != null) {
                            try {
                                entrepriseRepository.findById(Long.parseLong(entrepriseId))
                                        .ifPresent(travaux::setEntreprise);
                            } catch (Exception ignored) {}
                        }

                        travaux.setBudget(parseBigDecimal(data.get("budget")));
                        travaux.setDateDebutTravaux(parseLocalDate(data.get("date_debut_travaux")));
                        travaux.setDateFinTravaux(parseLocalDate(data.get("date_fin_travaux")));
                        travaux.setAvancement(parseBigDecimal(data.get("avancement")));

                        travauxRepository.save(travaux);
                        stats.pulledTravaux++;
                    } catch (Exception e) {
                        LOGGER.error("Error processing travaux {}: {}", entry.getKey(), e.getMessage());
                    }
                }
            }

            // HistoriquesTravaux
            Map<String, Object> historiquesMap = readNode("historiques_travaux");
            if (historiquesMap != null) {
                for (Map.Entry<String, Object> entry : historiquesMap.entrySet()) {
                    try {
                        String key = entry.getKey();
                        @SuppressWarnings("unchecked")
                        Map<String, Object> data = (Map<String, Object>) entry.getValue();

                        HistoriquesTravaux historique = historiquesTravauxRepository.findByFirestoreId(key);
                        if (historique == null) {
                            historique = new HistoriquesTravaux();
                            historique.setFirestoreId(key);
                        }

                        String travauxRef = readString(data.get("id_travaux"), null);
                        if (travauxRef != null) {
                            historique.setTravaux(travauxRepository.findByFirestoreId(travauxRef));
                        }

                        historique.setDateModification(parseDateTime(data.get("date_modification")));
                        historique.setAvancement(parseBigDecimal(data.get("avancement")));
                        historique.setCommentaire(readString(data.get("commentaire"), null));

                        historiquesTravauxRepository.save(historique);
                        stats.pulledHistoriques++;
                    } catch (Exception e) {
                        LOGGER.error("Error processing historique {}: {}", entry.getKey(), e.getMessage());
                    }
                }
            }

        } catch (Exception e) {
            realtimeDbReachable = false;
            String msg = "Error syncing from Realtime Database: " + e.getMessage();
            LOGGER.error(msg, e);
            throw new RuntimeException(msg, e);
        }

        return stats;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Push : PostgreSQL → RTDB
    // ─────────────────────────────────────────────────────────────────────────

    public void syncSignalementToRealtime(Signalement signalement) throws ExecutionException, InterruptedException {
        if (!isFirebaseConfigured() || !realtimeDbReachable) return;

        String docId = signalement.getFirestoreId() != null
                ? signalement.getFirestoreId()
                : signalement.getIdSignalement().toString();

        Map<String, Object> data = new HashMap<>();
        data.put("latitude", signalement.getLatitude() != null ? signalement.getLatitude().doubleValue() : null);
        data.put("longitude", signalement.getLongitude() != null ? signalement.getLongitude().doubleValue() : null);
        data.put("surface", signalement.getSurface() != null ? signalement.getSurface().doubleValue() : null);
        data.put("Id_User", signalement.getIdUser());
        data.put("type_probleme", signalement.getTypeProbleme());
        data.put("description", signalement.getDescription());
        data.put("statut", travauxService.normalizeStatut(signalement.getStatut()));
        data.put("niveau", signalement.getNiveau() != null ? signalement.getNiveau() : 1);
        data.put("photos", signalement.getPhotosEntries());
        data.put("date_ajoute", signalement.getDateAjoute() != null ? signalement.getDateAjoute().toString() : null);
        data.put("date_statut_maj", signalement.getDateStatutMaj() != null ? signalement.getDateStatutMaj().toString() : null);

        setValueSync(getDatabaseRef().child("signalements").child(docId), data);

        if (signalement.getFirestoreId() == null) {
            signalement.setFirestoreId(docId);
            signalementRepository.save(signalement);
        }
    }

    public void syncTravauxToRealtime(Travaux travaux) throws ExecutionException, InterruptedException {
        if (!isFirebaseConfigured() || !realtimeDbReachable) return;

        String docId = travaux.getFirestoreId() != null ? travaux.getFirestoreId() : travaux.getId().toString();
        Map<String, Object> data = new HashMap<>();

        if (travaux.getSignalement() != null) {
            String signalementRef = travaux.getSignalement().getFirestoreId() != null
                    ? travaux.getSignalement().getFirestoreId()
                    : travaux.getSignalement().getIdSignalement().toString();
            data.put("id_signalement", signalementRef);
        }
        if (travaux.getEntreprise() != null) {
            data.put("id_entreprise", travaux.getEntreprise().getIdEntreprise().toString());
        }
        if (travaux.getBudget() != null) data.put("budget", travaux.getBudget().doubleValue());
        if (travaux.getDateDebutTravaux() != null) data.put("date_debut_travaux", travaux.getDateDebutTravaux().toString());
        if (travaux.getDateFinTravaux() != null) data.put("date_fin_travaux", travaux.getDateFinTravaux().toString());
        if (travaux.getAvancement() != null) data.put("avancement", travaux.getAvancement().doubleValue());

        setValueSync(getDatabaseRef().child("travaux").child(docId), data);

        if (travaux.getFirestoreId() == null) {
            travaux.setFirestoreId(docId);
            travauxRepository.save(travaux);
        }
    }

    public void syncHistoriquesTravauxToRealtime(HistoriquesTravaux historique) throws ExecutionException, InterruptedException {
        if (!isFirebaseConfigured() || !realtimeDbReachable) return;

        String docId = historique.getFirestoreId() != null ? historique.getFirestoreId() : historique.getId().toString();
        Map<String, Object> data = new HashMap<>();

        if (historique.getTravaux() != null) {
            String travauxRef = historique.getTravaux().getFirestoreId() != null
                    ? historique.getTravaux().getFirestoreId()
                    : historique.getTravaux().getId().toString();
            data.put("id_travaux", travauxRef);
        }
        data.put("date_modification", historique.getDateModification() != null ? historique.getDateModification().toString() : null);
        data.put("avancement", historique.getAvancement() != null ? historique.getAvancement().doubleValue() : null);
        data.put("commentaire", historique.getCommentaire());

        setValueSync(getDatabaseRef().child("historiques_travaux").child(docId), data);

        if (historique.getFirestoreId() == null) {
            historique.setFirestoreId(docId);
            historiquesTravauxRepository.save(historique);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper : écriture synchrone via CountDownLatch
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * setValueAsync n'est pas disponible dans toutes les versions du SDK Admin.
     * On utilise DatabaseReference.setValue() avec un callback + CountDownLatch.
     */
    private void setValueSync(DatabaseReference ref, Object value) throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(1);
        final DatabaseError[] err = {null};

        ref.setValue(value, (error, reference) -> {
            err[0] = error;
            latch.countDown();
        });

        boolean ok = latch.await(15, TimeUnit.SECONDS);
        if (!ok) throw new RuntimeException("Timeout writing to RTDB: " + ref.getPath());
        if (err[0] != null) throw new RuntimeException("RTDB write error: " + err[0].getMessage());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Utilitaires de parsing
    // ─────────────────────────────────────────────────────────────────────────

    private String readString(Object value, String fallback) {
        if (value == null) return fallback;
        String str = value.toString().trim();
        return str.isEmpty() ? fallback : str;
    }

    private BigDecimal parseBigDecimal(Object value) {
        if (value == null) return null;
        try { return new BigDecimal(value.toString()); } catch (Exception ignored) { return null; }
    }

    private Integer parseInteger(Object value) {
        if (value == null) return null;
        try {
            if (value instanceof Number) return ((Number) value).intValue();
            return Integer.parseInt(value.toString().trim());
        } catch (Exception ignored) { return null; }
    }

    private LocalDateTime parseDateTime(Object value) {
        if (value == null) return null;
        try { return LocalDateTime.parse(value.toString()); } catch (Exception ignored) { return null; }
    }

    private LocalDate parseLocalDate(Object value) {
        if (value == null) return null;
        try { return LocalDate.parse(value.toString()); } catch (Exception ignored) { return null; }
    }

    private int clampNiveau(Integer niveau) {
        if (niveau == null) return 1;
        if (niveau < 1) return 1;
        return Math.min(niveau, 10);
    }

    private boolean isFirebaseConfigured() {
        boolean appInit = !FirebaseApp.getApps().isEmpty();
        if (!appInit) LOGGER.debug("isFirebaseConfigured: FirebaseApp non initialisé");
        return appInit;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Startup
    // ─────────────────────────────────────────────────────────────────────────

    @EventListener(ApplicationReadyEvent.class)
    public void syncOnStartup() {
        try {
            LOGGER.info("🔄 Démarrage synchronisation initiale PostgreSQL → Firebase Realtime Database...");
            Map<String, Object> report = syncFull();
            LOGGER.info("✅ Sync initiale terminée: {}", report);
        } catch (Exception e) {
            LOGGER.error("❌ Erreur sync initiale: {}", e.getMessage(), e);
        }
    }

    private static class SyncStats {
        int pulledSignalements;
        int pulledTravaux;
        int pulledHistoriques;
    }
}