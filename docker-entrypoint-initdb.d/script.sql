-- =====================================================================
-- RouteWatch - Schema and base data initialization (idempotent)
-- This script is executed automatically at startup by Spring Boot.
-- =====================================================================

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS utilisateurs (
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

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    id_utilisateur INT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_expiration TIMESTAMP NOT NULL,
    est_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id_utilisateur) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parametres_auth (
    cle VARCHAR(100) PRIMARY KEY,
    valeur TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS lieux (
    id_lieux SERIAL PRIMARY KEY,
    libelle VARCHAR(50) NOT NULL,
    ville VARCHAR(50),
    description TEXT
);

CREATE TABLE IF NOT EXISTS entreprise (
    id_entreprise SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS signalement (
    id_signalement SERIAL PRIMARY KEY,
    surface DECIMAL(10,2),
    latitude DECIMAL(15,6) NOT NULL,
    longitude DECIMAL(15,6) NOT NULL,
    date_ajoute TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_lieux INT,
    id_user VARCHAR(255) NOT NULL,
    type_probleme VARCHAR(50),
    statut VARCHAR(20) DEFAULT 'nouveau',
    description TEXT,
    niveau INT NOT NULL DEFAULT 1,
    photos TEXT,
    photos_json TEXT,
    date_statut_maj TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    firestore_id VARCHAR(255) UNIQUE,
    FOREIGN KEY (id_lieux) REFERENCES lieux(id_lieux)
);

ALTER TABLE signalement ADD COLUMN IF NOT EXISTS photos_json TEXT;

UPDATE signalement s
SET photos_json = (
    SELECT jsonb_agg(
        jsonb_build_object(
            'url', trim(p),
            'addedBy', 'legacy',
            'addedAt', to_char(COALESCE(s.date_ajoute, CURRENT_TIMESTAMP), 'YYYY-MM-DD"T"HH24:MI:SS')
        )
    )::text
    FROM unnest(string_to_array(COALESCE(s.photos, ''), ',')) AS p
    WHERE trim(p) <> ''
)
WHERE (s.photos_json IS NULL OR btrim(s.photos_json) = '')
  AND s.photos IS NOT NULL
  AND btrim(s.photos) <> '';

CREATE TABLE IF NOT EXISTS travaux (
    id SERIAL PRIMARY KEY,
    id_entreprise INT,
    id_signalement INT,
    budget DECIMAL(20,2),
    date_debut_travaux DATE,
    date_fin_travaux DATE,
    avancement DECIMAL(5,2) DEFAULT 0.00,
    firestore_id VARCHAR(255) UNIQUE,
    FOREIGN KEY (id_entreprise) REFERENCES entreprise(id_entreprise),
    FOREIGN KEY (id_signalement) REFERENCES signalement(id_signalement)
);

CREATE TABLE IF NOT EXISTS historiques_travaux (
    id SERIAL PRIMARY KEY,
    id_travaux INT,
    date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    avancement DECIMAL(5,2),
    commentaire TEXT,
    firestore_id VARCHAR(255) UNIQUE,
    FOREIGN KEY (id_travaux) REFERENCES travaux(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    action VARCHAR(60) NOT NULL,
    actor VARCHAR(150),
    details TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO audit_logs (entity_type, entity_id, action, actor, details)
SELECT 'system', 'seed', 'INIT', 'system', 'Journal d''audit initialise'
WHERE NOT EXISTS (SELECT 1 FROM audit_logs);

-- Legacy migration kept for compatibility.
ALTER TABLE travaux DROP COLUMN IF EXISTS statut;

-- ---------------------------------------------------------------------
-- Base seed data
-- ---------------------------------------------------------------------

INSERT INTO roles (nom)
SELECT 'UTILISATEUR'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE nom = 'UTILISATEUR');

INSERT INTO roles (nom)
SELECT 'MANAGER'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE nom = 'MANAGER');

INSERT INTO utilisateurs (id_role, nom_utilisateur, email, mot_de_passe, source_auth)
SELECT r.id, 'adminfirebase', 'adminfirebase@gmail.com', 'admin1234', 'local'
FROM roles r
WHERE r.nom = 'MANAGER'
  AND NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'adminfirebase@gmail.com');

UPDATE utilisateurs
SET email = 'blocked.demo@routewatch.com'
WHERE email = 'blocked.demo@routewatch.local'
  AND NOT EXISTS (
      SELECT 1 FROM utilisateurs u2 WHERE u2.email = 'blocked.demo@routewatch.com'
  );

UPDATE utilisateurs
SET mot_de_passe = 'demo1234'
WHERE email = 'blocked.demo@routewatch.com'
  AND (mot_de_passe IS NULL OR char_length(mot_de_passe) < 6);

UPDATE utilisateurs
SET mot_de_passe = CONCAT('rw_', id_utilisateur, '_1234')
WHERE mot_de_passe IS NULL OR char_length(mot_de_passe) < 6;

INSERT INTO utilisateurs (id_role, nom_utilisateur, email, mot_de_passe, source_auth, est_bloque, tentatives_echec)
SELECT r.id, 'blocked_demo', 'blocked.demo@routewatch.com', 'demo1234', 'local', TRUE, 6
FROM roles r
WHERE r.nom = 'UTILISATEUR'
  AND NOT EXISTS (
      SELECT 1
      FROM utilisateurs
      WHERE nom_utilisateur = 'blocked_demo'
         OR email = 'blocked.demo@routewatch.com'
         OR email = 'blocked.demo@routewatch.local'
  );

INSERT INTO parametres_auth (cle, valeur, description) VALUES
('limite_tentatives', '3', 'Nombre maximum de tentatives de connexion avant blocage'),
('duree_session_minutes', '60', 'Duree de vie d''une session en minutes'),
('prix_par_m2', '100000', 'Prix forfaitaire par m2 pour le calcul automatique du budget')
ON CONFLICT (cle) DO UPDATE
SET valeur = EXCLUDED.valeur,
    description = EXCLUDED.description;

INSERT INTO entreprise (nom)
SELECT 'Colas Madagascar'
WHERE NOT EXISTS (SELECT 1 FROM entreprise WHERE nom = 'Colas Madagascar');

INSERT INTO entreprise (nom)
SELECT 'Societe Routiere de Madagascar'
WHERE NOT EXISTS (SELECT 1 FROM entreprise WHERE nom = 'Societe Routiere de Madagascar');

INSERT INTO entreprise (nom)
SELECT 'TP Madagascar'
WHERE NOT EXISTS (SELECT 1 FROM entreprise WHERE nom = 'TP Madagascar');

INSERT INTO entreprise (nom)
SELECT 'BTP Construction'
WHERE NOT EXISTS (SELECT 1 FROM entreprise WHERE nom = 'BTP Construction');

INSERT INTO entreprise (nom)
SELECT 'Route Express'
WHERE NOT EXISTS (SELECT 1 FROM entreprise WHERE nom = 'Route Express');

INSERT INTO entreprise (nom)
SELECT 'Infra Madagascar'
WHERE NOT EXISTS (SELECT 1 FROM entreprise WHERE nom = 'Infra Madagascar');

INSERT INTO entreprise (nom)
SELECT 'Travaux Publics Antananarivo'
WHERE NOT EXISTS (SELECT 1 FROM entreprise WHERE nom = 'Travaux Publics Antananarivo');

INSERT INTO entreprise (nom)
SELECT 'Genie Civil Madagascar'
WHERE NOT EXISTS (SELECT 1 FROM entreprise WHERE nom = 'Genie Civil Madagascar');

INSERT INTO lieux (libelle, ville, description)
SELECT 'Ankorondrano', 'Antananarivo', 'Quartier administratif et commercial a fort trafic en semaine.'
WHERE NOT EXISTS (
    SELECT 1 FROM lieux WHERE libelle = 'Ankorondrano' AND ville = 'Antananarivo'
);

INSERT INTO lieux (libelle, ville, description)
SELECT 'Analakely', 'Antananarivo', 'Centre-ville historique avec flux important de bus et de taxis-be.'
WHERE NOT EXISTS (
    SELECT 1 FROM lieux WHERE libelle = 'Analakely' AND ville = 'Antananarivo'
);

INSERT INTO lieux (libelle, ville, description)
SELECT 'Ambohimanarina', 'Antananarivo', 'Zone residentielle avec routes etroites et carrefours frequents.'
WHERE NOT EXISTS (
    SELECT 1 FROM lieux WHERE libelle = 'Ambohimanarina' AND ville = 'Antananarivo'
);

INSERT INTO lieux (libelle, ville, description)
SELECT '67 Ha', 'Antananarivo', 'Secteur dense avec circulation mixte et passages pietons nombreux.'
WHERE NOT EXISTS (
    SELECT 1 FROM lieux WHERE libelle = '67 Ha' AND ville = 'Antananarivo'
);

INSERT INTO lieux (libelle, ville, description)
SELECT 'Itaosy', 'Antananarivo', 'Axe periurbain avec montees, virages et risques d erosion en saison des pluies.'
WHERE NOT EXISTS (
    SELECT 1 FROM lieux WHERE libelle = 'Itaosy' AND ville = 'Antananarivo'
);

INSERT INTO lieux (libelle, ville, description)
SELECT 'Ambohidratrimo', 'Antananarivo', 'Peripherie nord reliee a la ville par des axes secondaires.'
WHERE NOT EXISTS (
    SELECT 1 FROM lieux WHERE libelle = 'Ambohidratrimo' AND ville = 'Antananarivo'
);

INSERT INTO signalement (
    surface, latitude, longitude, date_ajoute, id_lieux, id_user, type_probleme, statut, description, niveau, date_statut_maj, firestore_id
)
SELECT
    12.50, -18.878210, 47.520890, CURRENT_TIMESTAMP,
    (SELECT id_lieux FROM lieux WHERE libelle = 'Ankorondrano' AND ville = 'Antananarivo' LIMIT 1),
    'mobile_demo_01', 'nid-de-poule', 'nouveau',
    'Chaussee degradee avec nids de poule successifs sur 30 metres.',
    4, CURRENT_TIMESTAMP, 'local-seed-sig-001'
WHERE NOT EXISTS (SELECT 1 FROM signalement WHERE firestore_id = 'local-seed-sig-001');

INSERT INTO signalement (
    surface, latitude, longitude, date_ajoute, id_lieux, id_user, type_probleme, statut, description, niveau, date_statut_maj, firestore_id
)
SELECT
    8.00, -18.914500, 47.523100, CURRENT_TIMESTAMP,
    (SELECT id_lieux FROM lieux WHERE libelle = 'Analakely' AND ville = 'Antananarivo' LIMIT 1),
    'mobile_demo_02', 'signalisation-manquante', 'en cours',
    'Feu de signalisation hors service au carrefour principal.',
    6, CURRENT_TIMESTAMP, 'local-seed-sig-002'
WHERE NOT EXISTS (SELECT 1 FROM signalement WHERE firestore_id = 'local-seed-sig-002');

INSERT INTO signalement (
    surface, latitude, longitude, date_ajoute, id_lieux, id_user, type_probleme, statut, description, niveau, date_statut_maj, firestore_id
)
SELECT
    15.00, -18.861900, 47.470800, CURRENT_TIMESTAMP,
    (SELECT id_lieux FROM lieux WHERE libelle = 'Ambohimanarina' AND ville = 'Antananarivo' LIMIT 1),
    'mobile_demo_03', 'route-endommagee', 'en cours',
    'Affaissement de chaussee avec fissures longitudinales.',
    7, CURRENT_TIMESTAMP, 'local-seed-sig-003'
WHERE NOT EXISTS (SELECT 1 FROM signalement WHERE firestore_id = 'local-seed-sig-003');

INSERT INTO signalement (
    surface, latitude, longitude, date_ajoute, id_lieux, id_user, type_probleme, statut, description, niveau, date_statut_maj, firestore_id
)
SELECT
    5.50, -18.901500, 47.515500, CURRENT_TIMESTAMP,
    (SELECT id_lieux FROM lieux WHERE libelle = '67 Ha' AND ville = 'Antananarivo' LIMIT 1),
    'mobile_demo_04', 'eclairage-defectueux', 'nouveau',
    'Eclairage public interrompu sur une section de rue.',
    3, CURRENT_TIMESTAMP, 'local-seed-sig-004'
WHERE NOT EXISTS (SELECT 1 FROM signalement WHERE firestore_id = 'local-seed-sig-004');

INSERT INTO signalement (
    surface, latitude, longitude, date_ajoute, id_lieux, id_user, type_probleme, statut, description, niveau, date_statut_maj, firestore_id
)
SELECT
    20.00, -18.930500, 47.445900, CURRENT_TIMESTAMP,
    (SELECT id_lieux FROM lieux WHERE libelle = 'Itaosy' AND ville = 'Antananarivo' LIMIT 1),
    'mobile_demo_05', 'route-inondee', 'en cours',
    'Accumulation d eau recurrente apres pluie, circulation ralentie.',
    5, CURRENT_TIMESTAMP, 'local-seed-sig-005'
WHERE NOT EXISTS (SELECT 1 FROM signalement WHERE firestore_id = 'local-seed-sig-005');

INSERT INTO signalement (
    surface, latitude, longitude, date_ajoute, id_lieux, id_user, type_probleme, statut, description, niveau, date_statut_maj, firestore_id
)
SELECT
    6.50, -18.826900, 47.478300, CURRENT_TIMESTAMP,
    (SELECT id_lieux FROM lieux WHERE libelle = 'Ambohidratrimo' AND ville = 'Antananarivo' LIMIT 1),
    'mobile_demo_06', 'autre', 'termine',
    'Chaussee remise en etat, marquage au sol a renforcer.',
    2, CURRENT_TIMESTAMP, 'local-seed-sig-006'
WHERE NOT EXISTS (SELECT 1 FROM signalement WHERE firestore_id = 'local-seed-sig-006');

INSERT INTO travaux (
    id_entreprise, id_signalement, budget, date_debut_travaux, date_fin_travaux, avancement, firestore_id
)
SELECT
    (SELECT id_entreprise FROM entreprise WHERE nom = 'Colas Madagascar' LIMIT 1),
    (SELECT id_signalement FROM signalement WHERE firestore_id = 'local-seed-sig-002' LIMIT 1),
    7200000.00, CURRENT_DATE - INTERVAL '18 days', CURRENT_DATE + INTERVAL '20 days', 45.00, 'local-seed-trav-002'
WHERE NOT EXISTS (SELECT 1 FROM travaux WHERE firestore_id = 'local-seed-trav-002');

INSERT INTO travaux (
    id_entreprise, id_signalement, budget, date_debut_travaux, date_fin_travaux, avancement, firestore_id
)
SELECT
    (SELECT id_entreprise FROM entreprise WHERE nom = 'TP Madagascar' LIMIT 1),
    (SELECT id_signalement FROM signalement WHERE firestore_id = 'local-seed-sig-003' LIMIT 1),
    18500000.00, CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE + INTERVAL '35 days', 35.00, 'local-seed-trav-003'
WHERE NOT EXISTS (SELECT 1 FROM travaux WHERE firestore_id = 'local-seed-trav-003');

INSERT INTO travaux (
    id_entreprise, id_signalement, budget, date_debut_travaux, date_fin_travaux, avancement, firestore_id
)
SELECT
    (SELECT id_entreprise FROM entreprise WHERE nom = 'Travaux Publics Antananarivo' LIMIT 1),
    (SELECT id_signalement FROM signalement WHERE firestore_id = 'local-seed-sig-005' LIMIT 1),
    9500000.00, CURRENT_DATE - INTERVAL '9 days', CURRENT_DATE + INTERVAL '16 days', 20.00, 'local-seed-trav-005'
WHERE NOT EXISTS (SELECT 1 FROM travaux WHERE firestore_id = 'local-seed-trav-005');

INSERT INTO travaux (
    id_entreprise, id_signalement, budget, date_debut_travaux, date_fin_travaux, avancement, firestore_id
)
SELECT
    (SELECT id_entreprise FROM entreprise WHERE nom = 'Route Express' LIMIT 1),
    (SELECT id_signalement FROM signalement WHERE firestore_id = 'local-seed-sig-006' LIMIT 1),
    4100000.00, CURRENT_DATE - INTERVAL '32 days', CURRENT_DATE - INTERVAL '2 days', 100.00, 'local-seed-trav-006'
WHERE NOT EXISTS (SELECT 1 FROM travaux WHERE firestore_id = 'local-seed-trav-006');
