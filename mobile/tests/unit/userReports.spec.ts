import { describe, expect, test } from 'vitest';
import { buildUserReports, normalizeStatus } from '@/services/userReports';

describe('userReports', () => {
  test('garde uniquement les signalements de l utilisateur connecte et associe les travaux', () => {
    const result = buildUserReports({
      currentUser: {
        id: '12',
        backendUserId: '12',
        firebaseUid: 'firebase-12',
      },
      signalements: [
        {
          idSignalement: 101,
          idUser: '12',
          description: 'Nid de poule principal',
          statut: 'nouveau',
          surface: '12.5',
          latitude: '-18.9',
          longitude: '47.5',
          photos: ['https://example.com/a.jpg'],
          typeProbleme: 'nid-de-poule',
          dateAjoute: '2026-04-20T08:00:00',
        },
        {
          idSignalement: 202,
          Id_User: 'firebase-12',
          description: 'Signalement hors ligne',
          statut: 'en cours',
          surface: 3,
          latitude: -18.91,
          longitude: 47.51,
          photos: JSON.stringify([{ url: 'https://example.com/b.jpg' }]),
          type_probleme: 'route-endommagee',
          date_ajoute: '2026-04-21T08:00:00',
        },
        {
          idSignalement: 303,
          id_user: '999',
          description: 'Autre utilisateur',
          statut: 'termine',
          surface: 1,
          latitude: -18.92,
          longitude: 47.52,
          dateAjoute: '2026-04-19T08:00:00',
        },
      ],
      travaux: [
        {
          id: 'trav-1',
          signalement: { idSignalement: 101 },
          budget: '450000',
          avancement: '35',
          entreprise: { idEntreprise: 7, nom: 'RouteFix' },
          dateDebutTravaux: '2026-04-22T09:00:00',
        },
      ],
    });

    expect(result.reports).toHaveLength(2);
    expect(result.reports.map((report) => report.id)).toEqual([202, 101]);
    expect(result.reports[0].description).toBe('Signalement hors ligne');
    expect(result.reports[0].photos?.[0].url).toBe('https://example.com/b.jpg');
    expect(result.reports[1].travaux?.entreprise_nom).toBe('RouteFix');
    expect(result.reports[1].travaux?.budget).toBe(450000);
    expect(result.reports[1].travaux?.avancement).toBe(35);
  });

  test('detecte un changement de statut quand un signalement sync Firebase evolue', () => {
    const initial = buildUserReports({
      currentUser: {
        id: '12',
        backendUserId: '12',
        firebaseUid: 'firebase-12',
      },
      signalements: [
        {
          idSignalement: 101,
          idUser: '12',
          description: 'Signalement',
          statut: 'nouveau',
          dateAjoute: '2026-04-20T08:00:00',
          latitude: 0,
          longitude: 0,
          surface: 1,
        },
      ],
      travaux: [],
    });

    const updated = buildUserReports({
      currentUser: {
        id: '12',
        backendUserId: '12',
        firebaseUid: 'firebase-12',
      },
      signalements: [
        {
          idSignalement: 101,
          idUser: '12',
          description: 'Signalement',
          statut: 'termine',
          dateAjoute: '2026-04-20T08:00:00',
          latitude: 0,
          longitude: 0,
          surface: 1,
        },
      ],
      travaux: [],
      previousStatusState: initial.nextStatusState,
      silent: true,
    });

    expect(updated.statusChanged).toBe(true);
    expect(updated.reports[0].statut).toBe('termine');
  });

  test('normalise les statuts utilisateur et met resolu dans termine', () => {
    expect(normalizeStatus('encours')).toBe('en cours');
    expect(normalizeStatus('résolu')).toBe('termine');
    expect(normalizeStatus('')).toBe('nouveau');
  });
});
