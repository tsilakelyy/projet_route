package com.projet.route.services;

import com.projet.route.models.Entreprise;
import com.projet.route.repository.EntrepriseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class EntrepriseService {
    
    @Autowired
    private EntrepriseRepository entrepriseRepository;
    
    public List<Entreprise> getAllEntreprises() {
        return entrepriseRepository.findAll();
    }
    
    public Optional<Entreprise> getEntrepriseById(Long id) {
        return entrepriseRepository.findById(id);
    }
    
    public Entreprise createEntreprise(Entreprise entreprise) {
        return entrepriseRepository.save(entreprise);
    }
    
    public Entreprise updateEntreprise(Long id, Entreprise entrepriseDetails) {
        Optional<Entreprise> optionalEntreprise = entrepriseRepository.findById(id);
        if (optionalEntreprise.isPresent()) {
            Entreprise entreprise = optionalEntreprise.get();
            entreprise.setNom(entrepriseDetails.getNom());
            return entrepriseRepository.save(entreprise);
        }
        throw new RuntimeException("Entreprise non trouvée avec l'id: " + id);
    }
    
    public void deleteEntreprise(Long id) {
        entrepriseRepository.deleteById(id);
    }
}