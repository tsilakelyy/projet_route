import { matchesCurrentUser, type MobileSessionUser } from './currentUser';

export interface PhotoEntry {
  url: string;
  addedBy?: string;
  addedAt?: string;
}

export interface UserReport {
  id: number;
  description: string;
  statut: string;
  photos?: PhotoEntry[];
  type_probleme?: string;
  date_ajoute: string;
  latitude: number;
  longitude: number;
  surface: number;
  travaux?: {
    id: string;
    id_entreprise: number;
    budget: number;
    entreprise_nom?: string;
    date_debut_travaux: Date | null;
    date_fin_travaux: Date | null;
    avancement: number;
  };
}

export interface BuildUserReportsParams {
  currentUser: MobileSessionUser | null;
  signalements: Array<Record<string, any>>;
  travaux: Array<Record<string, any>>;
  previousStatusState?: Map<string, string>;
  silent?: boolean;
}

export interface BuildUserReportsResult {
  reports: UserReport[];
  statusChanged: boolean;
  nextStatusState: Map<string, string>;
}

export const normalizeStatus = (statut?: string) => {
  const normalized = (statut || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (normalized === 'en cours' || normalized === 'encours') return 'en cours';
  if (normalized === 'termine' || normalized === 'resolu' || normalized === 'resout') return 'termine';
  return 'nouveau';
};

const parsePhotos = (value: unknown): PhotoEntry[] => {
  if (Array.isArray(value)) {
    return value
      .map((item: any) => {
        if (typeof item === 'string') {
          const url = item.trim();
          return url ? { url, addedBy: 'legacy' } : null;
        }

        const url = String(item?.url || '').trim();
        if (!url) return null;

        return {
          url,
          addedBy: String(item?.addedBy || 'unknown'),
          addedAt: item?.addedAt ? String(item.addedAt) : undefined,
        } as PhotoEntry;
      })
      .filter((photo): photo is PhotoEntry => photo !== null);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return parsePhotos(JSON.parse(trimmed));
      } catch {
        return [];
      }
    }
  }

  return [];
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const toReportId = (value: unknown) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  const raw = String(value || '').trim();
  if (!raw) {
    return 1;
  }

  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }

  const normalized = Math.abs(hash);
  return normalized > 0 ? normalized : 1;
};

const toIsoString = (value: unknown) => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
};

const buildTravauxBySignalement = (travaux: Array<Record<string, any>>) => {
  const travauxBySignalement = new Map<number, Record<string, any>>();

  travaux.forEach((travail) => {
    const idSignalement = Number(
      travail?.signalement?.idSignalement ??
      travail?.signalementId ??
      travail?.id_signalement
    );

    if (Number.isFinite(idSignalement)) {
      travauxBySignalement.set(idSignalement, travail);
    }
  });

  return travauxBySignalement;
};

export const buildUserReports = ({
  currentUser,
  signalements,
  travaux,
  previousStatusState = new Map<string, string>(),
  silent = false,
}: BuildUserReportsParams): BuildUserReportsResult => {
  if (!currentUser) {
    return {
      reports: [],
      statusChanged: false,
      nextStatusState: new Map<string, string>(),
    };
  }

  const travauxBySignalement = buildTravauxBySignalement(travaux);
  const nextStatusState = new Map<string, string>();
  let statusChanged = false;

  const reports = signalements
    .filter((signalement) =>
      matchesCurrentUser(
        currentUser,
        signalement?.idUser ?? signalement?.Id_User ?? signalement?.id_user
      )
    )
    .map((signalement) => {
      const signalementKey =
        signalement?.idSignalement ??
        signalement?.id_signalement ??
        signalement?.id;
      const idSignalement = toReportId(signalementKey);
      const travauxAssocie = travauxBySignalement.get(idSignalement);
      const currentStatus = normalizeStatus(signalement.statut);
      const previousStatus = previousStatusState.get(String(idSignalement));

      if (silent && previousStatus && previousStatus !== currentStatus) {
        statusChanged = true;
      }

      nextStatusState.set(String(idSignalement), currentStatus);

      const normalizedSignalement: UserReport = {
        id: idSignalement,
        description: signalement.description || '',
        statut: currentStatus,
        photos: parsePhotos(signalement.photos),
        type_probleme: signalement.typeProbleme ?? signalement.type_probleme,
        date_ajoute: toIsoString(signalement.dateAjoute ?? signalement.date_ajoute),
        latitude: toNumber(signalement.latitude, 0),
        longitude: toNumber(signalement.longitude, 0),
        surface: toNumber(signalement.surface, 0),
      };

      if (!travauxAssocie) {
        return normalizedSignalement;
      }

      return {
        ...normalizedSignalement,
        travaux: {
          id: String(travauxAssocie.id || ''),
          id_entreprise: Number(
            travauxAssocie.entreprise?.idEntreprise ??
            travauxAssocie.entrepriseId ??
            travauxAssocie.id_entreprise ??
            0
          ),
          budget: toNumber(travauxAssocie.budget, 0),
          entreprise_nom: travauxAssocie.entreprise?.nom ?? travauxAssocie.entreprise_nom ?? '',
          date_debut_travaux: (
            travauxAssocie.dateDebutTravaux ||
            travauxAssocie.dateDebut ||
            travauxAssocie.date_debut_travaux
          )
            ? new Date(
                travauxAssocie.dateDebutTravaux ||
                travauxAssocie.dateDebut ||
                travauxAssocie.date_debut_travaux
              )
            : null,
          date_fin_travaux: (
            travauxAssocie.dateFinTravaux ||
            travauxAssocie.dateFin ||
            travauxAssocie.date_fin_travaux
          )
            ? new Date(
                travauxAssocie.dateFinTravaux ||
                travauxAssocie.dateFin ||
                travauxAssocie.date_fin_travaux
              )
            : null,
          avancement: toNumber(travauxAssocie.avancement, 0),
        },
      };
    })
    .sort((left, right) => {
      const leftTime = new Date(left.date_ajoute || 0).getTime();
      const rightTime = new Date(right.date_ajoute || 0).getTime();
      return rightTime - leftTime;
    });

  return {
    reports,
    statusChanged,
    nextStatusState,
  };
};
