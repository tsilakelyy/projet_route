package com.projet.route.controller;

import com.projet.route.service.AnalyticsService;
import com.projet.route.service.AuditLogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
@CrossOrigin(origins = "*")
public class AnalyticsController {
    private final AnalyticsService analyticsService;
    private final AuditLogService auditLogService;

    public AnalyticsController(AnalyticsService analyticsService, AuditLogService auditLogService) {
        this.analyticsService = analyticsService;
        this.auditLogService = auditLogService;
    }

    @GetMapping("/criticality")
    public ResponseEntity<List<Map<String, Object>>> criticality() {
        return ResponseEntity.ok(analyticsService.criticalityView());
    }

    @GetMapping("/audit")
    public ResponseEntity<List<?>> audit(@RequestParam(defaultValue = "60") int limit) {
        return ResponseEntity.ok(auditLogService.latest(limit));
    }

    @GetMapping("/impact")
    public ResponseEntity<Map<String, Object>> impact() {
        return ResponseEntity.ok(analyticsService.impactView());
    }

    @GetMapping("/blocked-users")
    public ResponseEntity<List<Map<String, Object>>> blockedUsers() {
        return ResponseEntity.ok(analyticsService.blockedUsersView());
    }
}
