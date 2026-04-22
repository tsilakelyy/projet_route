package com.projet.route.models;

import jakarta.persistence.*;
import java.util.Objects;

@Entity
@Table(name = "lieux")
public class Lieu {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_lieux")
    private Long idLieux;
    
    @Column(nullable = false, length = 50)
    private String libelle;
    
    @Column(length = 50)
    private String ville;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    // Constructeurs
    public Lieu() {}
    
    public Lieu(String libelle, String ville, String description) {
        this.libelle = libelle;
        this.ville = ville;
        this.description = description;
    }
    
    // Getters et Setters
    public Long getIdLieux() {
        return idLieux;
    }
    
    public void setIdLieux(Long idLieux) {
        this.idLieux = idLieux;
    }
    
    public String getLibelle() {
        return libelle;
    }
    
    public void setLibelle(String libelle) {
        this.libelle = libelle;
    }
    
    public String getVille() {
        return ville;
    }
    
    public void setVille(String ville) {
        this.ville = ville;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Lieu lieu = (Lieu) o;
        return Objects.equals(idLieux, lieu.idLieux);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(idLieux);
    }
    
    @Override
    public String toString() {
        return "Lieu{" +
                "idLieux=" + idLieux +
                ", libelle='" + libelle + '\'' +
                ", ville='" + ville + '\'' +
                '}';
    }
}