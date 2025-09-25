REM ============================================================================
REM start-dev.bat - Script de demarrage Windows (ENCODAGE FIXE)
REM GenPwd Pro v2.5 - Architecture modulaire ES6
REM ============================================================================
@echo off
setlocal enabledelayedexpansion
title GenPwd Pro v2.5 - Dev Server

echo.
echo ========================================
echo   GenPwd Pro v2.5 - Dev Server
echo ========================================
echo.

REM Verifier si Node.js est installe
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [X] Node.js n'est pas installe ou pas dans le PATH
    echo [i] Installez Node.js depuis : https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Afficher la version de Node.js
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js detecte : !NODE_VERSION!

REM Verifier la structure du projet - DETECTION AUTOMATIQUE
set "HTML_FOUND=0"
if exist "index.html" (
    set "HTML_PATH=."
    set "HTML_FOUND=1"
    echo [OK] index.html trouve a la racine
)
if exist "src\index.html" (
    set "HTML_PATH=src"
    set "HTML_FOUND=1"
    echo [OK] index.html trouve dans src/
)

if "!HTML_FOUND!" == "0" (
    echo [X] index.html non trouve
    echo [i] Recherche dans: %CD%
    echo [i] Verifiez que le fichier existe dans le repertoire ou src/
    echo.
    dir /b *.html 2>nul
    if errorlevel 1 (
        echo     Aucun fichier HTML trouve
    ) else (
        echo     Fichiers HTML detectes ci-dessus
    )
    echo.
    pause
    exit /b 1
)

if not exist "tools\dev-server.js" (
    echo [X] dev-server.js non trouve dans tools/
    echo [i] Verifiez la structure du projet
    echo.
    pause
    exit /b 1
)

REM Verifier l'architecture modulaire
set "MODULES_OK=0"
if exist "src\js\app.js" (
    set "MODULES_OK=1"
    echo [OK] Architecture modulaire ES6 detectee
)
if exist "js\app.js" (
    set "MODULES_OK=1" 
    echo [OK] Architecture modulaire detectee (variante)
)

if "!MODULES_OK!" == "0" (
    echo [!] app.js non trouve - structure non-modulaire?
    echo [i] Le serveur tentera quand meme de demarrer
)

echo [OK] Structure du projet validee
echo.

REM Verifier le port 3000
netstat -an | find ":3000" >nul 2>nul
if %ERRORLEVEL% == 0 (
    echo [!] Port 3000 peut etre occupe
    echo.
)

REM Demarrer le serveur
echo ^> Demarrage du serveur de developpement...
echo ^> URL : http://localhost:3000/
echo ^> Mode : Developpement modulaire ES6  
echo ^> Ctrl+C pour arreter
echo.

REM Tentative d'ouverture automatique du navigateur
timeout /t 2 /nobreak >nul
start http://localhost:3000/ >nul 2>nul

REM Lancer le serveur avec gestion d'erreurs (sans argument port)
node tools\dev-server.js
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE% == 0 (
    echo [OK] Serveur arrete proprement
) else (
    echo [X] Erreur execution (code %EXIT_CODE%)
    echo [i] Verifiez les logs ci-dessus
)
echo.
echo Appuyez sur une touche pour fermer...
pause >nul