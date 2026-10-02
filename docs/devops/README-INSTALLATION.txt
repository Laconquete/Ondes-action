============================================================
  ONEDESK CLINIQUE v1.2.0 — INSTALLATION
  Fabricefb / MyEventprod · +243 999 071 754
============================================================

  ⚠ LECTURE OBLIGATOIRE AVANT DE LANCER L'APPLICATION  ⚠

------------------------------------------------------------
  PROBLÈME 1 : "Invalid file descriptor to ICU data"
------------------------------------------------------------
  CAUSE : Vous avez double-cliqué sur OneDeskClinique.exe
          DEPUIS L'INTÉRIEUR DU ZIP. Windows Explorer permet
          de parcourir un zip comme un dossier, mais Electron
          ne peut pas charger le fichier icudtl.dat depuis
          un zip — il faut EXTRAIRE le zip d'abord.

  SOLUTION :
    1. Clic droit sur OneDeskClinique-v1.2.0-win32-x64.zip
    2. Choisir "Extraire tout..." (ou utiliser 7-Zip/WinRAR)
    3. Extraire vers un dossier (ex: C:\OneDesk)
    4. Aller dans le dossier extrait
    5. Double-cliquer sur OneDeskClinique.exe

------------------------------------------------------------
  PROBLÈME 2 : "Windows a protégé votre PC" (SmartScreen)
------------------------------------------------------------
  CAUSE : L'application n'est pas signée par un certificat
          Authenticode (coûteux, ~300€/an). Windows bloque
          par défaut tout .exe non signé téléchargé.

  SOLUTION :
    1. Dans la fenêtre bleue "Windows a protégé votre PC"
    2. Cliquer sur le lien "Plus d'infos" (en bas à gauche)
    3. Un bouton "Exécuter quand même" apparaît
    4. Cliquer dessus

  POUR ÉVITER CE MESSAGE À L'AVENIR :
    Utilisez l'installeur Inno Setup (OneDeskClinique-Setup-1.2.0.exe)
    au lieu du .exe brut. Les installateurs sont moins
    agressivement signalés par SmartScreen.

------------------------------------------------------------
  PROCÉDURE COMPLÈTE D'INSTALLATION
------------------------------------------------------------

  MÉTHODE RECOMMANDÉE (installeur Inno Setup) :

    1. Téléchargez OneDeskClinique-Setup-1.2.0.exe
       (disponible dans les artifacts du build GitHub Actions)
    2. Double-cliquez sur l'installeur
    3. Si SmartScreen apparaît → "Plus d'infos" → "Exécuter quand même"
    4. Suivez l'assistant d'installation (Next → Next → Install)
    5. Un raccourci "OneDesk Clinique" est créé sur le Bureau
    6. Double-cliquez sur le raccourci pour lancer l'application

  MÉTHODE ALTERNATIVE (.exe portable) :

    1. Téléchargez OneDeskClinique-v1.2.0-win32-x64.zip
    2. EXTRAIRE le zip (NE PAS lancer depuis le zip)
       - Clic droit → "Extraire tout..."
       - Ou avec 7-Zip : "Extraire vers OneDeskClinique-v1.2.0-win32-x64\"
    3. Aller dans le dossier extrait
    4. Double-cliquer sur OneDeskClinique.exe
    5. Si SmartScreen → "Plus d'infos" → "Exécuter quand même"

------------------------------------------------------------
  AU PREMIER LANCEMENT
------------------------------------------------------------
  L'écran de CONFIGURATION INITIALE (SetupWizard) apparaît.
  Vous devez saisir :

    1. URL Supabase       → https://VOTRE_PROJET.supabase.co
    2. Anon Key Supabase  → eyJhbGciOiJIUzI1NiIs... (clé publique)
    3. Google OAuth (optionnel) → Client ID Google Cloud
    4. URL Vercel admin (optionnel)
    5. Nom de l'établissement   → ex: Clinique Saint-Luc
    6. UUID du tenant            → 00000000-0000-0000-0000-000000000010

  → Voir docs/CONFIG-GUIDE.md pour la procédure complète pas-à-pas.

------------------------------------------------------------
  CONFIGURATION REQUISE
------------------------------------------------------------
  - Windows 10 version 1809 ou ultérieur (ou Windows 11)
  - 4 Go de RAM minimum (8 Go recommandé)
  - 500 Mo d'espace disque
  - Connexion internet au 1er lancement (configuration Supabase)
  - Ensuite, l'app fonctionne OFFLINE (données locales IndexedDB)

------------------------------------------------------------
  SUPPORT
------------------------------------------------------------
  WhatsApp : +243 999 071 754
  Email    : fabricefb@myeventprod.com
  GitHub   : https://github.com/Laconquete/Ondes-action/issues

============================================================
  OneDesk Clinique v1.2.0 · Fabricefb / MyEventprod
  Electron 44 · @electron/packager · @electron/fuses
  Runtime durci : ASAR Integrity + OnlyLoadAppFromAsar
============================================================
