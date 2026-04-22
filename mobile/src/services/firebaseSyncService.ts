// mobile/src/services/firebaseSyncService.ts - VERSION REALTIME DATABASE
import { db } from '../firebase';
import {
  ref,
  get,
  push,
  update,
  remove,
  onValue,
  DataSnapshot,
} from 'firebase/database';
import { apiUrlAsync } from '../config/api';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface Signalement {
  id?: string;
  idUser: string;
  latitude: number;
  longitude: number;
  surface: number;
  niveau: number;
  typeProbleme?: string;
  description: string;
  dateAjoute: Date;
  statut: string; // 'nouveau' | 'en_cours' | 'termine'
  photos: string[];
  lieuNom?: string;
  lieuVille?: string;
  lieuDescription?: string;
  entrepriseNom?: string;
  budget?: number;
  avancement?: number;
  travauxId?: number;
  entrepriseId?: number;
  dateDebut?: Date;
  dateFin?: Date;
  dateSync?: Date;
  source?: 'mobile' | 'web';
}

export interface Travaux {
  id?: string;
  signalementId: string;
  description: string;
  dateDebut: Date;
  dateFin?: Date;
  statut: string;
  entrepriseId?: number;
  budget?: number;
  avancement?: number;
  dateSync?: Date;
  source?: 'mobile' | 'web';
}

export interface Utilisateur {
  id?: string;
  nomUtilisateur: string;
  email: string;
  role: string;
  estBloque?: boolean;
  tentativesEchec?: number;
  dateCreation?: Date;
  dateSync?: Date;
  source?: 'mobile' | 'web';
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Convertit un snapshot RTDB en tableau typé, en réhydratant les dates stockées en ms. */
function snapshotToArray<T extends { id?: string }>(
  snapshot: DataSnapshot,
  dateFields: string[] = []
): T[] {
  if (!snapshot.exists()) return [];
  const result: T[] = [];

  snapshot.forEach((child) => {
    const raw = child.val() as Record<string, any>;
    const item: Record<string, any> = { id: child.key, ...raw };

    dateFields.forEach((field) => {
      if (item[field] && typeof item[field] === 'number') {
        item[field] = new Date(item[field]);
      } else if (item[field]) {
        item[field] = new Date(item[field]);
      }
    });

    result.push(item as unknown as T);
  });

  return result;
}

/** Prépare un objet pour l'écriture RTDB (dates → timestamps ms, undefined supprimés). */
function prepareForDB(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v instanceof Date) {
      out[k] = v.getTime();
    } else {
      out[k] = v;
    }
  }
  return out;
}

const formatLocalDateTime = (value?: Date): string | undefined => {
  if (!value) return undefined;
  const iso = value.toISOString();
  return iso.slice(0, 19);
};

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
};

const normalizeSignalement = (raw: Record<string, any>): Signalement => ({
  id: raw.id,
  idUser: String(raw.idUser ?? raw.Id_User ?? raw.id_user ?? ''),
  latitude: Number(raw.latitude ?? 0),
  longitude: Number(raw.longitude ?? 0),
  surface: Number(raw.surface ?? 0),
  niveau: Number(raw.niveau ?? 1),
  typeProbleme: raw.typeProbleme ?? raw.type_probleme,
  description: String(raw.description ?? ''),
  dateAjoute: toDate(raw.dateAjoute ?? raw.date_ajoute) ?? new Date(),
  statut: String(raw.statut ?? 'nouveau'),
  photos: Array.isArray(raw.photos) ? raw.photos : [],
  lieuNom: raw.lieuNom,
  lieuVille: raw.lieuVille,
  lieuDescription: raw.lieuDescription,
  entrepriseNom: raw.entrepriseNom,
  budget: raw.budget != null ? Number(raw.budget) : undefined,
  avancement: raw.avancement != null ? Number(raw.avancement) : undefined,
  travauxId: raw.travauxId != null ? Number(raw.travauxId) : undefined,
  entrepriseId: raw.entrepriseId != null ? Number(raw.entrepriseId) : undefined,
  dateDebut: toDate(raw.dateDebut ?? raw.date_debut_travaux),
  dateFin: toDate(raw.dateFin ?? raw.date_fin_travaux),
  dateSync: toDate(raw.dateSync),
  source: raw.source,
});

const serializeSignalement = (input: Partial<Signalement> & Record<string, any>): Record<string, any> =>
  prepareForDB({
    latitude: input.latitude,
    longitude: input.longitude,
    surface: input.surface,
    niveau: input.niveau ?? 1,
    Id_User: input.Id_User ?? input.idUser ?? input.id_user,
    id_user: input.id_user ?? input.idUser ?? input.Id_User,
    type_probleme: input.type_probleme ?? input.typeProbleme,
    description: input.description,
    statut: input.statut ?? 'nouveau',
    photos: input.photos ?? [],
    date_ajoute: input.date_ajoute ?? formatLocalDateTime(toDate(input.dateAjoute) ?? new Date()),
    date_statut_maj: input.date_statut_maj ?? formatLocalDateTime(toDate(input.dateStatutMaj)),
    source: input.source ?? 'mobile',
    dateSync: Date.now(),
  });

const normalizeTravaux = (raw: Record<string, any>): Travaux => ({
  id: raw.id,
  signalementId: String(raw.signalementId ?? raw.id_signalement ?? ''),
  description: String(raw.description ?? ''),
  dateDebut: toDate(raw.dateDebut ?? raw.date_debut_travaux) ?? new Date(),
  dateFin: toDate(raw.dateFin ?? raw.date_fin_travaux),
  statut: String(raw.statut ?? ''),
  entrepriseId: raw.entrepriseId != null ? Number(raw.entrepriseId) : raw.id_entreprise != null ? Number(raw.id_entreprise) : undefined,
  budget: raw.budget != null ? Number(raw.budget) : undefined,
  avancement: raw.avancement != null ? Number(raw.avancement) : undefined,
  dateSync: toDate(raw.dateSync),
  source: raw.source,
});

const serializeTravaux = (input: Partial<Travaux> & Record<string, any>): Record<string, any> =>
  prepareForDB({
    id_signalement: input.id_signalement ?? input.signalementId,
    id_entreprise: input.id_entreprise ?? input.entrepriseId,
    budget: input.budget,
    avancement: input.avancement,
    date_debut_travaux: input.date_debut_travaux ?? formatLocalDateTime(toDate(input.dateDebut)),
    date_fin_travaux: input.date_fin_travaux ?? formatLocalDateTime(toDate(input.dateFin)),
    description: input.description,
    statut: input.statut,
    source: input.source ?? 'mobile',
    dateSync: Date.now(),
  });

// ─── Service ───────────────────────────────────────────────────────────────────

class FirebaseSyncService {
  private unsubscribeSignalements: (() => void) | null = null;
  private unsubscribeTravaux: (() => void) | null = null;
  private unsubscribeUtilisateurs: (() => void) | null = null;

  // ── Signalements ─────────────────────────────────────────────────────────────

  async getSignalements(): Promise<Signalement[]> {
    try {
      const snapshot = await get(ref(db, 'signalements'));
      return snapshotToArray<Record<string, any>>(snapshot).map((item) => normalizeSignalement(item));
    } catch (error) {
      console.error('Erreur r�cup�ration signalements:', error);
      throw error;
    }
  }

  async addSignalement(signalement: Omit<Signalement, 'id' | 'dateSync'>): Promise<string> {
    try {
      const data = serializeSignalement(signalement as any);
      const newRef = await push(ref(db, 'signalements'), data);
      return newRef.key!;
    } catch (error) {
      console.error('Erreur ajout signalement:', error);
      throw error;
    }
  }

  async updateSignalement(id: string, signalement: Partial<Signalement>): Promise<void> {
    try {
      const data = serializeSignalement(signalement as any);
      await update(ref(db, `signalements/${id}`), data);
    } catch (error) {
      console.error('Erreur mise � jour signalement:', error);
      throw error;
    }
  }

  async deleteSignalement(id: string): Promise<void> {
    try {
      await remove(ref(db, `signalements/${id}`));
    } catch (error) {
      console.error('Erreur suppression signalement:', error);
      throw error;
    }
  }

  subscribeToSignalements(callback: (signalements: Signalement[]) => void): () => void {
    if (this.unsubscribeSignalements) this.unsubscribeSignalements();

    const unsubscribe = onValue(
      ref(db, 'signalements'),
      (snapshot) => {
        const signalements = snapshotToArray<Record<string, any>>(snapshot).map((item) => normalizeSignalement(item));
        callback(signalements);
      },
      (error) => console.error('Erreur écoute signalements:', error)
    );

    this.unsubscribeSignalements = unsubscribe;

    return () => {
      if (this.unsubscribeSignalements === unsubscribe) {
        this.unsubscribeSignalements = null;
      }
      unsubscribe();
    };
  }

  // ── Travaux ──────────────────────────────────────────────────────────────────

  async getTravaux(): Promise<Travaux[]> {
    try {
      const snapshot = await get(ref(db, 'travaux'));
      return snapshotToArray<Record<string, any>>(snapshot).map((item) => normalizeTravaux(item));
    } catch (error) {
      console.error('Erreur r�cup�ration travaux:', error);
      throw error;
    }
  }

  async addTravaux(travaux: Omit<Travaux, 'id' | 'dateSync'>): Promise<string> {
    try {
      const data = serializeTravaux(travaux as any);
      const newRef = await push(ref(db, 'travaux'), data);
      return newRef.key!;
    } catch (error) {
      console.error('Erreur ajout travaux:', error);
      throw error;
    }
  }

  async updateTravaux(id: string, travaux: Partial<Travaux>): Promise<void> {
    try {
      const data = serializeTravaux(travaux as any);
      await update(ref(db, `travaux/${id}`), data);
    } catch (error) {
      console.error('Erreur mise � jour travaux:', error);
      throw error;
    }
  }

  subscribeToTravaux(callback: (travaux: Travaux[]) => void): () => void {
    if (this.unsubscribeTravaux) this.unsubscribeTravaux();

    const unsubscribe = onValue(
      ref(db, 'travaux'),
      (snapshot) => {
        const travaux = snapshotToArray<Record<string, any>>(snapshot).map((item) => normalizeTravaux(item));
        callback(travaux);
      },
      (error) => console.error('Erreur écoute travaux:', error)
    );

    this.unsubscribeTravaux = unsubscribe;

    return () => {
      if (this.unsubscribeTravaux === unsubscribe) {
        this.unsubscribeTravaux = null;
      }
      unsubscribe();
    };
  }

  // ── Utilisateurs ─────────────────────────────────────────────────────────────

  async getUtilisateurs(): Promise<Utilisateur[]> {
    try {
      const snapshot = await get(ref(db, 'utilisateurs'));
      return snapshotToArray<Utilisateur>(snapshot, ['dateCreation', 'dateSync']);
    } catch (error) {
      console.error('Erreur récupération utilisateurs:', error);
      throw error;
    }
  }

  async addUtilisateur(utilisateur: Omit<Utilisateur, 'id' | 'dateSync'>): Promise<string> {
    try {
      const data = prepareForDB({ ...utilisateur, dateSync: Date.now() });
      const newRef = await push(ref(db, 'utilisateurs'), data);
      return newRef.key!;
    } catch (error) {
      console.error('Erreur ajout utilisateur:', error);
      throw error;
    }
  }

  async updateUtilisateur(id: string, utilisateur: Partial<Utilisateur>): Promise<void> {
    try {
      const data = prepareForDB({ ...utilisateur, dateSync: Date.now() });
      await update(ref(db, `utilisateurs/${id}`), data);
    } catch (error) {
      console.error('Erreur mise à jour utilisateur:', error);
      throw error;
    }
  }

  subscribeToUtilisateurs(callback: (utilisateurs: Utilisateur[]) => void): () => void {
    if (this.unsubscribeUtilisateurs) this.unsubscribeUtilisateurs();

    const unsubscribe = onValue(
      ref(db, 'utilisateurs'),
      (snapshot) => {
        const utilisateurs = snapshotToArray<Utilisateur>(snapshot, [
          'dateCreation', 'dateSync',
        ]);
        callback(utilisateurs);
      },
      (error) => console.error('Erreur écoute utilisateurs:', error)
    );

    this.unsubscribeUtilisateurs = unsubscribe;

    return () => {
      if (this.unsubscribeUtilisateurs === unsubscribe) {
        this.unsubscribeUtilisateurs = null;
      }
      unsubscribe();
    };
  }

  // ── Gestion des abonnements ───────────────────────────────────────────────────

  unsubscribeAll(): void {
    this.unsubscribeSignalements?.();
    this.unsubscribeSignalements = null;

    this.unsubscribeTravaux?.();
    this.unsubscribeTravaux = null;

    this.unsubscribeUtilisateurs?.();
    this.unsubscribeUtilisateurs = null;
  }

  // ── Synchronisation complète ─────────────────────────────────────────────────

  async syncAll(): Promise<{ success: boolean; message: string }> {
    try {
      const [signalements, travaux, utilisateurs] = await Promise.all([
        this.getSignalements(),
        this.getTravaux(),
        this.getUtilisateurs(),
      ]);

      localStorage.setItem('signalements', JSON.stringify(signalements));
      localStorage.setItem('travaux', JSON.stringify(travaux));
      localStorage.setItem('utilisateurs', JSON.stringify(utilisateurs));

      return {
        success: true,
        message: `Synchronisation réussie : ${signalements.length} signalements, ${travaux.length} travaux, ${utilisateurs.length} utilisateurs`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Erreur synchronisation:', error);
      return { success: false, message: `Erreur de synchronisation : ${errorMessage}` };
    }
  }

  async syncPostgresToFirebase(): Promise<{ success: boolean; message: string }> {
    try {
      const url = await apiUrlAsync('/api/sync/local-to-firebase');
      const response = await fetch(url);
      if (!response.ok) throw new Error('Backend indisponible');

      const localData = await response.json();
      return {
        success: true,
        message: `Synchronisé : ${localData.signalements} signalements, ${localData.travaux} travaux`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Sync Postgres→Firebase échouée:', error);
      return { success: false, message: `Erreur : ${errorMessage}` };
    }
  }

  // ── Cache local ──────────────────────────────────────────────────────────────

  async syncWithLocalCache(): Promise<void> {
    try {
      const [signalements, travaux, utilisateurs] = await Promise.all([
        this.getSignalements(),
        this.getTravaux(),
        this.getUtilisateurs(),
      ]);
      await this.saveToLocalCache(signalements, travaux, utilisateurs);
    } catch (error) {
      console.warn('Utilisation cache local:', error instanceof Error ? error.message : error);
    }
  }

  private async saveToLocalCache(
    signalements: Signalement[],
    travaux: Travaux[],
    utilisateurs: Utilisateur[]
  ): Promise<void> {
    localStorage.setItem('firebase_cache_timestamp', Date.now().toString());
    localStorage.setItem('signalements_cache', JSON.stringify(signalements));
    localStorage.setItem('travaux_cache', JSON.stringify(travaux));
    localStorage.setItem('utilisateurs_cache', JSON.stringify(utilisateurs));
  }

  async loadFromLocalCache(): Promise<{
    signalements: Signalement[];
    travaux: Travaux[];
    utilisateurs: Utilisateur[];
  } | null> {
    try {
      const signalementsStr = localStorage.getItem('signalements_cache');
      const travauxStr = localStorage.getItem('travaux_cache');
      const utilisateursStr = localStorage.getItem('utilisateurs_cache');
      const timestampStr = localStorage.getItem('firebase_cache_timestamp');

      if (!signalementsStr || !travauxStr || !utilisateursStr || !timestampStr) return null;

      // Cache invalide après 1 heure
      if (Date.now() - parseInt(timestampStr) > 3_600_000) return null;

      return {
        signalements: JSON.parse(signalementsStr),
        travaux: JSON.parse(travauxStr),
        utilisateurs: JSON.parse(utilisateursStr),
      };
    } catch (error) {
      console.error('Erreur chargement cache local:', error instanceof Error ? error.message : error);
      return null;
    }
  }
}

export const firebaseSyncService = new FirebaseSyncService();

