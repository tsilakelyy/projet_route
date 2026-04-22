package com.projet.route.controller;

import com.projet.route.models.Signalement;
import com.projet.route.models.Travaux;
import com.projet.route.repository.HistoriquesTravauxRepository;
import com.projet.route.repository.SignalementRepository;
import com.projet.route.repository.TravauxRepository;
import com.projet.route.service.AuditLogService;
import com.projet.route.service.FirebaseSyncService;
import com.projet.route.service.TravauxService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/signalements")
@CrossOrigin(origins = "*")
public class SignalementController {

    @Autowired
    private SignalementRepository signalementRepository;

    @Autowired
    private FirebaseSyncService firebaseSyncService;

    @Autowired
    private TravauxService travauxService;

    @Autowired
    private TravauxRepository travauxRepository;

    @Autowired
    private HistoriquesTravauxRepository historiquesTravauxRepository;

    @Autowired
    private AuditLogService auditLogService;

    @GetMapping
    public List<Signalement> getAllSignalements() {
        return signalementRepository.findAll();
    }

    @GetMapping("/user/{idUser}")
    public List<Signalement> getSignalementsByUser(@PathVariable String idUser) {
        return signalementRepository.findByIdUserOrderByDateAjouteDesc(idUser);
    }

    @GetMapping("/notifications/{idUser}")
    public List<Signalement> getStatusNotifications(
        @PathVariable String idUser,
        @RequestParam(required = false) String since
    ) {
        LocalDateTime baseline = LocalDateTime.now().minusDays(7);
        List<Signalement> byUser = signalementRepository.findByIdUser(idUser);
        return byUser.stream()
            .filter(s -> s.getDateStatutMaj() != null && s.getDateStatutMaj().isAfter(baseline))
            .sorted(Comparator.comparing(Signalement::getDateStatutMaj).reversed())
            .toList();
    }

    @GetMapping("/sync")
    public ResponseEntity<String> syncSignalements() {
        try {
            firebaseSyncService.syncSignalementsToLocal();
            return ResponseEntity.ok("Synchronisation terminee");
        } catch (Exception e) {
            System.err.println("Error in syncSignalements: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Erreur lors de la synchronisation: " + e.getMessage());
        }
    }

    @PostMapping("/sync")
    public ResponseEntity<String> syncSignalementsPost() {
        return syncSignalements();
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<Signalement> getSignalementById(@PathVariable Long id) {
        Optional<Signalement> signalement = signalementRepository.findById(id);
        return signalement.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createSignalement(@RequestBody Signalement signalement) {
        try {
            if (signalement.getIdUser() == null || signalement.getIdUser().isBlank()) {
                return ResponseEntity.badRequest().body("idUser est obligatoire");
            }

            signalement.setStatut(travauxService.normalizeStatut(signalement.getStatut()));
            signalement.setDateStatutMaj(LocalDateTime.now());
            signalement.setNiveau(clampNiveau(signalement.getNiveau()));

            Signalement saved = signalementRepository.save(signalement);
            auditLogService.log(
                "signalement",
                String.valueOf(saved.getIdSignalement()),
                "CREATE",
                saved.getIdUser(),
                "Nouveau signalement: type=" + (saved.getTypeProbleme() != null ? saved.getTypeProbleme() : "autre")
            );

            try {
                firebaseSyncService.syncSignalementToFirestore(saved);
            } catch (Exception e) {
                System.err.println("Failed to sync signalement to Realtime Database: " + e.getMessage());
            }

            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Erreur creation signalement: " + e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateSignalement(@PathVariable Long id, @RequestBody Signalement payload) {
        Optional<Signalement> signalementOpt = signalementRepository.findById(id);
        if (signalementOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        try {
            Signalement signalement = signalementOpt.get();

            if (payload.getSurface() != null) signalement.setSurface(payload.getSurface());
            if (payload.getLatitude() != null) signalement.setLatitude(payload.getLatitude());
            if (payload.getLongitude() != null) signalement.setLongitude(payload.getLongitude());
            if (payload.getLieu() != null) signalement.setLieu(payload.getLieu());
            if (payload.getIdUser() != null && !payload.getIdUser().isBlank()) signalement.setIdUser(payload.getIdUser());
            if (payload.getTypeProbleme() != null) signalement.setTypeProbleme(payload.getTypeProbleme());
            if (payload.getDescription() != null) signalement.setDescription(payload.getDescription());
            if (payload.isPhotosProvided()) signalement.setPhotosEntries(payload.getPhotosEntries());
            if (payload.getNiveau() != null) signalement.setNiveau(clampNiveau(payload.getNiveau()));
            if (payload.getStatut() != null) {
                signalement.setStatut(travauxService.normalizeStatut(payload.getStatut()));
                signalement.setDateStatutMaj(LocalDateTime.now());
            }

            Signalement updated = signalementRepository.save(signalement);
            auditLogService.log(
                "signalement",
                String.valueOf(updated.getIdSignalement()),
                "UPDATE",
                updated.getIdUser(),
                "Mise a jour signalement: statut=" + updated.getStatut() + ", niveau=" + updated.getNiveau()
            );

            if (payload.getStatut() != null) {
                travauxService.updateAvancementBasedOnStatut(updated.getIdSignalement(), updated.getStatut());
            }

            try {
                firebaseSyncService.syncSignalementToFirestore(updated);
            } catch (Exception e) {
                System.err.println("Failed to sync signalement to Realtime Database: " + e.getMessage());
            }

            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Erreur update signalement: " + e.getMessage());
        }
    }

    @Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteSignalement(@PathVariable Long id) {
        Optional<Signalement> signalementOpt = signalementRepository.findById(id);
        if (signalementOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        try {
            Signalement signalement = signalementOpt.get();

            List<Travaux> travauxLies = travauxRepository.findAllBySignalementIdSignalement(id);
            for (Travaux travaux : travauxLies) {
                historiquesTravauxRepository.deleteByTravauxId(travaux.getId());
            }
            if (!travauxLies.isEmpty()) {
                travauxRepository.deleteAll(travauxLies);
            }

            signalementRepository.delete(signalement);
            auditLogService.log(
                "signalement",
                String.valueOf(signalement.getIdSignalement()),
                "DELETE",
                signalement.getIdUser(),
                "Suppression signalement et ses travaux lies"
            );

            try {
                firebaseSyncService.deleteSignalementFromFirestore(signalement);
            } catch (Exception e) {
                System.err.println("Failed to delete signalement from Realtime Database: " + e.getMessage());
            }

            return ResponseEntity.ok("Signalement supprime");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Erreur suppression signalement: " + e.getMessage());
        }
    }

    @PutMapping("/{id}/statut")
    public ResponseEntity<String> updateStatut(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            String statut = body.get("statut");
            String normalized = travauxService.normalizeStatut(statut);

            Optional<Signalement> signalementOpt = signalementRepository.findById(id);
            if (signalementOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Signalement signalement = signalementOpt.get();
            signalement.setStatut(normalized);
            signalement.setDateStatutMaj(LocalDateTime.now());
            signalementRepository.save(signalement);
            auditLogService.log(
                "signalement",
                String.valueOf(signalement.getIdSignalement()),
                "STATUS_UPDATE",
                signalement.getIdUser(),
                "Nouveau statut: " + normalized
            );

            travauxService.updateAvancementBasedOnStatut(id, normalized);

            try {
                firebaseSyncService.syncSignalementToFirestore(signalement);
            } catch (Exception e) {
                System.err.println("Failed to sync status to Realtime Database: " + e.getMessage());
            }

            return ResponseEntity.ok("Statut mis a jour");
        } catch (Exception e) {
            System.err.println("Error updating statut: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Erreur: " + e.getMessage());
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        List<Signalement> signalements = signalementRepository.findAll();

        int count = signalements.size();
        double totalSurface = signalements.stream()
            .map(s -> s.getSurface() != null ? s.getSurface().doubleValue() : 0d)
            .reduce(0d, Double::sum);

        double totalAvancement = travauxService.getAllTravaux().stream()
            .map(t -> t.getAvancement() != null ? t.getAvancement().doubleValue() : 0d)
            .reduce(0d, Double::sum);

        int travauxCount = travauxService.getAllTravaux().size();
        double avancementMoyen = travauxCount > 0 ? totalAvancement / travauxCount : 0d;

        double totalBudget = travauxService.getAllTravaux().stream()
            .map(t -> t.getBudget() != null ? t.getBudget().doubleValue() : 0d)
            .reduce(0d, Double::sum);

        Map<String, Object> stats = new HashMap<>();
        stats.put("count", count);
        stats.put("totalSurface", totalSurface);
        stats.put("averageAvancement", avancementMoyen);
        stats.put("totalBudget", totalBudget);
        stats.put("delaiMoyenJours", travauxService.calculateAverageDelayDays());

        return ResponseEntity.ok(stats);
    }

    private int clampNiveau(Integer niveau) {
        if (niveau == null) return 1;
        if (niveau < 1) return 1;
        return Math.min(niveau, 10);
    }
}