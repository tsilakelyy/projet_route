package com.projet.route.models;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "historiques_travaux")
public class HistoriquesTravaux {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_travaux")
    private Travaux travaux;

    @Column(name = "date_modification")
    private LocalDateTime dateModification = LocalDateTime.now();

    @Column(precision = 5, scale = 2)
    private BigDecimal avancement;

    @Column(columnDefinition = "TEXT")
    private String commentaire;

    @Column(name = "firestore_id", unique = true)
    private String firestoreId;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Travaux getTravaux() { return travaux; }
    public void setTravaux(Travaux travaux) { this.travaux = travaux; }

    public LocalDateTime getDateModification() { return dateModification; }
    public void setDateModification(LocalDateTime dateModification) { this.dateModification = dateModification; }

    public BigDecimal getAvancement() { return avancement; }
    public void setAvancement(BigDecimal avancement) { this.avancement = avancement; }

    public String getCommentaire() { return commentaire; }
    public void setCommentaire(String commentaire) { this.commentaire = commentaire; }
    public String getFirestoreId() { return firestoreId; }
    public void setFirestoreId(String firestoreId) { this.firestoreId = firestoreId; }
}