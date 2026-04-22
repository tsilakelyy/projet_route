package com.projet.route.controller;

import com.projet.route.models.Signalement;
import com.projet.route.repository.SignalementRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/visitors")
@CrossOrigin(origins = "*")
public class VisitorController {
    @Autowired
    private SignalementRepository signalementRepository;

    @GetMapping("/signalements")
    public ResponseEntity<List<Signalement>> getAllSignalements() {
        List<Signalement> signalements = signalementRepository.findAll();
        return ResponseEntity.ok(signalements);
    }
}
