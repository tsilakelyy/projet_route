package com.projet.route.controller;

public class FailedLoginRequest {
    private String email;

    public FailedLoginRequest() {}

    public FailedLoginRequest(String email) {
        this.email = email;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}