CREATE TABLE roles (
   id SERIAL PRIMARY KEY,
   nom VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO roles (nom) VALUES ('UTILISATEUR'), ('MANAGER');

CREATE TABLE utilisateurs (
   id_utilisateur SERIAL PRIMARY KEY,
   id_role INT,
   nom_utilisateur VARCHAR(100) UNIQUE NOT NULL,
   email VARCHAR(150) UNIQUE NOT NULL,
   mot_de_passe VARCHAR(255) NOT NULL,
   est_bloque BOOLEAN DEFAULT FALSE,
   tentatives_echec INT DEFAULT 0,
   date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   source_auth VARCHAR(50) DEFAULT 'local',
   FOREIGN KEY (id_role) REFERENCES roles(id)
);

-- CrÃ©er un manager par dÃ©faut
INSERT INTO utilisateurs (id_role, nom_utilisateur, email, mot_de_passe, source_auth)
VALUES (2, 'adminfirebase', 'adminfirebase@gmail.com', 'admin1234', 'local');

-- Utilisateur de test pour mobile
-- INSERT INTO utilisateurs (id_role, nom_utilisateur, email, mot_de_passe, source_auth)
-- VALUES (1, 'testuser', 'test@example.com', 'password', 'local');

CREATE TABLE sessions (
   id SERIAL PRIMARY KEY,
   id_utilisateur INT NOT NULL,
   token TEXT NOT NULL UNIQUE,
   date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   date_expiration TIMESTAMP NOT NULL,
   est_active BOOLEAN DEFAULT TRUE,
   FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id_utilisateur) ON DELETE CASCADE
);

CREATE TABLE parametres_auth (
   cle VARCHAR(100) PRIMARY KEY,
   valeur TEXT NOT NULL,
   description TEXT
);

INSERT INTO parametres_auth (cle, valeur, description) VALUES
('limite_tentatives', '3', 'Nombre maximum de tentatives de connexion avant blocage'),
('duree_session_minutes', '60', 'Durée de vie d''une session en minutes'),
('prix_par_m2', '100000', 'Prix forfaitaire par m2 pour le calcul automatique du budget');

-- Table des lieux (ex: intersections, quartiers)
CREATE TABLE Lieux (
   Id_Lieux SERIAL PRIMARY KEY,
   libelle VARCHAR(50) NOT NULL,
   ville VARCHAR(50),
   description TEXT
);

CREATE TABLE entreprise (
   id_entreprise SERIAL PRIMARY KEY,
   nom VARCHAR(100) NOT NULL
);

-- InsÃ©rer des entreprises d'exemple
INSERT INTO entreprise (nom) VALUES
('Colas Madagascar'),
('SociÃ©tÃ© RoutiÃ¨re de Madagascar'),
('TP Madagascar'),
('BTP Construction'),
('Route Express'),
('Infra Madagascar'),
('Travaux Publics Antananarivo'),
('GÃ©nie Civil Madagascar');

CREATE TABLE signalement (
   Id_signalement SERIAL PRIMARY KEY,
   surface DECIMAL(10,2),
   latitude DECIMAL(15,6) NOT NULL,
   longitude DECIMAL(15,6) NOT NULL,
   date_ajoute TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   Id_Lieux INT, -- rÃ©fÃ©rence vers un lieu connu (optionnel)
   Id_User VARCHAR(255) NOT NULL, -- identifiant de l'utilisateur Firebase
   type_probleme VARCHAR(50), -- ex: nid-de-poule, route inondÃ©e  
   statut VARCHAR(20) DEFAULT 'nouveau', -- suivi: 'nouveau', 'en cours', 'termine'
   description TEXT, -- description de l'état ou du problème
   niveau INT NOT NULL DEFAULT 1, -- niveau de gravité de 1 à 10
   photos TEXT, -- URLs/base64 des photos séparées par virgules
   photos_json TEXT, -- format metier: [{"url","addedBy","addedAt"}]
   date_statut_maj TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   firestore_id VARCHAR(255) UNIQUE, -- ID du document Firestore
   FOREIGN KEY(Id_Lieux) REFERENCES Lieux(Id_Lieux)
);

-- ALTER TABLE signalement DROP COLUMN type_probleme; -- REMIS EN COMMENTAIRE
-- ALTER TABLE signalement DROP COLUMN statut; -- Garder la colonne statut

CREATE TABLE travaux (
   id SERIAL PRIMARY KEY,
   id_entreprise INT,
   id_signalement INT,
   budget DECIMAL(20,2),
   date_debut_travaux DATE,
   date_fin_travaux DATE,
   avancement DECIMAL(5,2) DEFAULT 0.00, -- pourcentage d'avancement(0 ou 50 ou 100%)
   firestore_id VARCHAR(255) UNIQUE, -- ID du document Firestore
   FOREIGN KEY (id_entreprise) REFERENCES entreprise(id_entreprise),
   FOREIGN KEY (id_signalement) REFERENCES signalement(Id_signalement)
);

CREATE TABLE historiques_travaux (
   id SERIAL PRIMARY KEY,
   id_travaux INT,
   date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   avancement DECIMAL(5,2),
   commentaire TEXT,
   firestore_id VARCHAR(255) UNIQUE, -- ID du document Firestore
   FOREIGN KEY (id_travaux) REFERENCES travaux(id)
);

-- Supprimer la colonne statut si elle existe (migration)
ALTER TABLE travaux DROP COLUMN IF EXISTS statut;

