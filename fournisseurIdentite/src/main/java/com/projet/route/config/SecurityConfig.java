package com.projet.route.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.http.HttpMethod;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Value("${app.cors.allowed-origins:http://localhost:*,http://127.0.0.1:*,http://192.168.*:*,http://10.*:*,capacitor://localhost,ionic://localhost}")
    private String[] allowedOrigins;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(authz -> authz
                // Public docs and health
                .requestMatchers("/", "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // Public auth endpoints used by web/mobile login flows
                .requestMatchers(HttpMethod.POST,
                    "/api/auth/login",
                    "/api/auth/mobile-login",
                    "/api/auth/mobile-bootstrap",
                    "/api/auth/report-failed-login",
                    "/api/auth/check-blocked",
                    "/api/auth/firebase-login",
                    "/api/auth/firebase-register"
                ).permitAll()
                .requestMatchers(HttpMethod.GET, "/api/auth/params", "/api/auth/test").permitAll()

                // Manager reads
                .requestMatchers(HttpMethod.GET, "/api/auth/users/**").hasRole("MANAGER")
                .requestMatchers(HttpMethod.GET, "/api/signalements/sync").hasRole("MANAGER")

                // Public read-only endpoints for visitors and mobile read
                .requestMatchers(HttpMethod.GET,
                    "/api/signalements/**",
                    "/api/travaux/**",
                    "/api/entreprises/**",
                    "/api/lieux/**",
                    "/api/visitors/**",
                    "/api/analytics/**",
                    "/api/historiques-travaux/**",
                    "/api/presence/**"
                ).permitAll()
                .requestMatchers(HttpMethod.POST, "/api/signalements").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/presence/**").permitAll()

                // Protected manager mutations
                .requestMatchers(HttpMethod.POST,
                    "/api/signalements/**",
                    "/api/travaux/**",
                    "/api/historiques-travaux/**",
                    "/api/entreprises/**",
                    "/api/lieux/**",
                    "/api/sync/full",
                    "/api/auth/users/**",
                    "/api/auth/logout",
                    "/api/auth/reset-lock/**",
                    "/api/auth/params/**"
                ).hasRole("MANAGER")
                .requestMatchers(HttpMethod.PUT,
                    "/api/signalements/**",
                    "/api/travaux/**",
                    "/api/historiques-travaux/**",
                    "/api/entreprises/**",
                    "/api/lieux/**",
                    "/api/auth/users/**",
                    "/api/auth/params/**"
                ).hasRole("MANAGER")
                .requestMatchers(HttpMethod.DELETE,
                    "/api/signalements/**",
                    "/api/travaux/**",
                    "/api/historiques-travaux/**",
                    "/api/entreprises/**",
                    "/api/lieux/**",
                    "/api/auth/users/**"
                ).hasRole("MANAGER")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(Arrays.asList(allowedOrigins));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setExposedHeaders(Arrays.asList("Authorization"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

}
