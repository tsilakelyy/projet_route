package com.projet.route.controller;

import com.projet.route.models.HistoriquesTravaux;
import com.projet.route.repository.HistoriquesTravauxRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/historiques-travaux")
@CrossOrigin(origins = "*")
public class HistoriquesTravauxController {

    @Autowired
    private HistoriquesTravauxRepository historiquesTravauxRepository;

    @GetMapping
    public List<HistoriquesTravaux> getAllHistoriquesTravaux() {
        return historiquesTravauxRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<HistoriquesTravaux> getHistoriquesTravauxById(@PathVariable Long id) {
        Optional<HistoriquesTravaux> historiquesTravaux = historiquesTravauxRepository.findById(id);
        if (historiquesTravaux.isPresent()) {
            return ResponseEntity.ok(historiquesTravaux.get());
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public HistoriquesTravaux createHistoriquesTravaux(@RequestBody HistoriquesTravaux historiquesTravaux) {
        return historiquesTravauxRepository.save(historiquesTravaux);
    }

    @PutMapping("/{id}")
    public ResponseEntity<HistoriquesTravaux> updateHistoriquesTravaux(@PathVariable Long id, @RequestBody HistoriquesTravaux historiquesTravauxDetails) {
        Optional<HistoriquesTravaux> optionalHistoriquesTravaux = historiquesTravauxRepository.findById(id);
        if (optionalHistoriquesTravaux.isPresent()) {
            HistoriquesTravaux historiquesTravaux = optionalHistoriquesTravaux.get();
            historiquesTravaux.setTravaux(historiquesTravauxDetails.getTravaux());
            historiquesTravaux.setDateModification(historiquesTravauxDetails.getDateModification());
            historiquesTravaux.setAvancement(historiquesTravauxDetails.getAvancement());
            historiquesTravaux.setCommentaire(historiquesTravauxDetails.getCommentaire());

            HistoriquesTravaux updatedHistoriquesTravaux = historiquesTravauxRepository.save(historiquesTravaux);
            return ResponseEntity.ok(updatedHistoriquesTravaux);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteHistoriquesTravaux(@PathVariable Long id) {
        Optional<HistoriquesTravaux> historiquesTravaux = historiquesTravauxRepository.findById(id);
        if (historiquesTravaux.isPresent()) {
            historiquesTravauxRepository.delete(historiquesTravaux.get());
            return ResponseEntity.noContent().build();
        } else {
            return ResponseEntity.notFound().build();
        }
    }
}