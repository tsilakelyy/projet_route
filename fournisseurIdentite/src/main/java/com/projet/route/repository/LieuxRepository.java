package com.projet.route.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.projet.route.models.Lieu;

public interface LieuxRepository extends JpaRepository<Lieu, Long> {
}