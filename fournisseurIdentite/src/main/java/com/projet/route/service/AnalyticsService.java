package com.projet.route.service;

import com.projet.route.models.Signalement;
import com.projet.route.models.Travaux;
import com.projet.route.models.Utilisateur;
import com.projet.route.repository.SignalementRepository;
import com.projet.route.repository.TravauxRepository;
import com.projet.route.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {
    private static final double ANTANANARIVO_CENTER_LAT = -18.8792;
    private static final double ANTANANARIVO_CENTER_LNG = 47.5079;

    private final SignalementRepository signalementRepository;
    private final TravauxRepository travauxRepository;
    private final UtilisateurRepository utilisateurRepository;

    public AnalyticsService(
        SignalementRepository signalementRepository,
        TravauxRepository travauxRepository,
        UtilisateurRepository utilisateurRepository
    ) {
        this.signalementRepository = signalementRepository;
        this.travauxRepository = travauxRepository;
        this.utilisateurRepository = utilisateurRepository;
    }

    public List<Map<String, Object>> criticalityView() {
        List<Signalement> signalements = signalementRepository.findAll();
        return signalements.stream()
            .map(this::computeCriticality)
            .sorted(Comparator.comparingDouble(m -> -toDouble(m.get("score"))))
            .collect(Collectors.toList());
    }

    public Map<String, Object> impactView() {
        List<Signalement> signalements = signalementRepository.findAll();
        List<Travaux> travaux = travauxRepository.findAll();
        Set<String> finishedStatuses = Set.of("termine", "resolu", "resout");

        int total = signalements.size();
        long closed = signalements.stream()
            .filter(s -> finishedStatuses.contains(normalizeStatus(s.getStatut())))
            .count();
        long open = total - closed;

        double totalSurface = signalements.stream()
            .mapToDouble(s -> s.getSurface() != null ? s.getSurface().doubleValue() : 0d)
            .sum();

        double engagedBudget = travaux.stream()
            .mapToDouble(t -> t.getBudget() != null ? t.getBudget().doubleValue() : 0d)
            .sum();

        double budgetPerM2 = totalSurface > 0 ? engagedBudget / totalSurface : 0d;

        LocalDateTime since7Days = LocalDateTime.now().minusDays(7);
        long createdLast7Days = signalements.stream()
            .filter(s -> s.getDateAjoute() != null && s.getDateAjoute().isAfter(since7Days))
            .count();

        long resolvedLast7Days = signalements.stream()
            .filter(s -> s.getDateStatutMaj() != null && s.getDateStatutMaj().isAfter(since7Days))
            .filter(s -> finishedStatuses.contains(normalizeStatus(s.getStatut())))
            .count();

        List<Long> resolutionDays = signalements.stream()
            .filter(s -> finishedStatuses.contains(normalizeStatus(s.getStatut())))
            .filter(s -> s.getDateAjoute() != null && s.getDateStatutMaj() != null)
            .map(s -> Duration.between(s.getDateAjoute(), s.getDateStatutMaj()).toDays())
            .filter(days -> days >= 0)
            .collect(Collectors.toList());

        double avgResolutionDays = resolutionDays.isEmpty()
            ? 0d
            : resolutionDays.stream().mapToLong(Long::longValue).average().orElse(0d);

        Map<String, Long> hotspots = signalements.stream()
            .collect(Collectors.groupingBy(
                s -> s.getLieu() != null ? s.getLieu().getLibelle() : "Non renseigne",
                Collectors.counting()
            ));

        List<Map<String, Object>> topHotspots = hotspots.entrySet().stream()
            .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
            .limit(5)
            .map(e -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("lieu", e.getKey());
                row.put("count", e.getValue());
                return row;
            })
            .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalSignalements", total);
        result.put("openSignalements", open);
        result.put("closedSignalements", closed);
        result.put("totalSurface", round2(totalSurface));
        result.put("engagedBudget", round2(engagedBudget));
        result.put("budgetPerM2", round2(budgetPerM2));
        result.put("averageResolutionDays", round2(avgResolutionDays));
        result.put("createdLast7Days", createdLast7Days);
        result.put("resolvedLast7Days", resolvedLast7Days);
        result.put("blockedUsersCount", utilisateurRepository.findByEstBloqueTrueOrderByDateModificationDesc().size());
        result.put("hotspots", topHotspots);
        return result;
    }

    public List<Map<String, Object>> blockedUsersView() {
        return utilisateurRepository.findByEstBloqueTrueOrderByDateModificationDesc().stream()
            .map(this::blockedUserRow)
            .collect(Collectors.toList());
    }

    private Map<String, Object> blockedUserRow(Utilisateur user) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("idUtilisateur", user.getIdUtilisateur());
        row.put("nomUtilisateur", user.getNomUtilisateur());
        row.put("email", user.getEmail());
        row.put("tentativesEchec", user.getTentativesEchec());
        row.put("dateModification", user.getDateModification());
        return row;
    }

    private Map<String, Object> computeCriticality(Signalement s) {
        double niveau = clamp(s.getNiveau() != null ? s.getNiveau() : 1, 1, 10);
        double dangerFactor = (niveau / 10d) * 35d;

        double surface = s.getSurface() != null ? s.getSurface().doubleValue() : 0d;
        double surfaceFactor = Math.min(20d, surface / 2d);

        double ageDays = 0d;
        if (s.getDateAjoute() != null) {
            ageDays = Math.max(0d, Duration.between(s.getDateAjoute(), LocalDateTime.now()).toHours() / 24d);
        }
        double agingFactor = Math.min(15d, ageDays * 1.5d);

        String normalizedStatus = normalizeStatus(s.getStatut());
        double statusFactor = "nouveau".equals(normalizedStatus) ? 15d : ("en cours".equals(normalizedStatus) ? 8d : 2d);

        double trafficFactor = 0d;
        if (s.getLatitude() != null && s.getLongitude() != null) {
            double distanceKm = haversineKm(
                s.getLatitude().doubleValue(),
                s.getLongitude().doubleValue(),
                ANTANANARIVO_CENTER_LAT,
                ANTANANARIVO_CENTER_LNG
            );
            // Plus proche du centre = plus de trafic estime
            trafficFactor = Math.max(0d, 15d - (distanceKm * 2.2d));
        }

        double sensitiveFactor = 0d;
        String lieuDescription = s.getLieu() != null && s.getLieu().getDescription() != null ? s.getLieu().getDescription().toLowerCase() : "";
        if (lieuDescription.contains("ecole") || lieuDescription.contains("hopital") || lieuDescription.contains("marche")) {
            sensitiveFactor = 10d;
        }

        double score = clamp(dangerFactor + surfaceFactor + agingFactor + statusFactor + trafficFactor + sensitiveFactor, 0, 100);

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("idSignalement", s.getIdSignalement());
        row.put("typeProbleme", s.getTypeProbleme());
        row.put("lieu", s.getLieu() != null ? s.getLieu().getLibelle() : "Non renseigne");
        row.put("description", s.getDescription());
        row.put("statut", s.getStatut());
        row.put("dateAjoute", s.getDateAjoute());
        row.put("score", round2(score));
        row.put("dangerFactor", round2(dangerFactor));
        row.put("surfaceFactor", round2(surfaceFactor));
        row.put("agingFactor", round2(agingFactor));
        row.put("statusFactor", round2(statusFactor));
        row.put("trafficFactor", round2(trafficFactor));
        row.put("sensitiveFactor", round2(sensitiveFactor));
        row.put("priorityLabel", priorityLabel(score));
        return row;
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static double round2(double value) {
        return Math.round(value * 100d) / 100d;
    }

    private static String normalizeStatus(String status) {
        if (status == null) return "nouveau";
        String normalized = status
            .toLowerCase(Locale.ROOT)
            .replace("é", "e")
            .replace("è", "e")
            .replace("ê", "e")
            .trim();
        if ("encours".equals(normalized) || "en cours".equals(normalized)) return "en cours";
        if ("termine".equals(normalized) || "resolu".equals(normalized) || "resout".equals(normalized)) return "termine";
        return "nouveau";
    }

    private static String priorityLabel(double score) {
        if (score >= 75) return "Critique";
        if (score >= 55) return "Haute";
        if (score >= 35) return "Moyenne";
        return "Basse";
    }

    private static double toDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        return 0d;
    }

    private static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double r = 6371d;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2d) * Math.sin(dLat / 2d)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
            * Math.sin(dLon / 2d) * Math.sin(dLon / 2d);
        double c = 2d * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return r * c;
    }
}
