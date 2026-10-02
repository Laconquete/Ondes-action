; ============================================================================
;  Inno Setup Script — OneDesk Clinique v1.2.0
; ----------------------------------------------------------------------------
;  Produit un installeur .exe STANDALONE (per-machine, Program Files) avec
;  compression LZMA. À compiler avec Inno Setup 6 (`iscc installer.iss`).
;
;  Variables d'environnement attendues (positionnées par la CI) :
;    - APP_BUILD_DIR : dossier contenant le résultat @electron/packager
;                     (ex: docs\devops\out\OneDeskClinique-win32-x64)
;    - APP_VERSION   : version affichée (défaut: 1.2.0)
;
;  Raccourcis : Desktop + Start Menu.
;  Cible : Program Files\OneDesk Clinique (per-machine, nécessite droits admin).
;
;  AVANTAGE par rapport au .exe brut :
;    - L'installeur est moins agressivement signalé par SmartScreen
;      (un setup.exe est reconnu comme "installeur" et bénéficie d'un
;       comportement plus permissif qu'un .exe ordinaire).
;    - Crée automatiquement les raccourcis Desktop + Start Menu.
;    - Ajoute une entrée "Désinstaller" dans le Panneau de configuration.
;    - Compression LZMA ultra (réduit la taille de ~40%).
; ============================================================================

#define AppName          "OneDesk Clinique"
#define AppNameShort     "OneDesk Clinique"
#define AppExeName       "OneDeskClinique.exe"
#define AppPublisher     "Fabricefb / MyEventprod"
#define AppURL           "https://github.com/Laconquete/Ondes-action"
#define AppVersion       GetEnv("APP_VERSION")
#if AppVersion == ""
  #define AppVersion     "1.2.0"
#endif

#ifndef APP_BUILD_DIR
  #define APP_BUILD_DIR  "docs\devops\out\OneDeskClinique-win32-x64"
#endif

[Setup]
; Identité
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}/issues
AppUpdatesURL={#AppURL}/releases
AppCopyright=Copyright (c) 2026 {#AppPublisher}
VersionInfoVersion={#AppVersion}.0
VersionInfoProductVersion={#AppVersion}.0

; Dossier cible per-machine (Program Files)
DefaultDirName={pf}\OneDesk Clinique
DefaultGroupName=OneDesk Clinique
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

; Compression LZMA (max)
Compression=lzma2/ultra64
LZMAUseSeparateProcess=yes
SolidCompression=yes
InternalCompressLevel=ultra64

; Icône de l'installeur + uninstaller
SetupIconFile=..\icon.ico
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName} {#AppVersion}

; Sortie
OutputDir=out\make\innosetup
OutputBaseFilename=OneDeskClinique-Setup-{#AppVersion}
DiskSpanning=no

; Pas de signature Authenticode (free tier — SmartScreen affichera "Éditeur inconnu"
; mais l'utilisateur peut cliquer "Plus d'infos" > "Exécuter quand même")
; NOTE : ne pas mettre SignTool= vide, ça provoque une erreur de compilation Inno Setup.

; Ne pas demander le dossier de destination (utilise DefaultDirName)
DisableDirPage=yes

; NOTE : WizardImageFile attend des .bmp en 164x314, pas des .ico.
; Pour garder un build simple, on retire cette directive (l'icône par défaut
; Inno Setup sera utilisée pour l'assistant, mais SetupIconFile reste pour
; l'icône de l'installeur dans la barre des tâches).

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le Bureau"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce
Name: "startup"; Description: "Lancer OneDesk au démarrage de Windows"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Le dossier packagé par @electron/packager (out/OneDeskClinique-win32-x64/*)
Source: "{#APP_BUILD_DIR}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Start Menu
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"; IconFilename: "{app}\{#AppExeName}"
Name: "{group}\Désinstaller {#AppName}"; Filename: "{uninstallexe}"
; Desktop (optionnel via task desktopicon)
Name: "{commondesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; IconFilename: "{app}\{#AppExeName}"; Tasks: desktopicon
; Startup (optionnel via task startup)
Name: "{commonstartup}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: startup

[Run]
; Lance l'app après install (optionnel — l'utilisateur peut décocher)
Filename: "{app}\{#AppExeName}"; Description: "Lancer {#AppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
