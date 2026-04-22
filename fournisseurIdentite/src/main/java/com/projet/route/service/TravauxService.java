package com.projet.route.service;

import com.projet.route.models.Entreprise;
import com.projet.route.models.HistoriquesTravaux;
import com.projet.route.models.ParametreAuth;
import com.projet.route.models.Signalement;
import com.projet.route.models.Travaux;
import com.projet.route.repository.EntrepriseRepository;
import com.projet.route.repository.HistoriquesTravauxRepository;
import com.projet.route.repository.ParametreAuthRepository;
import com.projet.route.repository.SignalementRepository;
import com.projet.route.repository.TravauxRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@Transactional
public class TravauxService {

    private static final BigDecimal DEFAULT_PRIX_PAR_M2 = new BigDecimal("100000");

    @Autowired
    private TravauxRepository travauxRepository;

    @Autowired
    private HistoriquesTravauxRepository historiquesTravauxRepository;

    @Autowired
    private SignalementRepository signalementRepository;

    @Autowired
    private EntrepriseRepository entrepriseRepository;

    @Autowired
    private ParametreAuthRepository parametreAuthRepository;

    public List<Travaux> getAllTravaux() {
        return travauxRepository.findAll();
    }

    public List<Travaux> getTravauxEnCours() {
        return travauxRepository.findByAvancementLessThan(new BigDecimal("100.00"));
    }

    public Optional<Travaux> getTravauxById(Long id) {
        return travauxRepository.findById(id);
    }

    public Optional<Travaux> getTravauxBySignalementId(Long signalementId) {
        return travauxRepository.findBySignalementIdSignalement(signalementId);
    }

    public Travaux createTravaux(Travaux travaux) {
        Signalement signalement = resolveSignalement(travaux.getSignalement());
        Entreprise entreprise = resolveEntreprise(travaux.getEntreprise());

        travaux.setSignalement(signalement);
        travaux.setEntreprise(entreprise);
        travaux.setBudget(calculateBudgetForSignalement(signalement));

        String statutNormalise = normalizeStatut(signalement.getStatut());
        signalement.setStatut(statutNormalise);
        signalement.setDateStatutMaj(LocalDateTime.now());

        applyStatusLifecycle(travaux, statutNormalise);

        Travaux savedTravaux = travauxRepository.save(travaux);
        signalementRepository.save(signalement);

        createHistorique(savedTravaux, avancementFromStatut(statutNormalise), commentaireFromStatut(statutNormalise));
        return savedTravaux;
    }

    public Travaux updateTravaux(Long id, Travaux travauxDetails) {
        Travaux travaux = travauxRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Travaux non trouves avec l'id: " + id));

        Signalement signalement = travaux.getSignalement();
        if (travauxDetails.getSignalement() != null && travauxDetails.getSignalement().getIdSignalement() != null) {
            signalement = resolveSignalement(travauxDetails.getSignalement());
            travaux.setSignalement(signalement);
        }

        if (travauxDetails.getEntreprise() != null) {
            travaux.setEntreprise(resolveEntreprise(travauxDetails.getEntreprise()));
        }

        if (travauxDetails.getDateDebutTravaux() != null) {
            travaux.setDateDebutTravaux(travauxDetails.getDateDebutTravaux());
        }
        if (travauxDetails.getDateFinTravaux() != null) {
            travaux.setDateFinTravaux(travauxDetails.getDateFinTravaux());
        }

        String statutNormalise = normalizeStatut(signalement.getStatut());
        signalement.setStatut(statutNormalise);
        signalement.setDateStatutMaj(LocalDateTime.now());

        travaux.setBudget(calculateBudgetForSignalement(signalement));
        applyStatusLifecycle(travaux, statutNormalise);

        Travaux updatedTravaux = travauxRepository.save(travaux);
        signalementRepository.save(signalement);

        createHistorique(updatedTravaux, avancementFromStatut(statutNormalise), commentaireFromStatut(statutNormalise));
        return updatedTravaux;
    }

    public void deleteTravaux(Long id) {
        travauxRepository.deleteById(id);
    }

    public void updateAvancementBasedOnStatut(Long signalementId, String statut) {
        Signalement signalement = signalementRepository.findById(signalementId).orElse(null);
        if (signalement == null) {
            return;
        }

        String statutNormalise = normalizeStatut(statut);
        signalement.setStatut(statutNormalise);
        signalement.setDateStatutMaj(LocalDateTime.now());
        signalementRepository.save(signalement);

        Travaux travaux = travauxRepository.findBySignalement(signalement).orElseGet(() -> {
            Travaux created = new Travaux();
            created.setSignalement(signalement);
            return created;
        });

        travaux.setBudget(calculateBudgetForSignalement(signalement));
        applyStatusLifecycle(travaux, statutNormalise);
        Travaux savedTravaux = travauxRepository.save(travaux);

        createHistorique(savedTravaux, avancementFromStatut(statutNormalise), commentaireFromStatut(statutNormalise));
    }

    public BigDecimal calculateBudgetForSignalement(Signalement signalement) {
        if (signalement == null || signalement.getSurface() == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal surface = signalement.getSurface();
        if (surface.compareTo(BigDecimal.ZERO) < 0) {
            surface = BigDecimal.ZERO;
        }

        int niveau = signalement.getNiveau() != null ? signalement.getNiveau() : 1;
        if (niveau < 1) {
            niveau = 1;
        }
        if (niveau > 10) {
            niveau = 10;
        }

        return resolvePrixParM2()
            .multiply(surface)
            .multiply(BigDecimal.valueOf(niveau))
            .setScale(2, RoundingMode.HALF_UP);
    }

    public String normalizeStatut(String statut) {
        if (statut == null || statut.isBlank()) {
            return "nouveau";
        }

        String normalized = Normalizer.normalize(statut, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .toLowerCase(Locale.ROOT)
            .trim();

        if (normalized.equals("nouveau") || normalized.equals("non traite") || normalized.equals("non-traite")) {
            return "nouveau";
        }

        if (normalized.equals("en cours") || normalized.equals("encours")) {
            return "en cours";
        }

        if (normalized.equals("termine") || normalized.equals("resolu") || normalized.equals("resout")) {
            return "termine";
        }

        return "nouveau";
    }

    public BigDecimal avancementFromStatut(String statut) {
        String normalized = normalizeStatut(statut);
        switch (normalized) {
            case "en cours":
                return new BigDecimal("50.00");
            case "termine":
                return new BigDecimal("100.00");
            default:
                return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
    }

    public long calculateAverageDelayDays() {
        List<Travaux> allTravaux = travauxRepository.findAll();
        long totalDays = 0;
        int totalCompleted = 0;

        for (Travaux travaux : allTravaux) {
            if (travaux.getDateDebutTravaux() == null || travaux.getDateFinTravaux() == null) {
                continue;
            }
            if (travaux.getAvancement() == null || travaux.getAvancement().compareTo(new BigDecimal("100.00")) < 0) {
                continue;
            }

            totalDays += ChronoUnit.DAYS.between(travaux.getDateDebutTravaux(), travaux.getDateFinTravaux());
            totalCompleted += 1;
        }

        if (totalCompleted == 0) {
            return 0;
        }

        return Math.round((double) totalDays / totalCompleted);
    }

    public Map<String, Object> calculateDelayStats() {
        List<Travaux> allTravaux = travauxRepository.findAll();
        List<Long> delays = new ArrayList<>();

        for (Travaux travaux : allTravaux) {
            if (travaux.getDateDebutTravaux() == null || travaux.getDateFinTravaux() == null) {
                continue;
            }
            if (travaux.getAvancement() == null || travaux.getAvancement().compareTo(new BigDecimal("100.00")) < 0) {
                continue;
            }

            long days = ChronoUnit.DAYS.between(travaux.getDateDebutTravaux(), travaux.getDateFinTravaux());
            if (days >= 0) {
                delays.add(days);
            }
        }

        Map<String, Object> stats = new HashMap<>();
        if (delays.isEmpty()) {
            stats.put("completedCount", 0);
            stats.put("averageDelayDays", 0d);
            stats.put("minDelayDays", 0L);
            stats.put("maxDelayDays", 0L);
            return stats;
        }

        long totalDays = 0;
        for (Long delay : delays) {
            totalDays += delay;
        }

        double average = (double) totalDays / delays.size();
        double roundedAverage = Math.round(average * 100.0) / 100.0;

        stats.put("completedCount", delays.size());
        stats.put("averageDelayDays", roundedAverage);
        stats.put("minDelayDays", Collections.min(delays));
        stats.put("maxDelayDays", Collections.max(delays));
        return stats;
    }

    private BigDecimal resolvePrixParM2() {
        Optional<ParametreAuth> param = parametreAuthRepository.findByCle("prix_par_m2");
        if (param.isEmpty()) {
            return DEFAULT_PRIX_PAR_M2;
        }

        try {
            BigDecimal value = new BigDecimal(param.get().getValeur());
            return value.compareTo(BigDecimal.ZERO) > 0 ? value : DEFAULT_PRIX_PAR_M2;
        } catch (Exception ignored) {
            return DEFAULT_PRIX_PAR_M2;
        }
    }

    private String commentaireFromStatut(String statut) {
        String normalized = normalizeStatut(statut);
        switch (normalized) {
            case "en cours":
                return "Travaux en cours";
            case "termine":
                return "Travaux termines";
            default:
                return "Travaux non demarres";
        }
    }

    private void applyStatusLifecycle(Travaux travaux, String statutNormalise) {
        BigDecimal avancement = avancementFromStatut(statutNormalise);
        travaux.setAvancement(avancement);

        LocalDate today = LocalDate.now();
        if (statutNormalise.equals("en cours") && travaux.getDateDebutTravaux() == null) {
            travaux.setDateDebutTravaux(today);
        }

        if (statutNormalise.equals("termine")) {
            if (travaux.getDateDebutTravaux() == null) {
                travaux.setDateDebutTravaux(today);
            }
            if (travaux.getDateFinTravaux() == null) {
                travaux.setDateFinTravaux(today);
            }
        }

        if (statutNormalise.equals("nouveau")) {
            travaux.setDateFinTravaux(null);
        }
    }

    private void createHistorique(Travaux travaux, BigDecimal avancement, String commentaire) {
        HistoriquesTravaux historique = new HistoriquesTravaux();
        historique.setTravaux(travaux);
        historique.setAvancement(avancement);
        historique.setCommentaire(commentaire);
        historique.setDateModification(LocalDateTime.now());
        historiquesTravauxRepository.save(historique);
    }

    private Signalement resolveSignalement(Signalement signalementRef) {
        if (signalementRef == null || signalementRef.getIdSignalement() == null) {
            throw new RuntimeException("Signalement obligatoire pour les travaux");
        }

        return signalementRepository.findById(signalementRef.getIdSignalement())
            .orElseThrow(() -> new RuntimeException("Signalement non trouve avec l'id: " + signalementRef.getIdSignalement()));
    }

    private Entreprise resolveEntreprise(Entreprise entrepriseRef) {
        if (entrepriseRef == null || entrepriseRef.getIdEntreprise() == null) {
            return null;
        }

        return entrepriseRepository.findById(entrepriseRef.getIdEntreprise())
            .orElseThrow(() -> new RuntimeException("Entreprise non trouvee avec l'id: " + entrepriseRef.getIdEntreprise()));
    }
}
