package com.projet.route.controller;

import com.projet.route.models.HistoriquesTravaux;
import com.projet.route.models.Travaux;
import com.projet.route.repository.HistoriquesTravauxRepository;
import com.projet.route.repository.TravauxRepository;
import com.projet.route.service.FirebaseSyncService;
import com.projet.route.service.TravauxService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/travaux")
@CrossOrigin(origins = "*")
public class TravauxController {

    @Autowired
    private TravauxRepository travauxRepository;

    @Autowired
    private HistoriquesTravauxRepository historiquesTravauxRepository;

    @Autowired
    private FirebaseSyncService firebaseSyncService;

    @Autowired
    private TravauxService travauxService;

    @GetMapping
    public List<Travaux> getAllTravaux() {
        return travauxService.getAllTravaux();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Travaux> getTravauxById(@PathVariable Long id) {
        Optional<Travaux> travaux = travauxService.getTravauxById(id);
        return travaux.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createTravaux(@RequestBody Travaux travaux) {
        try {
            Travaux savedTravaux = travauxService.createTravaux(travaux);
            try {
                firebaseSyncService.syncTravauxToFirestore(savedTravaux);
            } catch (Exception e) {
                System.err.println("Failed to sync travaux to Realtime Database: " + e.getMessage());
            }
            return ResponseEntity.ok(savedTravaux);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateTravaux(@PathVariable Long id, @RequestBody Travaux travauxDetails) {
        try {
            Travaux updatedTravaux = travauxService.updateTravaux(id, travauxDetails);
            try {
                firebaseSyncService.syncTravauxToFirestore(updatedTravaux);
            } catch (Exception e) {
                System.err.println("Failed to sync travaux to Realtime Database: " + e.getMessage());
            }
            return ResponseEntity.ok(updatedTravaux);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTravaux(@PathVariable Long id) {
        Optional<Travaux> travaux = travauxRepository.findById(id);
        if (travaux.isPresent()) {
            historiquesTravauxRepository.deleteByTravauxId(id);
            travauxRepository.delete(travaux.get());
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/historique")
    public ResponseEntity<?> addHistorique(@PathVariable Long id, @RequestBody HistoriquesTravaux historique) {
        Optional<Travaux> travaux = travauxRepository.findById(id);
        if (travaux.isPresent()) {
            historique.setTravaux(travaux.get());
            HistoriquesTravaux savedHistorique = historiquesTravauxRepository.save(historique);

            try {
                firebaseSyncService.syncHistoriquesTravauxToFirestore(savedHistorique);
            } catch (Exception e) {
                System.err.println("Failed to sync historique travaux to Realtime Database: " + e.getMessage());
            }

            return ResponseEntity.ok(savedHistorique);
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getTravauxStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalTravaux", travauxRepository.count());
        stats.put("delaiMoyenJours", travauxService.calculateAverageDelayDays());
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/stats/delais")
    public ResponseEntity<Map<String, Object>> getTravauxDelayStats() {
        return ResponseEntity.ok(travauxService.calculateDelayStats());
    }
}