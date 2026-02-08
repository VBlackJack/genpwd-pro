@echo off
REM ============================================================================
REM build-windows.bat - Script de build Windows pour GenPwd Pro
REM Construit l'exécutable Windows et l'installeur NSIS
REM ============================================================================
setlocal enabledelayedexpansion
title GenPwd Pro - Build Windows

echo.
echo ============================================================
echo   GenPwd Pro v3.1.0 - Build Windows
echo   Creation de l'executable et de l'installeur
echo ============================================================
echo.

REM Vérifier si Node.js est installé
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERREUR] Node.js n'est pas installe
    echo.
    echo Installez Node.js depuis : https://nodejs.org/
    echo Version recommandee : 16.x ou superieur
    echo.
    pause
    exit /b 1
)

REM Afficher la version de Node.js
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js detecte : !NODE_VERSION!

REM Vérifier si npm est installé
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERREUR] npm n'est pas installe
    pause
    exit /b 1
)

echo [OK] npm detecte
echo.

REM Étape 1: Nettoyage
echo [1/4] Nettoyage des builds precedents...
if exist "release" (
    rmdir /s /q "release"
    echo       Dossier release supprime
)
if exist "dist" (
    rmdir /s /q "dist"
    echo       Dossier dist supprime
)
echo [OK] Nettoyage termine
echo.

REM Étape 2: Installation des dépendances
echo [2/4] Installation des dependances...
echo       Ceci peut prendre plusieurs minutes...
set PUPPETEER_SKIP_DOWNLOAD=true
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERREUR] Installation des dependances echouee
    pause
    exit /b 1
)
echo [OK] Dependances installees
echo.

REM Étape 3: Build de l'application web
echo [3/4] Build de l'application web...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERREUR] Build de l'application echoue
    pause
    exit /b 1
)
echo [OK] Application web construite
echo.

REM Étape 4: Build Electron
echo [4/4] Build Electron Windows...
echo       Creation de l'executable et de l'installeur...
echo       Ceci peut prendre 5-10 minutes...
call npm run electron:build:win
if %ERRORLEVEL% neq 0 (
    echo [ERREUR] Build Electron echoue
    pause
    exit /b 1
)
echo [OK] Build Electron termine
echo.

REM Afficher les résultats
echo ============================================================
echo   BUILD TERMINE AVEC SUCCES
echo ============================================================
echo.
echo Les fichiers suivants ont ete crees dans le dossier 'release':
echo.
if exist "release\*.exe" (
    echo [EXE] Executable portable:
    for %%f in (release\*.exe) do echo       - %%f
)
if exist "release\*.zip" (
    echo.
    echo [ZIP] Archive portable:
    for %%f in (release\*.zip) do echo       - %%f
)
if exist "release\win-unpacked" (
    echo.
    echo [DIR] Version non-empaquetee:
    echo       - release\win-unpacked\
)
echo.
echo ============================================================
echo.
echo Pour tester l'application :
echo   1. Allez dans release/win-unpacked/
echo   2. Lancez "GenPwd Pro.exe"
echo.
echo Pour distribuer :
echo   - Utilisez le fichier .exe (installeur)
echo   - Ou le fichier .zip (version portable)
echo.
pause
