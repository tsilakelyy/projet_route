package com.projet.route.service;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class PresenceSyncService {

    private static class SyncRequest {
        long id;
        String source;
        String requestedBy;
        LocalDateTime createdAt;
    }

    private final ConcurrentHashMap<String, LocalDateTime> heartbeats = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lastAckByTarget = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong(0);
    private volatile SyncRequest latestSyncRequest;

    public void heartbeat(String clientType, String clientId) {
        String safeType = sanitizeType(clientType);
        String safeId = clientId == null || clientId.isBlank() ? "default" : clientId.trim();
        heartbeats.put(safeType + ":" + safeId, LocalDateTime.now());
    }

    public Map<String, Object> mobileActive(int maxAgeSeconds) {
        LocalDateTime threshold = LocalDateTime.now().minusSeconds(Math.max(5, maxAgeSeconds));
        boolean active = false;
        LocalDateTime lastSeen = null;

        for (Map.Entry<String, LocalDateTime> entry : heartbeats.entrySet()) {
            if (!entry.getKey().startsWith("mobile:")) {
                continue;
            }
            LocalDateTime seenAt = entry.getValue();
            if (lastSeen == null || seenAt.isAfter(lastSeen)) {
                lastSeen = seenAt;
            }
            if (seenAt.isAfter(threshold)) {
                active = true;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("active", active);
        result.put("lastSeen", lastSeen);
        if (lastSeen != null) {
            result.put("secondsSinceLastSeen", Duration.between(lastSeen, LocalDateTime.now()).toSeconds());
        } else {
            result.put("secondsSinceLastSeen", null);
        }
        return result;
    }

    public Map<String, Object> requestSync(String source, String requestedBy) {
        SyncRequest request = new SyncRequest();
        request.id = sequence.incrementAndGet();
        request.source = sanitizeType(source);
        request.requestedBy = requestedBy == null ? "" : requestedBy.trim();
        request.createdAt = LocalDateTime.now();
        latestSyncRequest = request;
        return toMap(request);
    }

    public Map<String, Object> pendingSync(String target) {
        String safeTarget = sanitizeType(target);
        SyncRequest request = latestSyncRequest;
        if (request == null) {
            return Map.of("hasPending", false);
        }

        long ackId = lastAckByTarget.getOrDefault(safeTarget, 0L);
        boolean hasPending = request.id > ackId && !safeTarget.equals(request.source);

        Map<String, Object> result = new HashMap<>();
        result.put("hasPending", hasPending);
        if (hasPending) {
            result.putAll(toMap(request));
        }
        return result;
    }

    public Map<String, Object> ackSync(String target, long requestId) {
        String safeTarget = sanitizeType(target);
        long current = lastAckByTarget.getOrDefault(safeTarget, 0L);
        if (requestId > current) {
            lastAckByTarget.put(safeTarget, requestId);
        }
        return Map.of("ok", true, "target", safeTarget, "acknowledgedRequestId", requestId);
    }

    private static Map<String, Object> toMap(SyncRequest request) {
        Map<String, Object> result = new HashMap<>();
        result.put("requestId", request.id);
        result.put("source", request.source);
        result.put("requestedBy", request.requestedBy);
        result.put("createdAt", request.createdAt);
        return result;
    }

    /**
     * Récupère les informations sur les autres clients connectés
     * @param excludeType Le type de client à exclure (mobile ou web)
     * @param excludeClientId L'ID du client à exclure
     * @return Une map contenant les informations des autres clients
     */
    public Map<String, Object> getOtherClients(String excludeType, String excludeClientId) {
        Map<String, Object> otherClients = new HashMap<>();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime threshold = now.minusSeconds(60); // Considérer comme actif si vu dans les 60 dernières secondes
        
        for (Map.Entry<String, LocalDateTime> entry : heartbeats.entrySet()) {
            String key = entry.getKey();
            String[] parts = key.split(":");
            if (parts.length != 2) continue;
            
            String clientType = parts[0];
            String clientId = parts[1];
            
            // Exclure le client actuel et les types inconnus
            if (excludeType.equals(clientType) && excludeClientId.equals(clientId)) {
                continue;
            }
            if (!"mobile".equals(clientType) && !"web".equals(clientType)) {
                continue;
            }
            
            LocalDateTime seenAt = entry.getValue();
            if (seenAt.isAfter(threshold)) {
                Map<String, Object> clientInfo = new HashMap<>();
                clientInfo.put("type", clientType);
                clientInfo.put("clientId", clientId);
                clientInfo.put("lastSeen", seenAt.toString());
                clientInfo.put("secondsSinceLastSeen", Duration.between(seenAt, now).toSeconds());
                otherClients.put(key, clientInfo);
            }
        }
        
        return otherClients;
    }
    
    private static String sanitizeType(String type) {
        if (type == null || type.isBlank()) {
            return "unknown";
        }
        String value = type.trim().toLowerCase();
        if ("mobile".equals(value) || "web".equals(value)) {
            return value;
        }
        return "unknown";
    }
}

