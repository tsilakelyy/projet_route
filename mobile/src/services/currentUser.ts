export interface MobileSessionUser {
  id?: string | number;
  firebaseUid?: string;
  backendUserId?: string | number;
  email?: string;
  nomUtilisateur?: string;
  sourceAuth?: string;
  sessionExpiration?: number;
}

const normalizeIdentifier = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

export const parseCurrentUser = (): MobileSessionUser | null => {
  const raw = localStorage.getItem('currentUser');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as MobileSessionUser;
  } catch {
    return null;
  }
};

export const getUserIdentifierSet = (user: MobileSessionUser | null): Set<string> => {
  const identifiers = new Set<string>();

  [
    user?.id,
    user?.backendUserId,
    user?.firebaseUid,
  ].forEach((candidate) => {
    const normalized = normalizeIdentifier(candidate);
    if (normalized) {
      identifiers.add(normalized);
    }
  });

  return identifiers;
};

export const matchesCurrentUser = (user: MobileSessionUser | null, candidate: unknown): boolean => {
  const normalizedCandidate = normalizeIdentifier(candidate);
  if (!normalizedCandidate) {
    return false;
  }

  return getUserIdentifierSet(user).has(normalizedCandidate);
};

export const getPreferredSignalementOwnerId = (user: MobileSessionUser | null): string => {
  return (
    normalizeIdentifier(user?.backendUserId) ??
    normalizeIdentifier(user?.id) ??
    normalizeIdentifier(user?.firebaseUid) ??
    ''
  );
};

export const getPresenceClientId = (user: MobileSessionUser | null, fallback: string): string => {
  return (
    normalizeIdentifier(user?.firebaseUid) ??
    normalizeIdentifier(user?.id) ??
    normalizeIdentifier(user?.backendUserId) ??
    fallback
  );
};
