import { db } from '../firebase'; // db doit être une instance Realtime Database
import {
  ref,
  get,
  push,
  update,
  remove,
  onValue,
  off,
  serverTimestamp,
  DatabaseReference,
} from 'firebase/database';

// ─── Interfaces ──────────────────────────────────────────────────

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

// ─── Helpers de conversion dates ─────────────────────────────────

// Realtime Database stocke les timestamps comme des nombres (ms depuis epoch)
function toDate(value: any): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function toDateRequired(value: any): Date {
  return toDate(value) ?? new Date();
}

function toLocalDateTime(value?: Date): string | undefined {
  if (!value) return undefined;
  return value.toISOString().slice(0, 19);
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

// Convertit les Date en timestamp ms pour stockage
function serializeSignalement(data: Partial<Signalement>): Record<string, any> {
  const out: Record<string, any> = { ...data };

  const idUser = (data as any).idUser ?? (data as any).Id_User ?? (data as any).id_user;
  if (idUser !== undefined && idUser !== null && String(idUser).trim() !== '') {
    out.idUser = String(idUser);
    out.Id_User = String(idUser);
    out.id_user = String(idUser);
  }

  const typeProbleme = (data as any).typeProbleme ?? (data as any).type_probleme;
  if (typeProbleme !== undefined && typeProbleme !== null) {
    out.typeProbleme = String(typeProbleme);
    out.type_probleme = String(typeProbleme);
  }

  const dateAjoute = toDate((data as any).dateAjoute ?? (data as any).date_ajoute);
  if (dateAjoute) {
    out.dateAjoute = dateAjoute.getTime();
    out.date_ajoute = toLocalDateTime(dateAjoute);
  }

  const dateDebut = toDate((data as any).dateDebut ?? (data as any).date_debut_travaux);
  if (dateDebut) {
    out.dateDebut = dateDebut.getTime();
    out.date_debut_travaux = toLocalDateTime(dateDebut);
  }

  const dateFin = toDate((data as any).dateFin ?? (data as any).date_fin_travaux);
  if (dateFin) {
    out.dateFin = dateFin.getTime();
    out.date_fin_travaux = toLocalDateTime(dateFin);
  }

  out.dateSync = serverTimestamp(); // { ".sv": "timestamp" } géré par Firebase
  return out;
}

function serializeTravaux(data: Partial<Travaux>): Record<string, any> {
  const out: Record<string, any> = { ...data };

  const signalementId = (data as any).signalementId ?? (data as any).id_signalement;
  if (signalementId !== undefined && signalementId !== null && String(signalementId).trim() !== '') {
    out.signalementId = String(signalementId);
    out.id_signalement = String(signalementId);
  }

  const entrepriseId = (data as any).entrepriseId ?? (data as any).id_entreprise;
  if (entrepriseId !== undefined && entrepriseId !== null && String(entrepriseId).trim() !== '') {
    out.entrepriseId = toNumber(entrepriseId, 0);
    out.id_entreprise = String(entrepriseId);
  }

  const dateDebut = toDate((data as any).dateDebut ?? (data as any).date_debut_travaux);
  if (dateDebut) {
    out.dateDebut = dateDebut.getTime();
    out.date_debut_travaux = toLocalDateTime(dateDebut);
  }

  const dateFin = toDate((data as any).dateFin ?? (data as any).date_fin_travaux);
  if (dateFin) {
    out.dateFin = dateFin.getTime();
    out.date_fin_travaux = toLocalDateTime(dateFin);
  }

  out.dateSync = serverTimestamp();
  return out;
}

function serializeUtilisateur(data: Partial<Utilisateur>): Record<string, any> {
  const out: Record<string, any> = { ...data };
  if (data.dateCreation instanceof Date) out.dateCreation = data.dateCreation.getTime();
  out.dateSync = serverTimestamp();
  return out;
}

// Désérialise un nœud brut Realtime DB → type métier
function parseSignalement(id: string, data: any): Signalement {
  return {
    ...data,
    id,
    idUser: String(data?.idUser ?? data?.Id_User ?? data?.id_user ?? ''),
    latitude: toNumber(data?.latitude, Number.NaN),
    longitude: toNumber(data?.longitude, Number.NaN),
    surface: toNumber(data?.surface, 0),
    niveau: toNumber(data?.niveau, 1),
    typeProbleme: data?.typeProbleme ?? data?.type_probleme,
    description: String(data?.description ?? ''),
    statut: String(data?.statut ?? 'nouveau'),
    photos: Array.isArray(data?.photos) ? data.photos : [],
    lieuNom: data?.lieuNom ?? data?.lieu_nom,
    lieuVille: data?.lieuVille ?? data?.lieu_ville,
    lieuDescription: data?.lieuDescription ?? data?.lieu_description,
    entrepriseNom: data?.entrepriseNom ?? data?.entreprise_nom,
    budget: data?.budget != null ? toNumber(data.budget, 0) : undefined,
    avancement: data?.avancement != null ? toNumber(data.avancement, 0) : undefined,
    travauxId: data?.travauxId != null ? toNumber(data.travauxId, 0) : undefined,
    entrepriseId: data?.entrepriseId != null ? toNumber(data.entrepriseId, 0) : data?.id_entreprise != null ? toNumber(data.id_entreprise, 0) : undefined,
    dateAjoute: toDateRequired(data?.dateAjoute ?? data?.date_ajoute),
    dateDebut: toDate(data?.dateDebut ?? data?.date_debut_travaux),
    dateFin: toDate(data?.dateFin ?? data?.date_fin_travaux),
    dateSync: toDate(data?.dateSync),
  };
}

function parseTravaux(id: string, data: any): Travaux {
  return {
    ...data,
    id,
    signalementId: String(data?.signalementId ?? data?.id_signalement ?? ''),
    description: String(data?.description ?? ''),
    dateDebut: toDateRequired(data?.dateDebut ?? data?.date_debut_travaux),
    dateFin: toDate(data?.dateFin ?? data?.date_fin_travaux),
    statut: String(data?.statut ?? ''),
    entrepriseId: data?.entrepriseId != null ? toNumber(data.entrepriseId, 0) : data?.id_entreprise != null ? toNumber(data.id_entreprise, 0) : undefined,
    budget: data?.budget != null ? toNumber(data.budget, 0) : undefined,
    avancement: data?.avancement != null ? toNumber(data.avancement, 0) : undefined,
    dateSync: toDate(data?.dateSync),
  };
}

function parseUtilisateur(id: string, data: any): Utilisateur {
  return {
    ...data,
    id,
    dateCreation: toDate(data.dateCreation),
    dateSync:     toDate(data.dateSync),
  };
}

// Transforme snapshot.val() (objet { key: data }) en tableau typé
function snapshotToArray<T>(
  val: Record<string, any> | null,
  parser: (id: string, data: any) => T
): T[] {
  if (!val) return [];
  return Object.entries(val).map(([id, data]) => parser(id, data));
}

// ─── Service ─────────────────────────────────────────────────────

class FirebaseSyncService {
  private listenersRef: Record<string, DatabaseReference> = {};
  private unsubscribers: Record<string, () => void> = {};

  // ── Lecture ────────────────────────────────────────────────────

  async getSignalements(): Promise<Signalement[]> {
    try {
      const snapshot = await get(ref(db, 'signalements'));
      return snapshotToArray(snapshot.val(), parseSignalement);
    } catch (error) {
      console.error('Erreur récupération signalements:', error);
      throw error;
    }
  }

  async getTravaux(): Promise<Travaux[]> {
    try {
      const snapshot = await get(ref(db, 'travaux'));
      return snapshotToArray(snapshot.val(), parseTravaux);
    } catch (error) {
      console.error('Erreur récupération travaux:', error);
      throw error;
    }
  }

  async getUtilisateurs(): Promise<Utilisateur[]> {
    try {
      const snapshot = await get(ref(db, 'utilisateurs'));
      return snapshotToArray(snapshot.val(), parseUtilisateur);
    } catch (error) {
      console.error('Erreur récupération utilisateurs:', error);
      throw error;
    }
  }

  // ── Écriture ───────────────────────────────────────────────────

  async addSignalement(signalement: Omit<Signalement, 'id' | 'dateSync'>): Promise<string> {
    try {
      const newRef = await push(ref(db, 'signalements'), serializeSignalement(signalement));
      return newRef.key!;
    } catch (error) {
      console.error('Erreur ajout signalement:', error);
      throw error;
    }
  }

  async updateSignalement(id: string, signalement: Partial<Signalement>): Promise<void> {
    try {
      await update(ref(db, `signalements/${id}`), serializeSignalement(signalement));
    } catch (error) {
      console.error('Erreur mise à jour signalement:', error);
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

  async addTravaux(travaux: Omit<Travaux, 'id' | 'dateSync'>): Promise<string> {
    try {
      const newRef = await push(ref(db, 'travaux'), serializeTravaux(travaux));
      return newRef.key!;
    } catch (error) {
      console.error('Erreur ajout travaux:', error);
      throw error;
    }
  }

  async updateTravaux(id: string, travaux: Partial<Travaux>): Promise<void> {
    try {
      await update(ref(db, `travaux/${id}`), serializeTravaux(travaux));
    } catch (error) {
      console.error('Erreur mise à jour travaux:', error);
      throw error;
    }
  }

  async addUtilisateur(utilisateur: Omit<Utilisateur, 'id' | 'dateSync'>): Promise<string> {
    try {
      const newRef = await push(ref(db, 'utilisateurs'), serializeUtilisateur(utilisateur));
      return newRef.key!;
    } catch (error) {
      console.error('Erreur ajout utilisateur:', error);
      throw error;
    }
  }

  async updateUtilisateur(id: string, utilisateur: Partial<Utilisateur>): Promise<void> {
    try {
      await update(ref(db, `utilisateurs/${id}`), serializeUtilisateur(utilisateur));
    } catch (error) {
      console.error('Erreur mise à jour utilisateur:', error);
      throw error;
    }
  }

  // ── Listeners temps réel ───────────────────────────────────────
  // onValue remplace onSnapshot — déclenché immédiatement puis à chaque changement

  subscribeToSignalements(callback: (signalements: Signalement[]) => void): (() => void) {
    this._unsubscribe('signalements');
    const dbRef = ref(db, 'signalements');
    this.listenersRef['signalements'] = dbRef;
    const unsubscribe = onValue(
      dbRef,
      (snapshot) => callback(snapshotToArray(snapshot.val(), parseSignalement)),
      (error) => console.error('Erreur ecoute signalements:', error)
    );
    this.unsubscribers['signalements'] = unsubscribe;
    return unsubscribe;
  }

  subscribeToTravaux(callback: (travaux: Travaux[]) => void): (() => void) {
    this._unsubscribe('travaux');
    const dbRef = ref(db, 'travaux');
    this.listenersRef['travaux'] = dbRef;
    const unsubscribe = onValue(
      dbRef,
      (snapshot) => callback(snapshotToArray(snapshot.val(), parseTravaux)),
      (error) => console.error('Erreur ecoute travaux:', error)
    );
    this.unsubscribers['travaux'] = unsubscribe;
    return unsubscribe;
  }

  subscribeToUtilisateurs(callback: (utilisateurs: Utilisateur[]) => void): (() => void) {
    this._unsubscribe('utilisateurs');
    const dbRef = ref(db, 'utilisateurs');
    this.listenersRef['utilisateurs'] = dbRef;
    const unsubscribe = onValue(
      dbRef,
      (snapshot) => callback(snapshotToArray(snapshot.val(), parseUtilisateur)),
      (error) => console.error('Erreur ecoute utilisateurs:', error)
    );
    this.unsubscribers['utilisateurs'] = unsubscribe;
    return unsubscribe;
  }
  // ── Gestion des abonnements ────────────────────────────────────

  private _unsubscribe(key: string): void {
    if (this.unsubscribers[key]) {
      this.unsubscribers[key]();
      delete this.unsubscribers[key];
    }
    if (this.listenersRef[key]) {
      off(this.listenersRef[key]);
      delete this.listenersRef[key];
    }
  }

  unsubscribeAll(): void {
    ['signalements', 'travaux', 'utilisateurs'].forEach((key) => this._unsubscribe(key));
  }

  // ── Synchronisation ────────────────────────────────────────────

  async syncAll(): Promise<{ success: boolean; message: string }> {
    try {
      const [signalements, travaux, utilisateurs] = await Promise.all([
        this.getSignalements(),
        this.getTravaux(),
        this.getUtilisateurs(),
      ]);
      return {
        success: true,
        message:
          `Synchronisation réussie: ${signalements.length} signalements, ` +
          `${travaux.length} travaux, ${utilisateurs.length} utilisateurs`,
      };
    } catch (error) {
      console.error('Erreur synchronisation:', error);
      return { success: false, message: `Erreur de synchronisation: ${error}` };
    }
  }

  async syncPostgresToFirebase(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/sync/local-to-firebase');
      if (!response.ok) throw new Error('Backend indisponible');
      const localData = await response.json();
      return {
        success: true,
        message: `Synchronisé: ${localData.signalements} signalements, ${localData.travaux} travaux`,
      };
    } catch (error) {
      let errorMessage = 'Erreur inconnue';
      if (error instanceof Error) errorMessage = error.message;
      else if (typeof error === 'string') errorMessage = error;
      console.error('Sync Postgres→Firebase échouée:', error);
      return { success: false, message: `Erreur: ${errorMessage}` };
    }
  }

  async syncWithBackend(): Promise<{
    success: boolean;
    message: string;
    pull: any;
    push: any;
    errors: any[];
  }> {
    try {
      console.log('Début de la synchronisation avec le backend...');

      const [firebaseSignalements, firebaseTravaux, firebaseUtilisateurs] = await Promise.all([
        this.getSignalements(),
        this.getTravaux(),
        this.getUtilisateurs(),
      ]);

      console.log(
        `Données récupérées depuis Realtime DB: ${firebaseSignalements.length} signalements, ` +
        `${firebaseTravaux.length} travaux, ${firebaseUtilisateurs.length} utilisateurs`
      );

      const response = await fetch('/api/sync/firebase-to-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signalements: firebaseSignalements,
          travaux: firebaseTravaux,
          utilisateurs: firebaseUtilisateurs,
        }),
      });

      if (!response.ok) throw new Error('Erreur lors de la synchronisation avec le backend local');

      const data = await response.json();
      console.log('Réponse du backend:', data);

      const localResponse = await fetch('/api/sync/local-to-firebase');
      if (!localResponse.ok) throw new Error('Erreur lors de la récupération des données locales');

      console.log('Synchronisation terminée avec succès');

      return {
        success: true,
        message:
          `Synchronisation réussie: ${firebaseSignalements.length} signalements, ` +
          `${firebaseTravaux.length} travaux, ${firebaseUtilisateurs.length} utilisateurs`,
        pull:   data.pull   ?? {},
        push:   data.push   ?? {},
        errors: data.errors ?? [],
      };
    } catch (error) {
      console.error('Erreur synchronisation avec backend:', error);
      return {
        success: false,
        message: `Erreur de synchronisation: ${error}`,
        pull: {},
        push: {},
        errors: [error],
      };
    }
  }
}

// Instance unique exportée
export const firebaseSyncService = new FirebaseSyncService();


