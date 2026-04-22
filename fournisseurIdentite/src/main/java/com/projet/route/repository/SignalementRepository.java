package com.projet.route.repository;

import com.projet.route.models.Signalement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface SignalementRepository extends JpaRepository<Signalement, Long> {
    Signalement findByFirestoreId(String firestoreId);

    List<Signalement> findByIdUser(String idUser);

    List<Signalement> findByIdUserOrderByDateAjouteDesc(String idUser);

    List<Signalement> findByIdUserAndDateStatutMajAfterOrderByDateStatutMajDesc(String idUser, LocalDateTime since);

    List<Signalement> findByStatut(String statut);

    List<Signalement> findByDateAjouteBetween(LocalDateTime start, LocalDateTime end);
}
