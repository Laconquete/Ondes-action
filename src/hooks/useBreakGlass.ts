import { useState, useCallback } from 'react';
import { BreakGlassEvent, AppUser } from '../types/clinical';

/**
 * useBreakGlass — Gère le bris de glace (accès d'urgence à un dossier patient).
 *
 * Extrait de App.tsx pour isoler la logique critique de sécurité.
 *
 * Architecture :
 *  - activeBreakGlass : état courant (null si inactif)
 *  - isBreakGlassActive : dérivée (vérifie l'expiration)
 *  - confirmBreakGlass : crée l'événement + logge l'audit
 *  - endBreakGlass : termine le bris de glace prématurément
 *
 * Sécurité :
 *  - Durée maximale : 30 minutes (configurable)
 *  - Vérification d'expiration à chaque accès (isBreakGlassActive)
 *  - Audit automatique à la création + à la fin
 */

const BREAK_GLASS_DURATION_MINUTES = 30;

interface UseBreakGlassOptions {
  currentUser: AppUser;
  onAudit?: (action: string, resourceType: string, details: {
    resourceId?: string;
    patientId?: string;
    patientName?: string;
    outcome?: 'allowed' | 'denied' | 'challenged';
    reasonText?: string;
  }) => void;
}

interface BreakGlassState {
  activeBreakGlass: BreakGlassEvent | null;
  isBreakGlassActive: boolean;
  confirmBreakGlass: (patientId: string, patientName: string, justification: string) => void;
  endBreakGlass: () => void;
}

export function useBreakGlass({ currentUser, onAudit }: UseBreakGlassOptions): BreakGlassState {
  const [activeBreakGlass, setActiveBreakGlass] = useState<BreakGlassEvent | null>(null);

  const isBreakGlassActive = !!(
    activeBreakGlass?.active && new Date(activeBreakGlass.expiresAt) > new Date()
  );

  const confirmBreakGlass = useCallback((patientId: string, patientName: string, justification: string) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + BREAK_GLASS_DURATION_MINUTES * 60 * 1000);

    const event: BreakGlassEvent = {
      id: `bg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      requestedAt: now.toISOString(),
      actorUserId: currentUser.id,
      actorName: currentUser.displayName,
      patientId,
      patientName,
      reason: justification,
      active: true,
      expiresAt: expiresAt.toISOString(),
    };

    setActiveBreakGlass(event);
    onAudit?.('BREAK_GLASS_ACTIVATED', 'break_glass_event', {
      resourceId: event.id,
      patientId,
      patientName,
      reasonText: `Bris de glace activé : ${justification} (expire à ${expiresAt.toLocaleString('fr-FR')})`,
    });
  }, [currentUser, onAudit]);

  const endBreakGlass = useCallback(() => {
    if (activeBreakGlass) {
      onAudit?.('BREAK_GLASS_ENDED', 'break_glass_event', {
        resourceId: activeBreakGlass.id,
        patientId: activeBreakGlass.patientId,
        patientName: activeBreakGlass.patientName,
        reasonText: `Fin du bris de glace (durée réelle : ${Math.round((Date.now() - new Date(activeBreakGlass.requestedAt).getTime()) / 1000)}s)`,
      });
    }
    setActiveBreakGlass(null);
  }, [activeBreakGlass, onAudit]);

  return {
    activeBreakGlass,
    isBreakGlassActive,
    confirmBreakGlass,
    endBreakGlass,
  };
}
