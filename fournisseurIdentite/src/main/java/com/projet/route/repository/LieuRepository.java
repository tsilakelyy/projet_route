package com.projet.route.repository;

import com.projet.route.models.Lieu;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LieuRepository extends JpaRepository<Lieu, Long> {
    List<Lieu> findByVille(String ville);
    List<Lieu> findByLibelleContainingIgnoreCase(String libelle);
}
