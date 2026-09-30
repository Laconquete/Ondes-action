import { useState, useCallback } from 'react';

/**
 * useModals — Centralise l'état d'ouverture des 6 modales de l'app.
 *
 * Extrait de App.tsx pour réduire la pollution du state racine.
 * Chaque modale a son propre state + son setter.
 *
 * Usage :
 *   const modals = useModals();
 *   <button onClick={modals.openPrescription}>Prescrire</button>
 *   {modals.isPrescriptionOpen && <PrescriptionModal onClose={modals.closePrescription} />}
 */

interface ModalsState {
  // États
  isPrescriptionOpen: boolean;
  isSearchOpen: boolean;
  isSyncOpen: boolean;
  isBreakGlassOpen: boolean;
  isReceptionCheckInOpen: boolean;

  // Ouvrir / fermer
  openPrescription: () => void;
  closePrescription: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openSync: () => void;
  closeSync: () => void;
  openBreakGlass: () => void;
  closeBreakGlass: () => void;
  openReceptionCheckIn: () => void;
  closeReceptionCheckIn: () => void;

  // Fermer toutes (pour reset global)
  closeAll: () => void;
}

export function useModals(): ModalsState {
  const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isBreakGlassOpen, setIsBreakGlassOpen] = useState(false);
  const [isReceptionCheckInOpen, setIsReceptionCheckInOpen] = useState(false);

  const openPrescription = useCallback(() => setIsPrescriptionOpen(true), []);
  const closePrescription = useCallback(() => setIsPrescriptionOpen(false), []);
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const openSync = useCallback(() => setIsSyncOpen(true), []);
  const closeSync = useCallback(() => setIsSyncOpen(false), []);
  const openBreakGlass = useCallback(() => setIsBreakGlassOpen(true), []);
  const closeBreakGlass = useCallback(() => setIsBreakGlassOpen(false), []);
  const openReceptionCheckIn = useCallback(() => setIsReceptionCheckInOpen(true), []);
  const closeReceptionCheckIn = useCallback(() => setIsReceptionCheckInOpen(false), []);

  const closeAll = useCallback(() => {
    setIsPrescriptionOpen(false);
    setIsSearchOpen(false);
    setIsSyncOpen(false);
    setIsBreakGlassOpen(false);
    setIsReceptionCheckInOpen(false);
  }, []);

  return {
    isPrescriptionOpen,
    isSearchOpen,
    isSyncOpen,
    isBreakGlassOpen,
    isReceptionCheckInOpen,
    openPrescription,
    closePrescription,
    openSearch,
    closeSearch,
    openSync,
    closeSync,
    openBreakGlass,
    closeBreakGlass,
    openReceptionCheckIn,
    closeReceptionCheckIn,
    closeAll,
  };
}
