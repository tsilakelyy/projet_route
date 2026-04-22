package com.projet.route.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Contrôleur pour la découverte automatique du backend sur le réseau WiFi
 * Ce contrôleur fournit des endpoints permettant aux applications mobiles
 * de détecter automatiquement la présence du backend sur le réseau local
 */
@RestController
@RequestMapping("/api/discovery")
public class NetworkDiscoveryController {

    /**
     * Endpoint de ping pour vérifier la disponibilité du backend
     * Les applications mobiles peuvent utiliser cet endpoint pour
     * vérifier si le backend est accessible sur une adresse IP donnée
     * 
     * @return "pong" si le backend est disponible
     */
    @GetMapping("/ping")
    public String ping() {
        return "pong";
    }
}
