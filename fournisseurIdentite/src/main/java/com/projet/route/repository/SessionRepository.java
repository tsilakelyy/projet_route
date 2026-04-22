package com.projet.route.repository;

import com.projet.route.models.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface SessionRepository extends JpaRepository<Session, Long> {
    Optional<Session> findByTokenAndEstActiveTrue(String token);
    List<Session> findByUtilisateurIdUtilisateurAndEstActiveTrue(Long userId);
    List<Session> findByDateExpirationBeforeAndEstActiveTrue(LocalDateTime now);

    @Modifying
    @Transactional
    @Query("UPDATE Session s SET s.estActive = false WHERE s.dateExpiration < :now")
    int deactivateExpiredSessions(LocalDateTime now);
}