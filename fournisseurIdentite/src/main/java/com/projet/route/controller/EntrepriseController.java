package com.projet.route.controller;

import com.projet.route.models.Entreprise;
import com.projet.route.repository.EntrepriseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/entreprises")
@CrossOrigin(origins = "*")
public class EntrepriseController {
    private final EntrepriseRepository entrepriseRepository;

    @Autowired
    public EntrepriseController(EntrepriseRepository entrepriseRepository) {
        this.entrepriseRepository = entrepriseRepository;
    }

    @GetMapping
    public ResponseEntity<List<Entreprise>> getAllEntreprises() {
        return ResponseEntity.ok(entrepriseRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Entreprise> getEntrepriseById(@PathVariable Long id) {
        return ResponseEntity.ok(entrepriseRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Entreprise non trouvée avec l'id: " + id)));
    }

    @PostMapping
    public ResponseEntity<Entreprise> createEntreprise(@RequestBody Entreprise entreprise) {
        Entreprise savedEntreprise = entrepriseRepository.save(entreprise);
        return ResponseEntity.ok(savedEntreprise);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Entreprise> updateEntreprise(@PathVariable Long id, @RequestBody Entreprise entreprise) {
        if (!entrepriseRepository.existsById(id)) {
            throw new RuntimeException("Entreprise non trouvée avec l'id: " + id);
        }
        entreprise.setIdEntreprise(id);
        return ResponseEntity.ok(entrepriseRepository.save(entreprise));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteEntreprise(@PathVariable Long id) {
        if (!entrepriseRepository.existsById(id)) {
            throw new RuntimeException("Entreprise non trouvée avec l'id: " + id);
        }
        entrepriseRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
