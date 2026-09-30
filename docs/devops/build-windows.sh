#!/bin/bash
# ============================================================
# ONEDESK CLINIQUE v1.0.0 — Build Windows .exe
# Script pour Linux/Mac (cross-compilation via Wine)
# Prérequis : Node.js 22+, Wine 8+
# ============================================================

set -e

echo ""
echo "==================================================="
echo "  OneDesk Clinique v1.0.0 — Build Windows"
echo "  By Fabricefb / MyEventprod"
echo "==================================================="
echo ""

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "[ERREUR] Node.js n'est pas installé."
    echo "Installez-le : https://nodejs.org (version LTS 22+)"
    exit 1
fi

# Vérifier Wine (pour cross-compilation)
if ! command -v wine &> /dev/null; then
    echo "[ATTENTION] Wine n'est pas installé."
    echo "Sur Ubuntu/Debian : sudo apt install wine64"
    echo "Sur Mac : brew install --cask --no-quarantine wine-stable"
    echo ""
    echo "Sans Wine, le build Windows ne peut pas fonctionner."
    echo "Solution alternative : utilisez build-windows.bat sur un PC Windows."
    exit 1
fi

echo "[1/6] Clonage du dépôt..."
rm -rf onedesk-build
git clone https://github.com/mesappfb-maker/ONDESK.git onedesk-build
cd onedesk-build

echo "[2/6] Installation des dépendances..."
npm install

echo "[3/6] Construction du frontend Vite..."
npm run build

echo "[4/6] Installation d'Electron Forge..."
npm install --save-dev @electron-forge/cli @electron-forge/maker-squirrel
npx electron-forge import

echo "[5/6] Copie des fichiers Electron..."
cp -r docs/devops/electron/* electron/
cp docs/devops/forge.config.js forge.config.js
cp docs/devops/icon.ico icon.ico

echo "[6/6] Compilation du .exe Windows (via Wine)..."
npx electron-forge make --platform=win32 --arch=x64

echo ""
echo "==================================================="
echo "  BUILD TERMINÉ !"
echo "  Le .exe est dans : out/make/squirrel.windows/x64/"
echo "  Fichier : OneDesk-Clinique-1.0.0 Setup.exe"
echo "==================================================="
