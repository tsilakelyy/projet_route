package com.projet.route.controller;


import com.projet.route.models.Lieu;
import com.projet.route.services.LieuService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lieux")
public class LieuController {
    
    @Autowired
    private LieuService lieuService;
    
    @GetMapping
    public ResponseEntity<List<Lieu>> getAllLieux() {
        List<Lieu> lieux = lieuService.getAllLieux();
        return new ResponseEntity<>(lieux, HttpStatus.OK);
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<Lieu> getLieuById(@PathVariable Long id) {
        return lieuService.getLieuById(id)
                .map(lieu -> new ResponseEntity<>(lieu, HttpStatus.OK))
                .orElse(new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }
    
    @PostMapping
    public ResponseEntity<Lieu> createLieu(@RequestBody Lieu lieu) {
        Lieu createdLieu = lieuService.createLieu(lieu);
        return new ResponseEntity<>(createdLieu, HttpStatus.CREATED);
    }
    
    @PutMapping("/{id}")
    public ResponseEntity<Lieu> updateLieu(@PathVariable Long id, @RequestBody Lieu lieu) {
        try {
            Lieu updatedLieu = lieuService.updateLieu(id, lieu);
            return new ResponseEntity<>(updatedLieu, HttpStatus.OK);
        } catch (RuntimeException e) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLieu(@PathVariable Long id) {
        lieuService.deleteLieu(id);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }
    
    @GetMapping("/ville/{ville}")
    public ResponseEntity<List<Lieu>> getLieuxByVille(@PathVariable String ville) {
        List<Lieu> lieux = lieuService.getLieuxByVille(ville);
        return new ResponseEntity<>(lieux, HttpStatus.OK);
    }
}
