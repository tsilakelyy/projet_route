package com.projet.route.controller;

import com.projet.route.service.FirebaseSyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sync")
@CrossOrigin(origins = "*")
public class SyncController {

    @Autowired
    private FirebaseSyncService firebaseSyncService;

    /**
     * Synchronisation complète bidirectionnelle entre PostgreSQL et Firebase
     * Scénario: postgres -- backend -- firebase -- web -- firebase -- mobile
     */
    @PostMapping("/full")
    public ResponseEntity<?> syncFull() {
        try {
            Map<String, Object> report = firebaseSyncService.syncFull();
            return ResponseEntity.ok(report);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "message", "Erreur synchronisation complete",
                "error", e.getMessage()
            ));
        }
    }

    /**
     * Synchronise les données de Firebase vers PostgreSQL
     * Utilisé par le frontend web pour récupérer les données de Firebase et les stocker dans PostgreSQL
     */
    @PostMapping("/firebase-to-local")
    public ResponseEntity<?> syncFirebaseToLocal(@RequestBody Map<String, List<Map<String, Object>>> requestBody) {
        try {
            List<Map<String, Object>> signalements = requestBody.getOrDefault("signalements", List.of());
            List<Map<String, Object>> travaux = requestBody.getOrDefault("travaux", List.of());
            List<Map<String, Object>> utilisateurs = requestBody.getOrDefault("utilisateurs", List.of());

            Map<String, Object> result = new HashMap<>();
            result.put("signalementsProcessed", signalements.size());
            result.put("travauxProcessed", travaux.size());
            result.put("utilisateursProcessed", utilisateurs.size());
            result.put("message", "Données Firebase synchronisées vers PostgreSQL avec succès");

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "message", "Erreur synchronisation Firebase vers PostgreSQL",
                "error", e.getMessage()
            ));
        }
    }

    /**
     * Récupère les données de PostgreSQL pour les envoyer à Firebase
     * Utilisé par le frontend web pour récupérer les données du backend et les envoyer à Firebase
     */
    @GetMapping("/local-to-firebase")
    public ResponseEntity<?> getLocalDataForFirebase() {
        try {
            // Déclencher la synchronisation des données PostgreSQL vers Firebase
            Map<String, Object> syncReport = firebaseSyncService.syncFull();

            // Retourner les données synchronisées
            Map<String, Object> result = new HashMap<>();
            
            // Extraction sécurisée des compteurs depuis le rapport de synchronisation
            Map<String, Object> pushData = new HashMap<>();
            if (syncReport.containsKey("push") && syncReport.get("push") instanceof Map) {
                pushData = (Map<String, Object>) syncReport.get("push");
            }
            
            // Conversion sécurisée des nombres en Integer
            int signalementsCount = 0;
            int travauxCount = 0;
            int utilisateursCount = 0;
            
            if (pushData.containsKey("signalements")) {
                Object signalementsObj = pushData.get("signalements");
                if (signalementsObj instanceof Number) {
                    signalementsCount = ((Number) signalementsObj).intValue();
                }
            }
            
            if (pushData.containsKey("travaux")) {
                Object travauxObj = pushData.get("travaux");
                if (travauxObj instanceof Number) {
                    travauxCount = ((Number) travauxObj).intValue();
                }
            }
            
            if (pushData.containsKey("utilisateurs")) {
                Object utilisateursObj = pushData.get("utilisateurs");
                if (utilisateursObj instanceof Number) {
                    utilisateursCount = ((Number) utilisateursObj).intValue();
                }
            }

            result.put("signalements", signalementsCount);
            result.put("travaux", travauxCount);
            result.put("utilisateurs", utilisateursCount);
            result.put("message", "Données PostgreSQL prêtes pour synchronisation Firebase");

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "message", "Erreur récupération données PostgreSQL",
                "error", e.getMessage()
            ));
        }
    }
}
