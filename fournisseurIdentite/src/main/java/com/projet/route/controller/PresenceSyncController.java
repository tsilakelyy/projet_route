package com.projet.route.controller;

import com.projet.route.service.PresenceSyncService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/presence")
@CrossOrigin(origins = "*")
public class PresenceSyncController {

    private final PresenceSyncService presenceSyncService;

    public PresenceSyncController(PresenceSyncService presenceSyncService) {
        this.presenceSyncService = presenceSyncService;
    }

    @PostMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(@RequestBody Map<String, Object> body) {
        String clientType = resolveClientType(body);
        String clientId = resolveClientId(body);
        presenceSyncService.heartbeat(clientType, clientId);
        
        // Renvoyer des informations sur les autres clients connectés
        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);
        response.put("clientId", clientId);
        response.put("clientType", clientType);
        
        // Informations sur les autres clients
        Map<String, Object> otherClients = presenceSyncService.getOtherClients(clientType, clientId);
        response.put("otherClients", otherClients);
        
        return ResponseEntity.ok(response);
    }

    private static String resolveClientType(Map<String, Object> body) {
        if (body == null) {
            return "unknown";
        }

        Object directType = body.get("clientType");
        if (directType != null) {
            String value = String.valueOf(directType).trim().toLowerCase();
            if ("mobile".equals(value) || "web".equals(value)) {
                return value;
            }
        }

        Object source = body.get("source");
        if (source != null) {
            String value = String.valueOf(source).trim().toLowerCase();
            if ("mobile".equals(value) || "web".equals(value)) {
                return value;
            }
        }

        // Backward compatibility for older mobile payloads.
        if (body.get("deviceId") != null || body.get("platform") != null || body.get("appVersion") != null) {
            return "mobile";
        }

        return "unknown";
    }

    private static String resolveClientId(Map<String, Object> body) {
        if (body == null) {
            return "default";
        }

        Object clientId = body.get("clientId");
        if (clientId != null && !String.valueOf(clientId).isBlank()) {
            return String.valueOf(clientId).trim();
        }

        Object deviceId = body.get("deviceId");
        if (deviceId != null && !String.valueOf(deviceId).isBlank()) {
            return String.valueOf(deviceId).trim();
        }

        Object userId = body.get("userId");
        if (userId != null && !String.valueOf(userId).isBlank()) {
            return String.valueOf(userId).trim();
        }

        return "default";
    }

    @GetMapping("/web-active")
    public ResponseEntity<?> webActive(@RequestParam(defaultValue = "60") int maxAgeSeconds) {
        // Pour l'instant, nous considérons que le module web est toujours actif
        // si ce endpoint est appelé. Dans une implémentation plus avancée,
        // nous pourrions suivre les heartbeats du module web.
        return ResponseEntity.ok(Map.of(
            "active", true,
            "lastSeen", java.time.LocalDateTime.now(),
            "secondsSinceLastSeen", 0
        ));
    }

    @GetMapping("/mobile-active")
    public ResponseEntity<?> mobileActive(@RequestParam(defaultValue = "60") int maxAgeSeconds) {
        return ResponseEntity.ok(presenceSyncService.mobileActive(maxAgeSeconds));
    }

    @PostMapping("/request-sync")
    public ResponseEntity<?> requestSync(@RequestBody Map<String, Object> body) {
        String source = body.get("source") != null ? String.valueOf(body.get("source")) : "unknown";
        String requestedBy = body.get("requestedBy") != null ? String.valueOf(body.get("requestedBy")) : "";
        return ResponseEntity.ok(presenceSyncService.requestSync(source, requestedBy));
    }

    @GetMapping("/pending-sync")
    public ResponseEntity<?> pendingSync(@RequestParam String target) {
        return ResponseEntity.ok(presenceSyncService.pendingSync(target));
    }

    @PostMapping("/ack-sync")
    public ResponseEntity<?> ackSync(@RequestBody Map<String, Object> body) {
        String target = body.get("target") != null ? String.valueOf(body.get("target")) : "unknown";
        long requestId = body.get("requestId") instanceof Number
            ? ((Number) body.get("requestId")).longValue()
            : Long.parseLong(String.valueOf(body.getOrDefault("requestId", "0")));
        return ResponseEntity.ok(presenceSyncService.ackSync(target, requestId));
    }
}
