package com.projet.route.models;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "travaux")
public class Travaux {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_entreprise")
    private Entreprise entreprise;

    @ManyToOne
    @JoinColumn(name = "id_signalement")
    private Signalement signalement;

    @Column(precision = 20, scale = 2)
    private BigDecimal budget;

    @Column(name = "date_debut_travaux")
    private LocalDate dateDebutTravaux;

    @Column(name = "date_fin_travaux")
    private LocalDate dateFinTravaux;

    @Column(precision = 5, scale = 2)
    private BigDecimal avancement;

    @Column(name = "firestore_id", unique = true)
    private String firestoreId;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Entreprise getEntreprise() { return entreprise; }
    public void setEntreprise(Entreprise entreprise) { this.entreprise = entreprise; }

    public Signalement getSignalement() { return signalement; }
    public void setSignalement(Signalement signalement) { this.signalement = signalement; }

    public BigDecimal getBudget() { return budget; }
    public void setBudget(BigDecimal budget) { this.budget = budget; }

    public LocalDate getDateDebutTravaux() { return dateDebutTravaux; }
    public void setDateDebutTravaux(LocalDate dateDebutTravaux) { this.dateDebutTravaux = dateDebutTravaux; }

    public LocalDate getDateFinTravaux() { return dateFinTravaux; }
    public void setDateFinTravaux(LocalDate dateFinTravaux) { this.dateFinTravaux = dateFinTravaux; }

    public BigDecimal getAvancement() { return avancement; }
    public void setAvancement(BigDecimal avancement) { this.avancement = avancement; }
    public String getFirestoreId() { return firestoreId; }
    public void setFirestoreId(String firestoreId) { this.firestoreId = firestoreId; }
}
