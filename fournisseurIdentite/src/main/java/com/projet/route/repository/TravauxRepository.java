package com.projet.route.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.projet.route.models.Travaux;
import com.projet.route.models.Signalement;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface TravauxRepository extends JpaRepository<Travaux, Long> {
    Travaux findByFirestoreId(String firestoreId);
    Optional<Travaux> findBySignalement(Signalement signalement);
    
    Optional<Travaux> findBySignalementIdSignalement(Long signalementId);

    List<Travaux> findAllBySignalementIdSignalement(Long signalementId);

    void deleteBySignalementIdSignalement(Long signalementId);
    
    List<Travaux> findByAvancementLessThan(BigDecimal avancement);
}
