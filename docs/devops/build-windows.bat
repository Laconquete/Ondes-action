@echo off
REM ============================================================
REM ONEDESK CLINIQUE v1.0.0 — Build Windows .exe
REM ============================================================
REM Ce script construit le .exe Windows autonome sur votre PC.
REM Prérequis : Node.js 22+ installé (https://nodejs.org)
REM ============================================================

echo.
echo ===================================================
echo   OneDesk Clinique v1.0.0 — Build Windows
echo   By Fabricefb / MyEventprod
echo ===================================================
echo.

REM Vérifier Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe.
    echo Telechargez-le sur https://nodejs.org (version LTS 22+)
    pause
    exit /b 1
)

echo [1/6] Clonage du depot...
git clone https://github.com/mesappfb-maker/ONDESK.git onedesk-build
cd onedesk-build

echo [2/6] Installation des dependances...
call npm install

echo [3/6] Construction du frontend Vite...
call npm run build

echo [4/6] Installation d'Electron Forge...
call npm install --save-dev @electron-forge/cli @electron-forge/maker-squirrel @electron-forge/maker-wix
call npx electron-forge import

echo [5/6] Copie des fichiers Electron...
xcopy /E /I /Y docs\devops\electron electron
copy /Y docs\devops\forge.config.js forge.config.js
copy /Y docs\devops\icon.ico icon.ico

echo [6/6] Compilation du .exe Windows...
call npx electron-forge make --platform=win32 --arch=x64

echo.
echo ===================================================
echo   BUILD TERMINE !
echo   Le .exe est dans : out\make\squirrel.windows\x64\
echo   Fichier : OneDesk-Clinique-1.0.0 Setup.exe
echo ===================================================
echo.
pause
