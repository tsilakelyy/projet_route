package com.projet.route.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.projet.route.models.Role;

public interface RoleRepository extends JpaRepository<Role, Long> {
    Role findByNom(String nom);
}