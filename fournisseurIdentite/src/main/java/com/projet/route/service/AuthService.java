package com.projet.route.service;

import com.projet.route.models.ParametreAuth;
import com.projet.route.models.Session;
import com.projet.route.models.Utilisateur;
import com.projet.route.repository.ParametreAuthRepository;
import com.projet.route.repository.SessionRepository;
import com.projet.route.repository.UtilisateurRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private final UtilisateurRepository utilisateurRepository;
    private final SessionRepository sessionRepository;
    private final ParametreAuthRepository parametreAuthRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UtilisateurRepository utilisateurRepository,
                      SessionRepository sessionRepository,
                      ParametreAuthRepository parametreAuthRepository,
                      PasswordEncoder passwordEncoder) {
        this.utilisateurRepository = utilisateurRepository;
        this.sessionRepository = sessionRepository;
        this.parametreAuthRepository = parametreAuthRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public int getMaxLoginAttempts() {
        return Integer.parseInt(getParamValue("limite_tentatives", "3"));
    }

    public int getSessionDurationMinutes() {
        return Integer.parseInt(getParamValue("duree_session_minutes", "60"));
    }

    private String getParamValue(String key, String defaultValue) {
        Optional<ParametreAuth> param = parametreAuthRepository.findByCle(key);
        return param.map(ParametreAuth::getValeur).orElse(defaultValue);
    }

    public boolean isAccountLocked(Utilisateur user) {
        return user.getEstBloque() != null && user.getEstBloque();
    }

    public void recordFailedLoginAttempt(Utilisateur user) {
        int currentAttempts = user.getTentativesEchec() != null ? user.getTentativesEchec() : 0;
        user.setTentativesEchec(currentAttempts + 1);

        if (user.getTentativesEchec() >= getMaxLoginAttempts()) {
            user.setEstBloque(true);
        }

        user.setDateModification(LocalDateTime.now());
        utilisateurRepository.save(user);
    }

    public void resetFailedLoginAttempts(Utilisateur user) {
        user.setTentativesEchec(0);
        user.setEstBloque(false);
        user.setDateModification(LocalDateTime.now());
        utilisateurRepository.save(user);
    }

    public boolean validatePassword(String rawPassword, String encodedPassword) {
        return passwordEncoder.matches(rawPassword, encodedPassword);
    }

    public Session createSession(Utilisateur user) {
        // Désactiver les sessions expirées
        sessionRepository.deactivateExpiredSessions(LocalDateTime.now());

        // Créer nouvelle session
        Session session = new Session();
        session.setUtilisateur(user);
        session.setToken(UUID.randomUUID().toString());
        session.setDateExpiration(LocalDateTime.now().plusMinutes(getSessionDurationMinutes()));
        session.setEstActive(true);

        return sessionRepository.save(session);
    }

    public Optional<Session> validateSession(String token) {
        Optional<Session> session = sessionRepository.findByTokenAndEstActiveTrue(token);
        if (session.isPresent()) {
            if (session.get().getDateExpiration().isBefore(LocalDateTime.now())) {
                session.get().setEstActive(false);
                sessionRepository.save(session.get());
                return Optional.empty();
            }
        }
        return session;
    }

    public void invalidateUserSessions(Long userId) {
        sessionRepository.findByUtilisateurIdUtilisateurAndEstActiveTrue(userId)
            .forEach(session -> {
                session.setEstActive(false);
                sessionRepository.save(session);
            });
    }
}
