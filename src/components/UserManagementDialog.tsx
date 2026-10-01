import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Users,
  Trash2,
  Shield,
  Loader2,
  CheckCircle2,
  Mail,
  Lock,
  Stethoscope,
  Activity,
  UserCheck,
  Building2,
} from 'lucide-react';
import { AppUser, UserRole } from '../types/clinical';
import { db, LocalUser } from '../services/localDatabase';
import { hashPasswordForSeed } from '../stores/authStore';
import { getSupabase } from '../services/supabaseClient';
import { toast } from '../stores/toastStore';

interface UserManagementDialogProps {
  currentUser: AppUser;
  onClose: () => void;
}

/**
 * UserManagementDialog — Gestion des utilisateurs par l'admin.
 *
 * Permet à l'admin (ou directeur médical) de :
 *  1. Créer de nouveaux utilisateurs (médecin, infirmière, réceptionniste, etc.)
 *  2. Attribuer un rôle à chaque utilisateur
 *  3. Activer/désactiver un compte
 *  4. Voir la liste de tous les utilisateurs
 *
 * En mode Supabase : crée l'utilisateur via supabase.auth.admin.createUser()
 *   → puis INSERT dans public.users avec le rôle et le tenant
 * En mode offline (démo) : crée l'utilisateur en local (IndexedDB)
 */
export const UserManagementDialog: React.FC<UserManagementDialogProps> = ({
  currentUser,
  onClose,
}) => {
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Formulaire de création
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('doctor');
  const [newDepartment, setNewDepartment] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const supabase = getSupabase();
  const useSupabaseAuth = supabase !== null;

  // Charger les utilisateurs
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const localUsers = await db.localUsers.toArray();
      setUsers(localUsers.sort((a, b) => a.displayName.localeCompare(b.displayName)));
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newEmail.trim() || !newPassword.trim() || !newDisplayName.trim()) {
      toast.warning('Champs requis', 'Email, mot de passe et nom sont obligatoires.');
      return;
    }
    if (newPassword.length < 6) {
      toast.warning('Mot de passe trop court', 'Minimum 6 caractères.');
      return;
    }

    setIsCreating(true);
    try {
      const username = newEmail.trim().toLowerCase();
      const tenantId = 'demo-tenant-001';

      // En mode Supabase : créer via Supabase Auth
      if (useSupabaseAuth && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: newEmail.trim(),
          password: newPassword,
          options: {
            data: { full_name: newDisplayName.trim() },
          },
        });

        if (error) {
          toast.error('Erreur Supabase', error.message);
          setIsCreating(false);
          return;
        }

        // Créer le profil dans public.users
        if (data.user) {
          await supabase.from('users').insert({
            auth_user_id: data.user.id,
            tenant_id: tenantId,
            email: newEmail.trim(),
            username,
            display_name: newDisplayName.trim(),
            role: newRole,
            department: newDepartment.trim() || 'À confirmer',
            service_code: 'PENDING',
            is_active: true,
          });
        }
      }

      // Créer aussi en local (cache offline)
      const salt = Math.random().toString(36).substring(2, 12);
      const passwordHash = await hashPasswordForSeed(newPassword, salt);

      const newUser: LocalUser = {
        id: `usr_${username.replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`,
        tenantId,
        username,
        email: newEmail.trim(),
        displayName: newDisplayName.trim(),
        role: newRole,
        department: newDepartment.trim() || 'À confirmer',
        serviceCode: 'PENDING',
        isActive: true,
        passwordHash,
        salt,
      };

      await db.localUsers.put(newUser);
      await loadUsers();

      toast.success('Utilisateur créé', `${newDisplayName} (${newRole}) a été créé avec succès.`);

      // Reset form
      setNewEmail('');
      setNewPassword('');
      setNewDisplayName('');
      setNewRole('doctor');
      setNewDepartment('');
      setShowCreateForm(false);
    } catch (err) {
      toast.error('Erreur', 'Impossible de créer l\'utilisateur.');
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    await db.localUsers.update(userId, { isActive: !currentActive });
    await loadUsers();
    toast.info(
      !currentActive ? 'Compte activé' : 'Compte désactivé',
      `L'utilisateur a été ${!currentActive ? 'activé' : 'désactivé'}.`
    );
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (userId === currentUser.id) {
      toast.warning('Action interdite', 'Vous ne pouvez pas supprimer votre propre compte.');
      return;
    }
    if (!confirm(`Supprimer définitivement ${userName} ?`)) return;
    await db.localUsers.delete(userId);
    await loadUsers();
    toast.success('Utilisateur supprimé', `${userName} a été supprimé.`);
  };

  const roleConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    doctor: { label: 'Médecin', icon: Stethoscope, color: 'text-blue-600 dark:text-blue-400' },
    nurse: { label: 'Infirmier', icon: Activity, color: 'text-rose-600 dark:text-rose-400' },
    receptionist: { label: 'Accueil', icon: UserCheck, color: 'text-emerald-600 dark:text-emerald-400' },
    auditor: { label: 'Auditeur', icon: Shield, color: 'text-slate-600 dark:text-slate-400' },
    security_admin: { label: 'Sécurité SI', icon: Shield, color: 'text-slate-600 dark:text-slate-400' },
    medical_director: { label: 'Directeur', icon: Shield, color: 'text-indigo-600 dark:text-indigo-400' },
    admin: { label: 'Admin', icon: Shield, color: 'text-red-600 dark:text-red-400' },
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto animate-fadeInScale">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Gestion des utilisateurs
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {users.length} utilisateur(s) · {users.filter(u => u.isActive).length} actif(s)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Bouton créer */}
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Créer un nouvel utilisateur
            </button>
          )}

          {/* Formulaire de création */}
          {showCreateForm && (
            <div className="p-4 border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 space-y-3 animate-fadeIn">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                Nouvel utilisateur
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Nom complet *</label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="Dr. Jean Mukendi"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Email *</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="jean.mukendi@clinique.fr"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Mot de passe *</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Département</label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="Cardiologie"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Rôle *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(roleConfig) as [string, { label: string; icon: React.ElementType; color: string }][]).map(([role, config]) => {
                    const Icon = config.icon;
                    const isSelected = newRole === role;
                    return (
                      <button
                        key={role}
                        onClick={() => setNewRole(role as UserRole)}
                        className={`flex flex-col items-center gap-1 p-2 border-2 transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-2 text-xs font-bold transition-colors"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Créer l'utilisateur
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Liste des utilisateurs */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => {
                const config = roleConfig[user.role] || roleConfig.doctor;
                const Icon = config.icon;
                return (
                  <div
                    key={user.id}
                    className={`flex items-center gap-3 p-3 border ${
                      user.isActive
                        ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 opacity-60'
                    }`}
                  >
                    {/* Avatar initiales */}
                    <div className={`flex h-9 w-9 items-center justify-center shrink-0 ${
                      user.isActive ? 'bg-blue-600' : 'bg-slate-400'
                    } text-white font-bold text-[10px]`}>
                      {user.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {user.displayName}
                        </span>
                        {user.id === currentUser.id && (
                          <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60 px-1.5 py-0.5">
                            VOUS
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                        <Icon className={`h-3 w-3 ${config.color}`} />
                        <span>{config.label}</span>
                        <span>·</span>
                        <span className="truncate">{user.email || user.username}</span>
                      </div>
                      {user.department && (
                        <div className="text-[9px] text-slate-400 mt-0.5">{user.department}</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Activer/désactiver */}
                      <button
                        onClick={() => handleToggleActive(user.id, user.isActive)}
                        className={`p-1.5 transition-colors ${
                          user.isActive
                            ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={user.isActive ? 'Désactiver' : 'Activer'}
                      >
                        <UserCheck className="h-4 w-4" />
                      </button>
                      {/* Supprimer */}
                      <button
                        onClick={() => handleDelete(user.id, user.displayName)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
            🔒 {useSupabaseAuth
              ? 'Les nouveaux utilisateurs sont créés dans Supabase Auth + cache local'
              : 'Mode démo — les utilisateurs sont créés en local uniquement (IndexedDB)'}
          </p>
        </div>
      </div>
    </div>
  );
};
