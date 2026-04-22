package com.projet.route.service;

import com.projet.route.models.AuditLog;
import com.projet.route.repository.AuditLogRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AuditLogService {
    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public AuditLog log(String entityType, String entityId, String action, String actor, String details) {
        AuditLog log = new AuditLog();
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setAction(action);
        log.setActor(actor);
        log.setDetails(details);
        log.setCreatedAt(LocalDateTime.now());
        return auditLogRepository.save(log);
    }

    public List<AuditLog> latest(int limit) {
        List<AuditLog> all = auditLogRepository.findTop100ByOrderByCreatedAtDesc();
        if (all.isEmpty()) {
            log(
                "system",
                "bootstrap",
                "INIT",
                "system",
                "Initialisation du journal d'audit"
            );
            all = auditLogRepository.findTop100ByOrderByCreatedAtDesc();
        }
        if (limit <= 0 || all.size() <= limit) {
            return all;
        }
        return all.subList(0, limit);
    }
}
