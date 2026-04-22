package com.projet.route.repository;

import com.projet.route.models.ParametreAuth;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ParametreAuthRepository extends JpaRepository<ParametreAuth, String> {
    Optional<ParametreAuth> findByCle(String cle);
}