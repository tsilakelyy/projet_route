package com.projet.route.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Entity
@Table(name = "signalement")
public class Signalement {
    @Transient
    @JsonIgnore
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idSignalement;

    private BigDecimal surface;

    @Column(nullable = false, precision = 15, scale = 6)
    private BigDecimal latitude;

    @Column(nullable = false, precision = 15, scale = 6)
    private BigDecimal longitude;

    @Column(nullable = false)
    private LocalDateTime dateAjoute = LocalDateTime.now();

    @ManyToOne
    @JoinColumn(name = "id_lieux")
    private Lieu lieu;

    @Column(nullable = false)
    private String idUser;

    @Column(name = "type_probleme", columnDefinition = "VARCHAR(50)")
    private String typeProbleme;

    @Column(columnDefinition = "VARCHAR(20) DEFAULT 'nouveau'")
    private String statut = "nouveau";

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Integer niveau = 1;

    @Column(columnDefinition = "TEXT")
    private String photos;

    @Column(name = "photos_json", columnDefinition = "TEXT")
    private String photosJson;

    @Column(name = "date_statut_maj", nullable = false)
    private LocalDateTime dateStatutMaj = LocalDateTime.now();

    @Column(name = "firestore_id", unique = true)
    private String firestoreId;

    @Transient
    @JsonIgnore
    private boolean photosProvided = false;

    public Long getIdSignalement() { return idSignalement; }
    public void setIdSignalement(Long idSignalement) { this.idSignalement = idSignalement; }

    public BigDecimal getSurface() { return surface; }
    public void setSurface(BigDecimal surface) { this.surface = surface; }

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }

    public LocalDateTime getDateAjoute() { return dateAjoute; }
    public void setDateAjoute(LocalDateTime dateAjoute) { this.dateAjoute = dateAjoute; }

    public Lieu getLieu() { return lieu; }
    public void setLieu(Lieu lieu) { this.lieu = lieu; }

    public String getIdUser() { return idUser; }
    public void setIdUser(String idUser) { this.idUser = idUser; }

    public String getTypeProbleme() { return typeProbleme; }
    public void setTypeProbleme(String typeProbleme) { this.typeProbleme = typeProbleme; }

    public String getStatut() { return statut; }
    public void setStatut(String statut) { this.statut = statut; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getNiveau() { return niveau; }
    public void setNiveau(Integer niveau) { this.niveau = niveau; }

    @JsonIgnore
    public String getPhotos() { return photos; }

    @JsonIgnore
    public void setPhotos(String photos) {
        this.photos = photos;
        if (photos == null || photos.isBlank()) {
            this.photosJson = "[]";
            return;
        }
        if (looksLikeJsonArray(photos)) {
            this.photosJson = photos;
            this.photos = toCompactCsv(parseJsonPhotos(photos));
            return;
        }
        this.photosJson = toJson(parseLegacyCsv(photos));
    }

    @JsonIgnore
    public String getPhotosJson() { return photosJson; }

    @JsonIgnore
    public void setPhotosJson(String photosJson) { this.photosJson = photosJson; }

    @JsonProperty("photos")
    public List<PhotoEntry> getPhotosPayload() {
        return resolvePhotos();
    }

    @JsonProperty("photos")
    public void setPhotosPayload(Object photosPayload) {
        photosProvided = true;
        setPhotosEntries(parsePhotosPayload(photosPayload));
    }

    @JsonIgnore
    public List<PhotoEntry> getPhotosEntries() {
        return resolvePhotos();
    }

    @JsonIgnore
    public void setPhotosEntries(List<PhotoEntry> photosEntries) {
        List<PhotoEntry> normalized = normalizeEntries(photosEntries);
        this.photosJson = toJson(normalized);
        this.photos = toCompactCsv(normalized);
    }

    @JsonIgnore
    public boolean isPhotosProvided() {
        return photosProvided;
    }

    public LocalDateTime getDateStatutMaj() { return dateStatutMaj; }
    public void setDateStatutMaj(LocalDateTime dateStatutMaj) { this.dateStatutMaj = dateStatutMaj; }

    public String getFirestoreId() { return firestoreId; }
    public void setFirestoreId(String firestoreId) { this.firestoreId = firestoreId; }

    @PrePersist
    @PreUpdate
    public void applyDefaults() {
        if (niveau == null || niveau < 1) {
            niveau = 1;
        }
        if (niveau > 10) {
            niveau = 10;
        }
        if (statut == null || statut.isBlank()) {
            statut = "nouveau";
        }
        if (dateStatutMaj == null) {
            dateStatutMaj = LocalDateTime.now();
        }
        if ((photosJson == null || photosJson.isBlank()) && photos != null && !photos.isBlank()) {
            setPhotos(photos);
        }
        if ((photos == null || photos.isBlank()) && photosJson != null && !photosJson.isBlank()) {
            photos = toCompactCsv(resolvePhotos());
        }
    }

    private List<PhotoEntry> resolvePhotos() {
        if (photosJson != null && !photosJson.isBlank()) {
            List<PhotoEntry> fromJson = normalizeEntries(parseJsonPhotos(photosJson));
            if (!fromJson.isEmpty()) {
                return fromJson;
            }
        }
        if (photos != null && !photos.isBlank()) {
            return normalizeEntries(parseLegacyCsv(photos));
        }
        return new ArrayList<>();
    }

    private static List<PhotoEntry> parsePhotosPayload(Object photosPayload) {
        List<PhotoEntry> parsed = new ArrayList<>();
        if (photosPayload == null) {
            return parsed;
        }

        if (photosPayload instanceof String value) {
            String trimmed = value.trim();
            if (trimmed.isEmpty()) {
                return parsed;
            }
            if (looksLikeJsonArray(trimmed)) {
                return parseJsonPhotos(trimmed);
            }
            throw new IllegalArgumentException("photos doit etre un tableau JSON: [{\"url\",\"addedBy\",\"addedAt\"}]");
        }

        if (photosPayload instanceof List<?> listValue) {
            for (Object item : listValue) {
                PhotoEntry entry = parseEntry(item);
                if (entry != null) {
                    parsed.add(entry);
                }
            }
            return parsed;
        }

        PhotoEntry entry = parseEntry(photosPayload);
        if (entry != null) {
            parsed.add(entry);
        }
        return parsed;
    }

    private static PhotoEntry parseEntry(Object item) {
        if (item == null) {
            return null;
        }
        if (item instanceof PhotoEntry entry) {
            return entry;
        }
        if (item instanceof String rawUrl) {
            String trimmed = rawUrl.trim();
            if (trimmed.isEmpty()) {
                return null;
            }
            PhotoEntry entry = new PhotoEntry();
            entry.setUrl(trimmed);
            entry.setAddedBy("legacy");
            entry.setAddedAt(null);
            return entry;
        }
        if (item instanceof Map<?, ?> map) {
            Object urlRaw = map.get("url");
            if (urlRaw == null) {
                return null;
            }
            String url = String.valueOf(urlRaw).trim();
            if (url.isEmpty()) {
                return null;
            }
            PhotoEntry entry = new PhotoEntry();
            entry.setUrl(url);
            Object addedByRaw = map.get("addedBy");
            if (addedByRaw != null) {
                entry.setAddedBy(String.valueOf(addedByRaw));
            }
            Object addedAtRaw = map.get("addedAt");
            if (addedAtRaw != null) {
                entry.setAddedAt(String.valueOf(addedAtRaw));
            }
            return entry;
        }
        return null;
    }

    private static List<PhotoEntry> parseLegacyCsv(String csv) {
        List<PhotoEntry> photos = new ArrayList<>();
        for (String value : csv.split(",")) {
            String trimmed = value.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            PhotoEntry entry = new PhotoEntry();
            entry.setUrl(trimmed);
            entry.setAddedBy("legacy");
            entry.setAddedAt(null);
            photos.add(entry);
        }
        return photos;
    }

    private static List<PhotoEntry> parseJsonPhotos(String json) {
        try {
            return OBJECT_MAPPER.readValue(json, new TypeReference<List<PhotoEntry>>() {});
        } catch (Exception ignored) {
            return new ArrayList<>();
        }
    }

    private static List<PhotoEntry> normalizeEntries(List<PhotoEntry> entries) {
        List<PhotoEntry> normalized = new ArrayList<>();
        if (entries == null) {
            return normalized;
        }

        for (PhotoEntry entry : entries) {
            if (entry == null || entry.getUrl() == null) {
                continue;
            }
            String url = entry.getUrl().trim();
            if (url.isEmpty()) {
                continue;
            }
            PhotoEntry clean = new PhotoEntry();
            clean.setUrl(url);
            clean.setAddedBy(entry.getAddedBy() == null || entry.getAddedBy().isBlank() ? "unknown" : entry.getAddedBy().trim());
            clean.setAddedAt(entry.getAddedAt() == null || entry.getAddedAt().isBlank() ? LocalDateTime.now().toString() : entry.getAddedAt().trim());
            normalized.add(clean);
        }
        return normalized;
    }

    private static String toJson(List<PhotoEntry> photosEntries) {
        try {
            return OBJECT_MAPPER.writeValueAsString(photosEntries == null ? new ArrayList<>() : photosEntries);
        } catch (Exception ignored) {
            return "[]";
        }
    }

    private static String toCompactCsv(List<PhotoEntry> photosEntries) {
        if (photosEntries == null || photosEntries.isEmpty()) {
            return "";
        }
        return photosEntries.stream()
            .map(PhotoEntry::getUrl)
            .filter(url -> url != null && !url.isBlank())
            .collect(Collectors.joining(","));
    }

    private static boolean looksLikeJsonArray(String value) {
        String trimmed = value.trim();
        return trimmed.startsWith("[") && trimmed.endsWith("]");
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PhotoEntry {
        private String url;
        private String addedBy;
        private String addedAt;

        public String getUrl() { return url; }
        public void setUrl(String url) { this.url = url; }

        public String getAddedBy() { return addedBy; }
        public void setAddedBy(String addedBy) { this.addedBy = addedBy; }

        public String getAddedAt() { return addedAt; }
        public void setAddedAt(String addedAt) { this.addedAt = addedAt; }
    }
}
