package com.projet.route.models;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "utilisateurs")
public class Utilisateur {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idUtilisateur;

    @ManyToOne
    @JoinColumn(name = "id_role")
    private Role role;

    @Column(unique = true, nullable = false)
    private String nomUtilisateur;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String motDePasse;

    private Boolean estBloque = false;
    private Integer tentativesEchec = 0;
    private LocalDateTime dateCreation = LocalDateTime.now();
    private LocalDateTime dateModification = LocalDateTime.now();
    private String sourceAuth = "local";

    // Getters and setters
    public Long getIdUtilisateur() { return idUtilisateur; }
    public void setIdUtilisateur(Long idUtilisateur) { this.idUtilisateur = idUtilisateur; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public String getNomUtilisateur() { return nomUtilisateur; }
    public void setNomUtilisateur(String nomUtilisateur) { this.nomUtilisateur = nomUtilisateur; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getMotDePasse() { return motDePasse; }
    public void setMotDePasse(String motDePasse) { this.motDePasse = motDePasse; }
    public Boolean getEstBloque() { return estBloque; }
    public void setEstBloque(Boolean estBloque) { this.estBloque = estBloque; }
    public Integer getTentativesEchec() { return tentativesEchec; }
    public void setTentativesEchec(Integer tentativesEchec) { this.tentativesEchec = tentativesEchec; }
    public LocalDateTime getDateCreation() { return dateCreation; }
    public void setDateCreation(LocalDateTime dateCreation) { this.dateCreation = dateCreation; }
    public LocalDateTime getDateModification() { return dateModification; }
    public void setDateModification(LocalDateTime dateModification) { this.dateModification = dateModification; }
    public String getSourceAuth() { return sourceAuth; }
    public void setSourceAuth(String sourceAuth) { this.sourceAuth = sourceAuth; }
}