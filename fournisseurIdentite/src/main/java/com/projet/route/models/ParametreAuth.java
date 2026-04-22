package com.projet.route.models;

import jakarta.persistence.*;

@Entity
@Table(name = "parametres_auth")
public class ParametreAuth {
    @Id
    @Column(length = 100)
    private String cle;

    @Column(nullable = false)
    private String valeur;

    private String description;

    // Getters and setters
    public String getCle() { return cle; }
    public void setCle(String cle) { this.cle = cle; }
    public String getValeur() { return valeur; }
    public void setValeur(String valeur) { this.valeur = valeur; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}