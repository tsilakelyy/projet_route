package com.projet.route.controller;

public class MobileLoginRequest {
    private String email;
    private String nomUtilisateur;
    private String sourceAuth;
    private String firebaseUid;

    public MobileLoginRequest() {}

    public MobileLoginRequest(String email, String nomUtilisateur, String sourceAuth, String firebaseUid) {
        this.email = email;
        this.nomUtilisateur = nomUtilisateur;
        this.sourceAuth = sourceAuth;
        this.firebaseUid = firebaseUid;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getNomUtilisateur() {
        return nomUtilisateur;
    }

    public void setNomUtilisateur(String nomUtilisateur) {
        this.nomUtilisateur = nomUtilisateur;
    }

    public String getSourceAuth() {
        return sourceAuth;
    }

    public void setSourceAuth(String sourceAuth) {
        this.sourceAuth = sourceAuth;
    }

    public String getFirebaseUid() {
        return firebaseUid;
    }

    public void setFirebaseUid(String firebaseUid) {
        this.firebaseUid = firebaseUid;
    }
}
