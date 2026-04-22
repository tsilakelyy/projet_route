package com.projet.route.services;

import com.projet.route.models.Lieu;
import com.projet.route.models.Signalement;
import com.projet.route.repository.SignalementRepository;
import com.projet.route.service.TravauxService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class SignalementService {

    @Autowired
    private SignalementRepository signalementRepository;

    @Autowired
    private LieuService lieuService;

    @Autowired
    private TravauxService travauxService;

    public List<Signalement> getAllSignalements() {
        return signalementRepository.findAll();
    }

    public Optional<Signalement> getSignalementById(Long id) {
        return signalementRepository.findById(id);
    }

    public Signalement createSignalement(Signalement signalement) {
        if (signalement.getLieu() != null && signalement.getLieu().getIdLieux() != null) {
            Optional<Lieu> lieu = lieuService.getLieuById(signalement.getLieu().getIdLieux());
            if (lieu.isEmpty()) {
                throw new RuntimeException("Lieu non trouve avec l'id: " + signalement.getLieu().getIdLieux());
            }
        }

        signalement.setStatut(travauxService.normalizeStatut(signalement.getStatut()));
        signalement.setDateStatutMaj(LocalDateTime.now());
        signalement.setNiveau(clampNiveau(signalement.getNiveau()));
        return signalementRepository.save(signalement);
    }

    public Signalement updateSignalement(Long id, Signalement signalementDetails) {
        Optional<Signalement> optionalSignalement = signalementRepository.findById(id);
        if (optionalSignalement.isPresent()) {
            Signalement signalement = optionalSignalement.get();
            signalement.setSurface(signalementDetails.getSurface());
            signalement.setLatitude(signalementDetails.getLatitude());
            signalement.setLongitude(signalementDetails.getLongitude());
            signalement.setLieu(signalementDetails.getLieu());
            signalement.setTypeProbleme(signalementDetails.getTypeProbleme());
            signalement.setStatut(travauxService.normalizeStatut(signalementDetails.getStatut()));
            signalement.setDescription(signalementDetails.getDescription());
            signalement.setNiveau(clampNiveau(signalementDetails.getNiveau()));
            if (signalementDetails.isPhotosProvided()) {
                signalement.setPhotosEntries(signalementDetails.getPhotosEntries());
            }
            signalement.setDateStatutMaj(LocalDateTime.now());
            return signalementRepository.save(signalement);
        }
        throw new RuntimeException("Signalement non trouve avec l'id: " + id);
    }

    public Signalement updateStatut(Long id, String statut) {
        Optional<Signalement> optionalSignalement = signalementRepository.findById(id);
        if (optionalSignalement.isPresent()) {
            Signalement signalement = optionalSignalement.get();
            signalement.setStatut(travauxService.normalizeStatut(statut));
            signalement.setDateStatutMaj(LocalDateTime.now());
            return signalementRepository.save(signalement);
        }
        throw new RuntimeException("Signalement non trouve avec l'id: " + id);
    }

    public void deleteSignalement(Long id) {
        signalementRepository.deleteById(id);
    }

    public List<Signalement> getSignalementsByUser(String userId) {
        return signalementRepository.findByIdUser(userId);
    }

    public List<Signalement> getSignalementsByStatut(String statut) {
        return signalementRepository.findByStatut(travauxService.normalizeStatut(statut));
    }

    public List<Signalement> getSignalementsByDateRange(LocalDateTime start, LocalDateTime end) {
        return signalementRepository.findByDateAjouteBetween(start, end);
    }

    private int clampNiveau(Integer niveau) {
        if (niveau == null) {
            return 1;
        }
        if (niveau < 1) {
            return 1;
        }
        return Math.min(niveau, 10);
    }
}
