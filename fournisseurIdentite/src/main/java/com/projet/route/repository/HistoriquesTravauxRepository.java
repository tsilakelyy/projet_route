package com.projet.route.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.projet.route.models.HistoriquesTravaux;

public interface HistoriquesTravauxRepository extends JpaRepository<HistoriquesTravaux, Long> {
    HistoriquesTravaux findByFirestoreId(String firestoreId);

    void deleteByTravauxId(Long travauxId);
}
