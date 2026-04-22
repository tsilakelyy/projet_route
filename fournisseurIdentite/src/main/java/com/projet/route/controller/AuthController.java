package com.projet.route.controller;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.UserRecord;
import com.projet.route.models.ParametreAuth;
import com.projet.route.models.Role;
import com.projet.route.models.Session;
import com.projet.route.models.Utilisateur;
import com.projet.route.repository.ParametreAuthRepository;
import com.projet.route.repository.RoleRepository;
import com.projet.route.repository.UtilisateurRepository;
import com.projet.route.service.AuditLogService;
import com.projet.route.service.AuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    private final UtilisateurRepository utilisateurRepository;
    private final RoleRepository roleRepository;
    private final AuthService authService;
    private final ParametreAuthRepository parametreAuthRepository;
    private final AuditLogService auditLogService;
    private final HttpClient firebaseHttpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(6)).build();

    @Value("${firebase.web-api-key:${FIREBASE_WEB_API_KEY:AIzaSyAgooGs6XiDVqu5FhDiBHC5Actg7n_CzP0}}")
    private String firebaseWebApiKey;

    public AuthController(UtilisateurRepository utilisateurRepository,
                         RoleRepository roleRepository,
                         AuthService authService,
                         ParametreAuthRepository parametreAuthRepository,
                         AuditLogService auditLogService) {
        this.utilisateurRepository = utilisateurRepository;
        this.roleRepository = roleRepository;
        this.authService = authService;
        this.parametreAuthRepository = parametreAuthRepository;
        this.auditLogService = auditLogService;
    }

    @GetMapping("/users")
    public ResponseEntity<?> getUsers() {
        return ResponseEntity.ok(utilisateurRepository.findAll());
    }
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        String email = request.getEmail() == null ? "" : request.getEmail().trim();
        String password = request.getPassword() == null ? "" : request.getPassword();
        logger.info("Login attempt for email: {}", email);

        if (email.isBlank() || password.isBlank()) {
            return ResponseEntity.badRequest().body("Email and password are required");
        }

        Optional<Utilisateur> userOpt = utilisateurRepository.findByEmail(email);
        Utilisateur user = userOpt.orElse(null);

        if (user != null && authService.isAccountLocked(user)) {
            logger.warn("Account blocked for email: {}", email);
            return ResponseEntity.status(403).body("Account blocked due to too many failed attempts");
        }

        try {
            boolean authenticated = false;

            if (user != null && authService.validatePassword(password, user.getMotDePasse())) {
                authenticated = true;
            } else {
                FirebaseRestSignInResult firebaseSignIn = verifyFirebaseSignIn(email, password);
                if (!firebaseSignIn.success) {
                    if (user != null) {
                        logger.warn("Invalid password for email: {}", email);
                        authService.recordFailedLoginAttempt(user);
                    } else {
                        logger.warn("User not found locally and Firebase auth failed for email: {}", email);
                    }
                    return ResponseEntity.status(401).body("Invalid credentials");
                }

                if (user == null) {
                    Role defaultRole = roleRepository.findByNom("UTILISATEUR");
                    if (defaultRole == null) {
                        return ResponseEntity.status(500).body("Role UTILISATEUR not found");
                    }
                    user = new Utilisateur();
                    user.setNomUtilisateur(resolveFirebaseDisplayName(firebaseSignIn.idToken, email));
                    user.setEmail(email);
                    user.setRole(defaultRole);
                    user.setTentativesEchec(0);
                    user.setEstBloque(false);
                }

                user.setSourceAuth("firebase");
                user.setMotDePasse(password);
                user.setDateModification(LocalDateTime.now());
                user = utilisateurRepository.save(user);
                authenticated = true;
            }

            if (!authenticated || user == null) {
                return ResponseEntity.status(401).body("Invalid credentials");
            }

            String roleName = user.getRole() != null ? user.getRole().getNom() : "";
            if (!"MANAGER".equalsIgnoreCase(roleName)) {
                logger.warn("Login rejected for email {}: role {} cannot access manager dashboard", email, roleName);
                return ResponseEntity.status(403).body("Acces refuse: compte manager requis");
            }

            logger.info("Authentication successful for email: {}", email);
            authService.resetFailedLoginAttempts(user);

            Session session = authService.createSession(user);

            LoginResponse response = new LoginResponse();
            response.setUser(user);
            response.setToken(session.getToken());
            response.setExpiresAt(session.getDateExpiration());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Login failed for email: {} with error: {}", email, e.getMessage());
            if (user != null) {
                authService.recordFailedLoginAttempt(user);
            }
            return ResponseEntity.status(401).body("Invalid credentials");
        }
    }
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (utilisateurRepository.findByEmail(request.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body("Email already exists");
        }
        if (!isFirebaseCompatiblePassword(request.getPassword())) {
            return ResponseEntity.badRequest().body("Password must contain at least 6 characters");
        }
        Role role = roleRepository.findByNom("UTILISATEUR");
        if (role == null) {
            return ResponseEntity.badRequest().body("Role not found");
        }
        Utilisateur user = new Utilisateur();
        user.setNomUtilisateur(request.getNomUtilisateur());
        user.setEmail(request.getEmail());
        user.setMotDePasse(request.getPassword()); // Le mot de passe sera encodÃ© lors de la sauvegarde
        user.setRole(role);
        utilisateurRepository.save(user);
        return ResponseEntity.ok("User registered successfully");
    }

    // Legacy endpoint kept for backward compatibility. Primary auth is local PostgreSQL.
    @PostMapping("/firebase-login")
    public ResponseEntity<?> firebaseLogin(@RequestBody FirebaseLoginRequest request) {
        try {
            com.google.firebase.auth.FirebaseToken decodedToken = com.google.firebase.auth.FirebaseAuth.getInstance().verifyIdToken(request.getToken());
            String uid = decodedToken.getUid();
            String email = decodedToken.getEmail();

            // Chercher l'utilisateur local
            Utilisateur user = utilisateurRepository.findByEmail(email).orElse(null);
            if (user != null && authService.isAccountLocked(user)) {
                return ResponseEntity.status(403).body("Account blocked due to too many failed attempts");
            }

            // CrÃ©er si inexistant
            if (user == null) {
                Role role = roleRepository.findByNom("UTILISATEUR");
                user = new Utilisateur();
                user.setNomUtilisateur(decodedToken.getName() != null ? decodedToken.getName() : uid);
                user.setEmail(email);
                user.setMotDePasse("firebase");
                user.setRole(role);
                user.setSourceAuth("firebase");
                utilisateurRepository.save(user);
            } else {
                // Reset tentatives on success
                authService.resetFailedLoginAttempts(user);
            }

            // CrÃ©er une session
            Session session = authService.createSession(user);

            FirebaseLoginResponse response = new FirebaseLoginResponse();
            response.setUser(user);
            response.setToken(session.getToken());
            response.setExpiresAt(session.getDateExpiration());

            return ResponseEntity.ok(response);
        } catch (com.google.firebase.auth.FirebaseAuthException e) {
            // Extract email from invalid token
            String email = extractEmailFromToken(request.getToken());
            if (email != null) {
                Utilisateur user = utilisateurRepository.findByEmail(email).orElse(null);
                
                // CrÃ©er l'utilisateur s'il n'existe pas encore
                if (user == null) {
                    Role role = roleRepository.findByNom("UTILISATEUR");
                    user = new Utilisateur();
                    user.setNomUtilisateur("Firebase User"); // Nom temporaire
                    user.setEmail(email);
                    user.setMotDePasse("firebase");
                    user.setRole(role);
                    user.setSourceAuth("firebase");
                    user.setTentativesEchec(0); // Initialiser Ã  0
                    utilisateurRepository.save(user);
                }
                
                // Compter la tentative Ã©chouÃ©e
                int tentatives = user.getTentativesEchec() != null ? user.getTentativesEchec() : 0;
                tentatives += 1;
                user.setTentativesEchec(tentatives);
                
                if (tentatives >= authService.getMaxLoginAttempts()) {
                    user.setEstBloque(true);
                }
                
                user.setDateModification(LocalDateTime.now());
                utilisateurRepository.save(user);
            }
            return ResponseEntity.status(401).body("Invalid Firebase token: " + e.getMessage());
        }
    }

    @PostMapping("/report-failed-login")
    public ResponseEntity<?> reportFailedLogin(@RequestBody FailedLoginRequest request) {
        try {
            Optional<Utilisateur> userOpt = utilisateurRepository.findByEmail(request.getEmail());
            Utilisateur user;
            
            if (userOpt.isEmpty()) {
                // CrÃ©er l'utilisateur s'il n'existe pas
                Role role = roleRepository.findByNom("UTILISATEUR");
                user = new Utilisateur();
                user.setNomUtilisateur("Mobile User"); // Nom temporaire
                user.setEmail(request.getEmail());
                user.setMotDePasse("mobile");
                user.setRole(role);
                user.setSourceAuth("mobile");
                user.setTentativesEchec(0);
                utilisateurRepository.save(user);
            } else {
                user = userOpt.get();
            }
            
            // VÃ©rifier si le compte est dÃ©jÃ  bloquÃ©
            if (authService.isAccountLocked(user)) {
                Map<String, Object> response = new HashMap<>();
                response.put("blocked", true);
                response.put("message", "Account already blocked");
                return ResponseEntity.ok(response);
            }
            
            // Compter la tentative Ã©chouÃ©e
            authService.recordFailedLoginAttempt(user);
            
            // VÃ©rifier si le compte doit Ãªtre bloquÃ©
            boolean isBlocked = authService.isAccountLocked(user);
            if (isBlocked) {
                auditLogService.log(
                    "utilisateur",
                    String.valueOf(user.getIdUtilisateur()),
                    "LOCKED",
                    user.getEmail(),
                    "Compte bloque apres tentatives de connexion echouees"
                );
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("blocked", isBlocked);
            response.put("attempts", user.getTentativesEchec());
            response.put("maxAttempts", authService.getMaxLoginAttempts());
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error reporting failed login for email: {}", request.getEmail(), e);
            return ResponseEntity.status(500).body("Internal server error");
        }
    }

    @PostMapping("/mobile-login")
    public ResponseEntity<?> mobileLogin(@RequestBody MobileLoginRequest request) {
        logger.info("Mobile login request received for email: {}", request.getEmail());
        try {
            Optional<Utilisateur> userOpt = utilisateurRepository.findByEmail(request.getEmail());
            if (userOpt.isEmpty()) {
                logger.warn("Mobile login rejected: local user not found for email {}", request.getEmail());
                return ResponseEntity.status(403).body("Compte mobile non autorise. Creation requise via manager web.");
            }

            Utilisateur user = userOpt.get();
            if (authService.isAccountLocked(user)) {
                logger.warn("Mobile login rejected: account blocked for email {}", request.getEmail());
                return ResponseEntity.status(403).body("Compte bloque");
            }

            if (request.getNomUtilisateur() != null && !request.getNomUtilisateur().isBlank()
                && !request.getNomUtilisateur().equals(user.getNomUtilisateur())) {
                user.setNomUtilisateur(request.getNomUtilisateur());
            }
            if (request.getSourceAuth() != null && !request.getSourceAuth().isBlank()) {
                user.setSourceAuth(request.getSourceAuth());
            }

            user.setDateModification(LocalDateTime.now());
            utilisateurRepository.save(user);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Mobile user registered/updated successfully");
            response.put("backendUserId", user.getIdUtilisateur());
            response.put("email", user.getEmail());
            response.put("nomUtilisateur", user.getNomUtilisateur());
            response.put("sourceAuth", user.getSourceAuth());
            response.put("role", user.getRole() != null ? user.getRole().getNom() : null);
            if (request.getFirebaseUid() != null && !request.getFirebaseUid().isBlank()) {
                response.put("firebaseUid", request.getFirebaseUid());
            }

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error registering mobile user for email: {}", request.getEmail(), e);
            return ResponseEntity.status(500).body("Internal server error");
        }
    }

    @PostMapping("/mobile-bootstrap")
    public ResponseEntity<?> mobileBootstrap() {
        Map<String, Object> response = new HashMap<>();
        List<String> errors = new ArrayList<>();
        int totalCandidates = 0;
        int synced = 0;
        int skipped = 0;

        for (Utilisateur user : utilisateurRepository.findAll()) {
            if (user.getRole() != null && "MANAGER".equalsIgnoreCase(user.getRole().getNom())) {
                skipped++;
                continue;
            }
            String email = user.getEmail();
            String password = user.getMotDePasse();
            if (email == null || email.isBlank() || password == null || password.isBlank()) {
                skipped++;
                continue;
            }
            if (!isFirebaseCompatiblePassword(password)) {
                skipped++;
                errors.add(email + ":weak_password");
                continue;
            }

            totalCandidates++;
            boolean ok = syncFirebaseUserCreate(email, password, user.getNomUtilisateur());
            if (ok) {
                synced++;
            } else {
                errors.add(email);
            }
        }

        response.put("backendReachable", true);
        response.put("firebaseAdminAvailable", isFirebaseAdminAvailable());
        response.put("firebaseRestAvailable", firebaseWebApiKey != null && !firebaseWebApiKey.isBlank());
        response.put("totalCandidates", totalCandidates);
        response.put("synced", synced);
        response.put("skipped", skipped);
        response.put("errors", errors);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/test")
    public ResponseEntity<?> test() {
        return ResponseEntity.ok("Test endpoint works");
    }

    @PostMapping("/check-blocked")
    public ResponseEntity<?> checkAccountBlocked(@RequestBody FailedLoginRequest request) {
        logger.info("Check blocked request received for email: {}", request.getEmail());
        try {
            Optional<Utilisateur> userOpt = utilisateurRepository.findByEmail(request.getEmail());
            
            if (userOpt.isEmpty()) {
                // Si l'utilisateur n'existe pas encore, il n'est pas bloquÃ©
                logger.info("User {} not found in database, returning not blocked", request.getEmail());
                Map<String, Object> response = new HashMap<>();
                response.put("blocked", false);
                return ResponseEntity.ok(response);
            }
            
            Utilisateur user = userOpt.get();
            boolean isBlocked = authService.isAccountLocked(user);
            logger.info("User {} blocked status: {}", request.getEmail(), isBlocked);
            
            Map<String, Object> response = new HashMap<>();
            response.put("blocked", isBlocked);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error checking account blocked status for email: {}", request.getEmail(), e);
            return ResponseEntity.status(500).body("Internal server error");
        }
    }

    @PostMapping("/reset-lock/{userId}")
    public ResponseEntity<?> resetUserLock(@PathVariable Long userId) {
        try {
            Optional<Utilisateur> userOpt = utilisateurRepository.findById(userId);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Utilisateur user = userOpt.get();
            authService.resetFailedLoginAttempts(user);
            authService.invalidateUserSessions(userId); // Invalider les sessions existantes
            auditLogService.log(
                "utilisateur",
                String.valueOf(user.getIdUtilisateur()),
                "UNLOCKED",
                user.getEmail(),
                "Compte debloque par gestionnaire"
            );

            logger.info("Account lock reset for user: {}", user.getEmail());
            return ResponseEntity.ok("Account lock reset successfully");

        } catch (Exception e) {
            logger.error("Error resetting lock for user ID: {}", userId, e);
            return ResponseEntity.status(500).body("Internal server error");
        }
    }

    @GetMapping("/params")
    public ResponseEntity<?> getAuthParams() {
        ensureSystemParams();
        return ResponseEntity.ok(parametreAuthRepository.findAll());
    }

    @PutMapping("/params/{cle}")
    public ResponseEntity<?> updateAuthParam(@PathVariable String cle, @RequestBody ParamUpdateRequest request) {
        Optional<ParametreAuth> paramOpt = parametreAuthRepository.findByCle(cle);
        ParametreAuth param;
        if (paramOpt.isEmpty()) {
            param = new ParametreAuth();
            param.setCle(cle);
            param.setDescription("Parametre cree automatiquement");
        } else {
            param = paramOpt.get();
        }
        param.setValeur(request.getValeur());
        parametreAuthRepository.save(param);

        logger.info("Auth parameter {} updated to: {}", cle, request.getValeur());
        return ResponseEntity.ok("Parameter updated successfully");
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader("Authorization") String token) {
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
            Optional<Session> session = authService.validateSession(token);
            if (session.isPresent()) {
                session.get().setEstActive(false);
                authService.invalidateUserSessions(session.get().getUtilisateur().getIdUtilisateur());
            }
        }
        return ResponseEntity.ok("Logged out successfully");
    }

    // Legacy endpoint kept for backward compatibility. Primary auth is local PostgreSQL.
    @PostMapping("/firebase-register")
    public ResponseEntity<?> firebaseRegister(@RequestBody FirebaseLoginRequest request) {
        try {
            com.google.firebase.auth.FirebaseToken decodedToken = com.google.firebase.auth.FirebaseAuth.getInstance().verifyIdToken(request.getToken());
            String uid = decodedToken.getUid();
            String email = decodedToken.getEmail();

            if (utilisateurRepository.findByEmail(email).isPresent()) {
                return ResponseEntity.badRequest().body("User already exists");
            }

            Role role = roleRepository.findByNom("UTILISATEUR");
            Utilisateur user = new Utilisateur();
            user.setNomUtilisateur(decodedToken.getName() != null ? decodedToken.getName() : uid);
            user.setEmail(email);
            user.setMotDePasse("firebase");
            user.setRole(role);
            user.setSourceAuth("firebase");
            utilisateurRepository.save(user);

            return ResponseEntity.ok("Firebase register successful for " + email);
        } catch (com.google.firebase.auth.FirebaseAuthException e) {
            return ResponseEntity.status(401).body("Invalid Firebase token: " + e.getMessage());
        }
    }

    @PostMapping("/users")
    public ResponseEntity<?> createUser(@RequestBody RegisterRequest request) {
        if (utilisateurRepository.findByEmail(request.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body("Email already exists");
        }
        if (!isFirebaseCompatiblePassword(request.getPassword())) {
            return ResponseEntity.badRequest().body("Password must contain at least 6 characters");
        }
        String roleName = normalizeRoleName(request.getRole(), "UTILISATEUR");
        if (roleName == null) {
            return ResponseEntity.badRequest().body("Role must be MANAGER or UTILISATEUR");
        }
        Role role = roleRepository.findByNom(roleName);
        if (role == null) {
            return ResponseEntity.badRequest().body("Role not found: " + roleName);
        }
        Utilisateur user = new Utilisateur();
        user.setNomUtilisateur(request.getNomUtilisateur());
        user.setEmail(request.getEmail());
        user.setMotDePasse(request.getPassword());
        user.setRole(role);
        utilisateurRepository.save(user);
        syncFirebaseUserCreate(request.getEmail(), request.getPassword(), request.getNomUtilisateur());
        return ResponseEntity.ok("User created successfully");
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody UpdateUserRequest request) {
        Optional<Utilisateur> optUser = utilisateurRepository.findById(id);
        if (optUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        // Check if email is already used by another user
        Optional<Utilisateur> existingUser = utilisateurRepository.findByEmail(request.getEmail());
        if (existingUser.isPresent() && !existingUser.get().getIdUtilisateur().equals(id)) {
            return ResponseEntity.badRequest().body("Email already exists");
        }
        Utilisateur user = optUser.get();
        String previousEmail = user.getEmail();
        user.setNomUtilisateur(request.getNomUtilisateur());
        user.setEmail(request.getEmail());
        if (request.getRole() != null && !request.getRole().isBlank()) {
            String roleName = normalizeRoleName(request.getRole(), null);
            if (roleName == null) {
                return ResponseEntity.badRequest().body("Role must be MANAGER or UTILISATEUR");
            }
            Role role = roleRepository.findByNom(roleName);
            if (role == null) {
                return ResponseEntity.badRequest().body("Role not found: " + roleName);
            }
            user.setRole(role);
        }
        if (request.getPassword() != null && !request.getPassword().isEmpty()) {
            if (!isFirebaseCompatiblePassword(request.getPassword())) {
                return ResponseEntity.badRequest().body("Password must contain at least 6 characters");
            }
            user.setMotDePasse(request.getPassword());
        }
        utilisateurRepository.save(user);
        syncFirebaseUserUpdate(previousEmail, request.getEmail(), request.getPassword(), request.getNomUtilisateur());
        return ResponseEntity.ok("User updated successfully");
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        Optional<Utilisateur> userOpt = utilisateurRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Utilisateur user = userOpt.get();
        utilisateurRepository.deleteById(id);
        syncFirebaseUserDelete(user.getEmail());
        return ResponseEntity.ok("User deleted successfully");
    }

    private String normalizeRoleName(String requestedRole, String defaultRole) {
        String value = requestedRole == null ? "" : requestedRole.trim().toUpperCase();
        if (value.isBlank()) {
            return defaultRole;
        }
        if ("USER".equals(value)) {
            return "UTILISATEUR";
        }
        if ("MANAGER".equals(value) || "UTILISATEUR".equals(value)) {
            return value;
        }
        return null;
    }

    public static class LoginRequest {
        private String email;
        private String password;

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    public static class RegisterRequest {
        private String nomUtilisateur;
        private String email;
        private String password;
        private String role;

        public String getNomUtilisateur() { return nomUtilisateur; }
        public void setNomUtilisateur(String nomUtilisateur) { this.nomUtilisateur = nomUtilisateur; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
    }

    public static class UpdateUserRequest {
        private String nomUtilisateur;
        private String email;
        private String password;
        private String role;

        public String getNomUtilisateur() { return nomUtilisateur; }
        public void setNomUtilisateur(String nomUtilisateur) { this.nomUtilisateur = nomUtilisateur; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
    }

    public static class FirebaseLoginRequest {
        private String token;

        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
    }

    public static class LoginResponse {
        private Utilisateur user;
        private String token;
        private java.time.LocalDateTime expiresAt;

        public Utilisateur getUser() { return user; }
        public void setUser(Utilisateur user) { this.user = user; }
        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
        public java.time.LocalDateTime getExpiresAt() { return expiresAt; }
        public void setExpiresAt(java.time.LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    }

    public static class FirebaseLoginResponse {
        private Utilisateur user;
        private String token;
        private java.time.LocalDateTime expiresAt;

        public Utilisateur getUser() { return user; }
        public void setUser(Utilisateur user) { this.user = user; }
        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
        public java.time.LocalDateTime getExpiresAt() { return expiresAt; }
        public void setExpiresAt(java.time.LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    }

    public static class ParamUpdateRequest {
        private String valeur;

        public String getValeur() { return valeur; }
        public void setValeur(String valeur) { this.valeur = valeur; }
    }

    private String extractEmailFromToken(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) return null;
            String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
            // Simple JSON parse for email
            if (payload.contains("\"email\"")) {
                int start = payload.indexOf("\"email\":\"") + 9;
                int end = payload.indexOf("\"", start);
                return payload.substring(start, end);
            }
        } catch (Exception e) {
            // Ignore
        }
        return null;
    }

    private void ensureSystemParams() {
        ensureParam("limite_tentatives", "3", "Nombre maximum de tentatives de connexion avant blocage");
        ensureParam("duree_session_minutes", "60", "Duree de vie d'une session en minutes");
        ensureParam("prix_par_m2", "100000", "Prix forfaitaire par m2 pour calcul automatique du budget");
    }

    private void ensureParam(String cle, String valeur, String description) {
        if (parametreAuthRepository.findByCle(cle).isPresent()) {
            return;
        }
        ParametreAuth param = new ParametreAuth();
        param.setCle(cle);
        param.setValeur(valeur);
        param.setDescription(description);
        parametreAuthRepository.save(param);
    }

    private boolean isFirebaseAdminAvailable() {
        return !FirebaseApp.getApps().isEmpty();
    }

    private boolean syncFirebaseUserCreate(String email, String password, String displayName) {
        if (password == null || password.isBlank() || email == null || email.isBlank()) {
            return false;
        }

        if (isFirebaseAdminAvailable()) {
            try {
                FirebaseAuth auth = FirebaseAuth.getInstance();
                try {
                    auth.getUserByEmail(email);
                    return true;
                } catch (Exception ignored) {
                    // user does not exist yet
                }

                UserRecord.CreateRequest createRequest = new UserRecord.CreateRequest()
                    .setEmail(email)
                    .setPassword(password);
                if (displayName != null && !displayName.isBlank()) {
                    createRequest.setDisplayName(displayName);
                }
                auth.createUser(createRequest);
                return true;
            } catch (Exception e) {
                logger.warn("Firebase Admin create sync failed for {}: {}", email, e.getMessage());
            }
        }

        return syncFirebaseUserCreateViaRest(email, password);
    }

    private void syncFirebaseUserUpdate(String oldEmail, String newEmail, String newPassword, String newDisplayName) {
        if (!isFirebaseAdminAvailable()) {
            if (newEmail != null && !newEmail.isBlank() && newPassword != null && !newPassword.isBlank()) {
                syncFirebaseUserCreateViaRest(newEmail, newPassword);
            } else {
                logger.warn("Firebase user update sync skipped for {} -> {}: admin SDK unavailable and no password for REST fallback", oldEmail, newEmail);
            }
            return;
        }

        try {
            FirebaseAuth auth = FirebaseAuth.getInstance();
            UserRecord userRecord;
            try {
                userRecord = auth.getUserByEmail(oldEmail);
            } catch (Exception firstLookupError) {
                userRecord = auth.getUserByEmail(newEmail);
            }

            UserRecord.UpdateRequest updateRequest = new UserRecord.UpdateRequest(userRecord.getUid());
            if (newEmail != null && !newEmail.isBlank()) {
                updateRequest.setEmail(newEmail);
            }
            if (newPassword != null && !newPassword.isBlank()) {
                updateRequest.setPassword(newPassword);
            }
            if (newDisplayName != null && !newDisplayName.isBlank()) {
                updateRequest.setDisplayName(newDisplayName);
            }
            auth.updateUser(updateRequest);
        } catch (Exception e) {
            logger.warn("Firebase user update sync skipped for {} -> {}: {}", oldEmail, newEmail, e.getMessage());
        }
    }

    private void syncFirebaseUserDelete(String email) {
        if (!isFirebaseAdminAvailable()) {
            return;
        }

        try {
            FirebaseAuth auth = FirebaseAuth.getInstance();
            UserRecord userRecord = auth.getUserByEmail(email);
            auth.deleteUser(userRecord.getUid());
        } catch (Exception e) {
            logger.warn("Firebase user delete sync skipped for {}: {}", email, e.getMessage());
        }
    }

    private boolean syncFirebaseUserCreateViaRest(String email, String password) {
        if (firebaseWebApiKey == null || firebaseWebApiKey.isBlank()) {
            logger.warn("Firebase REST create skipped for {}: missing FIREBASE_WEB_API_KEY", email);
            return false;
        }

        try {
            String endpoint = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key="
                + URLEncoder.encode(firebaseWebApiKey, StandardCharsets.UTF_8);
            String payload = "{"
                + "\"email\":\"" + escapeJson(email) + "\","
                + "\"password\":\"" + escapeJson(password) + "\","
                + "\"returnSecureToken\":true"
                + "}";

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(8))
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

            HttpResponse<String> response = firebaseHttpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status >= 200 && status < 300) {
                return true;
            }

            String body = response.body() == null ? "" : response.body();
            if (body.contains("EMAIL_EXISTS")) {
                return true;
            }

            logger.warn("Firebase REST create sync failed for {}: status={} body={}", email, status, body);
            return false;
        } catch (Exception e) {
            logger.warn("Firebase REST create sync exception for {}: {}", email, e.getMessage());
            return false;
        }
    }

    private FirebaseRestSignInResult verifyFirebaseSignIn(String email, String password) {
        if (firebaseWebApiKey == null || firebaseWebApiKey.isBlank()) {
            logger.warn("Firebase REST sign-in skipped for {}: missing FIREBASE_WEB_API_KEY", email);
            return FirebaseRestSignInResult.failure();
        }

        try {
            String endpoint = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="
                + URLEncoder.encode(firebaseWebApiKey, StandardCharsets.UTF_8);
            String payload = "{"
                + "\"email\":\"" + escapeJson(email) + "\","
                + "\"password\":\"" + escapeJson(password) + "\","
                + "\"returnSecureToken\":true"
                + "}";

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(8))
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

            HttpResponse<String> response = firebaseHttpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String body = response.body() == null ? "" : response.body();
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                String token = extractSimpleJsonField(body, "idToken");
                return FirebaseRestSignInResult.success(token);
            }

            logger.warn("Firebase REST sign-in failed for {}: status={} body={}", email, response.statusCode(), body);
            return FirebaseRestSignInResult.failure();
        } catch (Exception e) {
            logger.warn("Firebase REST sign-in exception for {}: {}", email, e.getMessage());
            return FirebaseRestSignInResult.failure();
        }
    }

    private String resolveFirebaseDisplayName(String idToken, String fallbackEmail) {
        if (idToken == null || idToken.isBlank()) {
            return fallbackEmail;
        }

        try {
            String[] parts = idToken.split("\\.");
            if (parts.length < 2) {
                return fallbackEmail;
            }
            String payload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            String name = extractSimpleJsonField(payload, "name");
            if (name != null && !name.isBlank()) {
                return name;
            }
        } catch (Exception ignored) {
            // fallback below
        }

        return fallbackEmail;
    }

    private String extractSimpleJsonField(String json, String fieldName) {
        if (json == null || fieldName == null || fieldName.isBlank()) {
            return null;
        }

        String token = "\"" + fieldName + "\"";
        int tokenIndex = json.indexOf(token);
        if (tokenIndex < 0) {
            return null;
        }

        int colonIndex = json.indexOf(':', tokenIndex + token.length());
        if (colonIndex < 0) {
            return null;
        }

        int firstQuote = json.indexOf('"', colonIndex + 1);
        if (firstQuote < 0) {
            return null;
        }

        int endQuote = firstQuote + 1;
        while (endQuote < json.length()) {
            if (json.charAt(endQuote) == '"' && json.charAt(endQuote - 1) != '\\') {
                break;
            }
            endQuote++;
        }

        if (endQuote >= json.length()) {
            return null;
        }

        return json.substring(firstQuote + 1, endQuote);
    }

    private static final class FirebaseRestSignInResult {
        private final boolean success;
        private final String idToken;

        private FirebaseRestSignInResult(boolean success, String idToken) {
            this.success = success;
            this.idToken = idToken;
        }

        private static FirebaseRestSignInResult success(String idToken) {
            return new FirebaseRestSignInResult(true, idToken);
        }

        private static FirebaseRestSignInResult failure() {
            return new FirebaseRestSignInResult(false, null);
        }
    }

    private String escapeJson(String raw) {
        if (raw == null) {
            return "";
        }
        return raw
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r");
    }

    private boolean isFirebaseCompatiblePassword(String password) {
        return password != null && password.length() >= 6;
    }
}


