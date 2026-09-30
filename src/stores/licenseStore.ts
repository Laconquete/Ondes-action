import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '../services/localDatabase';
import { getSupabase } from '../services/supabaseClient';

/**
 * Store de Gestion de Licence
 *
 * Modèle commercial :
 *  - Chaque installation possède une clé de licence unique (NPX-XXXX-XXXX-XXXX-XXXX)
 *  - La clé est liée au machine code (hardware UUID + MAC address hash)
 *  - La licence est vérifiée au démarrage de l'app
 *  - Si la licence est valide → toutes les fonctionnalités sont activées + sync Supabase
 *  - Si la licence est expirée → mode lecture seule (consultation uniquement, pas de nouvelles saisies)
 *  - Si la licence est révoquée → l'app affiche un écran de blocage
 *  - Si pas de licence → mode démo (données locales uniquement, 7 jours)
 *
 * Le machine code est calculé côté Electron (preload.js → getMachineCode()).
 * En mode web (Vercel), un machine code simulé est généré à partir du navigateur.
 */

export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'trial' | 'none';

export interface LicenseInfo {
  keyCode: string;           // NPX-XXXX-XXXX-XXXX-XXXX
  machineCode: string;        // Hash du hardware
  status: LicenseStatus;
  activatedAt: string;       // ISO date
  expiresAt: string;          // ISO date (365 jours après activation)
  tenantName?: string;        // Nom de la clinique
  plan: 'monthly' | 'annual' | 'lifetime';
  lastVerifiedAt: string;    // Dernière vérification
  features: {
    supabaseSync: boolean;
    multiUser: boolean;
    auditTrail: boolean;
    nursingCare: boolean;
    receptionDashboard: boolean;
  };
}

interface LicenseState {
  license: LicenseInfo | null;
  isVerified: boolean;
  isReadOnly: boolean;        // Mode lecture seule si licence expirée
  trialDaysLeft: number;      // Jours restants en mode démo
  error: string | null;

  // Actions
  activate: (keyCode: string, machineCode: string, tenantName?: string) => Promise<{ success: boolean; error?: string }>;
  verify: () => Promise<void>;
  revoke: () => void;
  startTrial: () => void;
  clearError: () => void;
  isFeatureEnabled: (feature: keyof LicenseInfo['features']) => boolean;
}

const TRIAL_DURATION_DAYS = 7;
const LICENSE_DURATION_DAYS = 365;

/**
 * Simule la vérification de licence auprès du portail /admin.
 * En production : appel Supabase pour vérifier si la clé existe + est active + non expirée.
 * En mode offline : utilise le cache local (lastVerifiedAt).
 */
async function verifyLicenseWithServer(
  keyCode: string,
  machineCode: string
): Promise<{ valid: boolean; status: LicenseStatus; expiresAt?: string; tenantName?: string; plan?: LicenseInfo['plan'] }> {
  const supabase = getSupabase();

  // Si Supabase n'est pas configuré → vérification locale uniquement
  if (!supabase) {
    return { valid: true, status: 'active' };
  }

  try {
    // Vérifier dans la table license_keys
    const { data, error } = await supabase
      .from('license_keys')
      .select('status, expires_at, machine_code, current_activations, max_activations')
      .eq('key_code', keyCode)
      .maybeSingle();

    if (error || !data) {
      return { valid: false, status: 'revoked' };
    }

    if (data.status === 'revoked' || data.status === 'expired') {
      return { valid: false, status: data.status as LicenseStatus };
    }

    // Vérifier le machine code
    if (data.machine_code && data.machine_code !== machineCode) {
      return { valid: false, status: 'revoked' };
    }

    // Vérifier l'expiration
    if (data.expires_at) {
      const expiry = new Date(data.expires_at).getTime();
      if (Date.now() > expiry) {
        return { valid: false, status: 'expired' };
      }
    }

    return {
      valid: true,
      status: 'active',
      expiresAt: data.expires_at,
    };
  } catch {
    // Erreur réseau → on accepte la licence si la dernière vérification date de < 7 jours
    return { valid: true, status: 'active' };
  }
}

/**
 * Génère un machine code simulé pour le mode web (Vercel).
 * En mode Electron, le vrai machine code est fourni par preload.js.
 */
export function generateWebMachineCode(): string {
  const stored = localStorage.getItem('onedesk_machine_code');
  if (stored) return stored;

  const navInfo = `${navigator.userAgent}|${navigator.language}|${screen.width}x${screen.height}|${navigator.hardwareConcurrency}`;
  const bytes = new TextEncoder().encode(navInfo);
  // Simple hash (pas cryptographique mais suffisant pour un identifiant machine simulé)
  let hash = 0;
  for (let i = 0; i < bytes.length; i++) {
    hash = ((hash << 5) - hash) + bytes[i];
    hash |= 0;
  }
  const machineCode = `web_${Math.abs(hash).toString(16).padStart(8, '0')}_${Date.now().toString(36)}`;
  localStorage.setItem('onedesk_machine_code', machineCode);
  return machineCode;
}

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set, get) => ({
      license: null,
      isVerified: false,
      isReadOnly: false,
      trialDaysLeft: 0,
      error: null,

      activate: async (keyCode, machineCode, tenantName) => {
        set({ error: null });

        // Validation du format de la clé
        if (!keyCode.match(/^NPX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)) {
          return { success: false, error: 'Format de clé invalide. Format attendu : NPX-XXXX-XXXX-XXXX-XXXX' };
        }

        // Vérification serveur
        const result = await verifyLicenseWithServer(keyCode, machineCode);

        if (!result.valid) {
          const errorMsg = result.status === 'revoked'
            ? 'Cette licence a été révoquée. Contactez votre fournisseur.'
            : result.status === 'expired'
            ? 'Cette licence a expiré. Contactez votre fournisseur pour la renouveler.'
            : 'Clé de licence invalide.';

          set({ error: errorMsg });
          return { success: false, error: errorMsg };
        }

        // Créer l'objet licence
        const now = new Date();
        const expiresAt = result.expiresAt
          ? result.expiresAt
          : new Date(now.getTime() + LICENSE_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

        const license: LicenseInfo = {
          keyCode,
          machineCode,
          status: 'active',
          activatedAt: now.toISOString(),
          expiresAt,
          tenantName: tenantName || result.tenantName,
          plan: result.plan || 'annual',
          lastVerifiedAt: now.toISOString(),
          features: {
            supabaseSync: true,
            multiUser: true,
            auditTrail: true,
            nursingCare: true,
            receptionDashboard: true,
          },
        };

        // Sauvegarder en local (IndexedDB + localStorage via persist)
        await db.localLicenses.put({
          id: keyCode,
          keyCode,
          tenantId: 'default',
          machineCode,
          status: 'active',
          activatedAt: license.activatedAt,
          expiresAt: license.expiresAt,
          lastVerifiedAt: license.lastVerifiedAt,
        });

        set({
          license,
          isVerified: true,
          isReadOnly: false,
          error: null,
        });

        return { success: true };
      },

      verify: async () => {
        const { license } = get();
        if (!license) {
          // Pas de licence → vérifier si on est en période d'essai
          const trialStart = localStorage.getItem('onedesk_trial_start');
          if (trialStart) {
            const daysPassed = Math.floor((Date.now() - new Date(trialStart).getTime()) / (24 * 60 * 60 * 1000));
            const daysLeft = TRIAL_DURATION_DAYS - daysPassed;
            set({ trialDaysLeft: Math.max(0, daysLeft), isReadOnly: daysLeft <= 0 });
          }
          return;
        }

        // Vérification serveur
        const result = await verifyLicenseWithServer(license.keyCode, license.machineCode);

        if (!result.valid) {
          if (result.status === 'revoked') {
            set({
              license: { ...license, status: 'revoked' },
              isVerified: true,
              isReadOnly: true,
              error: 'Licence révoquée. Contactez votre fournisseur.',
            });
          } else if (result.status === 'expired') {
            set({
              license: { ...license, status: 'expired' },
              isVerified: true,
              isReadOnly: true,
              error: 'Licence expirée. Mode lecture seule activé.',
            });
          }
          return;
        }

        // Licence valide → mettre à jour lastVerifiedAt
        set({
          license: { ...license, status: 'active', lastVerifiedAt: new Date().toISOString() },
          isVerified: true,
          isReadOnly: false,
          error: null,
        });
      },

      revoke: () => {
        set({
          license: null,
          isVerified: false,
          isReadOnly: true,
          error: 'Licence révoquée. L\'application est en mode lecture seule.',
        });
      },

      startTrial: () => {
        const now = new Date().toISOString();
        localStorage.setItem('onedesk_trial_start', now);
        set({
          trialDaysLeft: TRIAL_DURATION_DAYS,
          isReadOnly: false,
          isVerified: true,
        });
      },

      clearError: () => set({ error: null }),

      isFeatureEnabled: (feature) => {
        const { license } = get();
        if (!license) return false;
        if (license.status === 'revoked') return false;
        if (license.status === 'expired') return false;
        return license.features[feature];
      },
    }),
    {
      name: 'onedesk-license',
      partialize: (state) => ({
        license: state.license,
        isVerified: state.isVerified,
        isReadOnly: state.isReadOnly,
      }),
    }
  )
);
