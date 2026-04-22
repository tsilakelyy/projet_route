package com.projet.route.services;

import com.projet.route.models.Lieu;
import com.projet.route.repository.LieuRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class LieuService {
    
    @Autowired
    private LieuRepository lieuRepository;
    
    public List<Lieu> getAllLieux() {
        return lieuRepository.findAll();
    }
    
    public Optional<Lieu> getLieuById(Long id) {
        return lieuRepository.findById(id);
    }
    
    public Lieu createLieu(Lieu lieu) {
        return lieuRepository.save(lieu);
    }
    
    public Lieu updateLieu(Long id, Lieu lieuDetails) {
        Optional<Lieu> optionalLieu = lieuRepository.findById(id);
        if (optionalLieu.isPresent()) {
            Lieu lieu = optionalLieu.get();
            lieu.setLibelle(lieuDetails.getLibelle());
            lieu.setVille(lieuDetails.getVille());
            lieu.setDescription(lieuDetails.getDescription());
            return lieuRepository.save(lieu);
        }
        throw new RuntimeException("Lieu non trouvé avec l'id: " + id);
    }
    
    public void deleteLieu(Long id) {
        lieuRepository.deleteById(id);
    }
    
    public List<Lieu> getLieuxByVille(String ville) {
        return lieuRepository.findByVille(ville);
    }
}
