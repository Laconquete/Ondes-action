import React, { useState } from 'react';
import {
  Building2,
  Lock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Database,
  Globe,
  Key,
  ArrowRight,
  ArrowLeft,
  TestTube,
  RefreshCw,
} from 'lucide-react';
import { saveAppConfig, testSupabaseConnection, type AppConfig } from '../services/appConfig';

/**
 * SetupWizard — Écran de configuration post-installation
 * -----------------------------------------------------
 * Affiché AU PREMIER LANCEMENT si appConfig.isConfigured() === false.
 *
 * 3 étapes :
 *   1. Supabase (URL + anon key) + test connexion
 *   2. Google OAuth (optionnel — client ID Google)
 *   3. Identité du tenant + sauvegarde chiffrée
 *
 * Après sauvegarde, l'app redémarre vers le LoginScreen.
 *
 * Vercel est mentionné comme optionnel (URL du portail admin web
 * si déployé séparément). Ce n'est pas bloquant.
 */

type Step = 0 | 1 | 2;

interface WizardState {
  supabaseUrl: string;
  supabaseAnonKey: string;
  googleClientId: string;
  vercelAdminUrl: string;
  tenantId: string;
  tenantName: string;
}

const EMPTY_STATE: WizardState = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  googleClientId: '',
  vercelAdminUrl: '',
  tenantId: '',
  tenantName: '',
};

export const SetupWizard: React.FC<{ onCompleted: () => void }> = ({ onCompleted }) => {
  const [step, setStep] = useState<Step>(0);
  const [state, setState] = useState<WizardState>(EMPTY_STATE);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; latencyMs?: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const update = (field: keyof WizardState, value: string) => {
    setState((prev) => ({ ...prev, [field]: value }));
    setTestResult(null); // Reset test si l'utilisateur modifie un champ
  };

  const handleTestSupabase = async () => {
    setIsTesting(true);
    setTestResult(null);
    const result = await testSupabaseConnection(state.supabaseUrl, state.supabaseAnonKey);
    setTestResult(result);
    setIsTesting(false);
  };

  const handleNext = async () => {
    if (step === 0) {
      // Bloque si Supabase pas testé OK
      if (!testResult?.ok) {
        setSaveError('Testez la connexion Supabase avant de continuer.');
        return;
      }
      setSaveError(null);
      setStep(1);
    } else if (step === 1) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((prev) => (prev - 1) as Step);
  };

  const handleSave = async () => {
    if (!state.tenantId.trim() || !state.tenantName.trim()) {
      setSaveError('L\'identifiant et le nom du tenant sont obligatoires.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);

    try {
      const config: Omit<AppConfig, 'configuredAt' | 'schemaVersion'> = {
        supabaseUrl: state.supabaseUrl.trim(),
        supabaseAnonKey: state.supabaseAnonKey.trim(),
        googleClientId: state.googleClientId.trim() || undefined,
        vercelAdminUrl: state.vercelAdminUrl.trim() || undefined,
        tenantId: state.tenantId.trim(),
        tenantName: state.tenantName.trim(),
        configuredBy: 'setup-wizard',
      };
      await saveAppConfig(config);
      // Petit délai pour que l'utilisateur voie le message de succès
      await new Promise((r) => setTimeout(r, 800));
      onCompleted();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur de sauvegarde inconnue');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-2 w-16 h-16 bg-blue-600 text-white">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Configuration initiale
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            OneDesk Clinique v1.2.0 — Branchez votre backend Supabase
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center mb-6">
          {[0, 1, 2].map((i) => (
            <React.Fragment key={i}>
              <div
                className={`h-2 w-2 rounded-full ${
                  step === i
                    ? 'bg-blue-600'
                    : step > i
                    ? 'bg-emerald-500'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
              {i < 2 && <div className={`h-px w-12 ${step > i ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Carte */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-clinical-lg p-7">
          {/* Étape 0 : Supabase */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-5 w-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Étape 1/3 — Backend Supabase
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Créez un projet gratuit sur{' '}
                <a href="https://supabase.com/dashboard" target="_blank" rel="noopener" className="text-blue-600 underline">
                  supabase.com/dashboard
                </a>
                , puis copiez l'URL et l'anon key (Settings → API).
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  URL Supabase
                </label>
                <input
                  type="url"
                  value={state.supabaseUrl}
                  onChange={(e) => update('supabaseUrl', e.target.value)}
                  placeholder="https://votre-projet.supabase.co"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Anon Key (publique)
                </label>
                <textarea
                  value={state.supabaseAnonKey}
                  onChange={(e) => update('supabaseAnonKey', e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                  Cette clé est publique par design — les politiques RLS protègent vos données.
                </p>
              </div>

              {/* Test connexion */}
              <button
                type="button"
                onClick={handleTestSupabase}
                disabled={isTesting || !state.supabaseUrl || !state.supabaseAnonKey}
                className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 py-2.5 text-sm font-bold border border-slate-300 dark:border-slate-700 transition-colors"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Test en cours…
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4" />
                    Tester la connexion
                  </>
                )}
              </button>

              {testResult && (
                <div
                  className={`p-3 border text-xs ${
                    testResult.ok
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {testResult.ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">
                        {testResult.ok ? 'Connexion réussie' : 'Échec de connexion'}
                      </p>
                      {testResult.ok && testResult.latencyMs != null && (
                        <p className="mt-0.5">Latence : {testResult.latencyMs} ms</p>
                      )}
                      {!testResult.ok && testResult.error && (
                        <p className="mt-0.5">{testResult.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {saveError && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> {saveError}
                </p>
              )}

              <button
                type="button"
                onClick={handleNext}
                disabled={!testResult?.ok}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white py-2.5 text-sm font-bold transition-colors"
              >
                Continuer
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Étape 1 : Google OAuth */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Key className="h-5 w-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Étape 2/3 — Google OAuth (optionnel)
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Active le second facteur Google (connexion en 1 clic). Vous pouvez ignorer cette étape
                — l'authentification locale (PBKDF2) reste fonctionnelle hors-ligne.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Google OAuth Client ID
                </label>
                <input
                  type="text"
                  value={state.googleClientId}
                  onChange={(e) => update('googleClientId', e.target.value)}
                  placeholder="123456789-xxx.apps.googleusercontent.com"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                  Console Google Cloud → APIs &amp; Services → Credentials → OAuth 2.0 Client ID.
                  Configurez l'origine autorisée : <code className="font-mono">https://votre-projet.supabase.co</code>
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  URL Vercel (portail admin web, optionnel)
                </label>
                <input
                  type="url"
                  value={state.vercelAdminUrl}
                  onChange={(e) => update('vercelAdminUrl', e.target.value)}
                  placeholder="https://admin.votre-clinique.vercel.app"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                  Si vous avez déployé le portail /admin séparément sur Vercel. Laissez vide sinon.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 px-4 text-sm font-bold border border-slate-300 dark:border-slate-700 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-sm font-bold transition-colors"
                >
                  Continuer
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Étape 2 : Tenant + sauvegarde */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Étape 3/3 — Identité de l'établissement
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Le tenant est l'identifiant de votre clinique. Il isole vos données des autres
                établissements partageant le même backend Supabase.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Nom de l'établissement
                </label>
                <input
                  type="text"
                  value={state.tenantName}
                  onChange={(e) => update('tenantName', e.target.value)}
                  placeholder="Clinique Saint-Luc de Kinshasa"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Identifiant (slug)
                </label>
                <input
                  type="text"
                  value={state.tenantId}
                  onChange={(e) => update('tenantId', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="clinique-saint-luc"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                  Minuscules, tirets uniquement. Sera utilisé comme clé d'isolation RLS.
                </p>
              </div>

              {/* Récapitulatif */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
                <p className="font-bold text-slate-700 dark:text-slate-300 mb-2">Récapitulatif</p>
                <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Supabase : <span className="font-mono">{state.supabaseUrl || '—'}</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    {state.googleClientId ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    Google OAuth : {state.googleClientId ? 'Configuré' : 'Non (optionnel)'}
                  </li>
                  <li className="flex items-center gap-1.5">
                    {state.vercelAdminUrl ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    Portail Vercel : {state.vercelAdminUrl ? 'Configuré' : 'Non (optionnel)'}
                  </li>
                </ul>
              </div>

              {saveError && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> {saveError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 py-2.5 px-4 text-sm font-bold border border-slate-300 dark:border-slate-700 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-2.5 text-sm font-bold transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sauvegarde chiffrée…
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Sauvegarder &amp; démarrer
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-[10px] text-slate-400 dark:text-slate-600 leading-relaxed">
            🔒 Les identifiants sont chiffrés (AES-GCM 256, clé dérivée du code machine + licence).
            <br />
            Aucune donnée n'est envoyée hors de votre machine avant votre 1ʳᵉ connexion.
          </p>
          <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-2">
            OneDesk Clinique v1.2.0 · Fabricefb / MyEventprod · +243 999 071 754
          </p>
        </div>
      </div>
    </div>
  );
};
