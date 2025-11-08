@echo off
REM ============================================================================
REM auto-build.bat - Build automatique avec incrementation de version
REM GenPwd Pro - Android
REM Version: 2.0 - Enhanced with better APK detection and verification
REM ============================================================================
setlocal enabledelayedexpansion

echo ========================================
echo   GenPwd Pro - Auto Build v2.0
echo ========================================
echo.

REM Verifier que nous sommes dans le bon dossier
if not exist "app\build.gradle.kts" (
    echo ERREUR: Fichier app\build.gradle.kts introuvable!
    echo Assurez-vous d'etre dans le dossier android/
    pause
    exit /b 1
)

if not exist "version-helper.ps1" (
    echo ERREUR: Fichier version-helper.ps1 introuvable!
    echo Assurez-vous que tous les fichiers sont presents.
    pause
    exit /b 1
)

REM Demander le type de build
echo Choisissez le type de build:
echo 1. Debug (genpwd-pro-vX.X.X-alpha.X-debug.apk)
echo 2. Release (genpwd-pro-vX.X.X-alpha.X-release.apk)
echo.
set /p BUILD_TYPE="Votre choix (1 ou 2): "

if "%BUILD_TYPE%"=="1" (
    set GRADLE_TASK=assembleDebug
    set BUILD_NAME=debug
) else if "%BUILD_TYPE%"=="2" (
    set GRADLE_TASK=assembleRelease
    set BUILD_NAME=release
) else (
    echo Choix invalide!
    pause
    exit /b 1
)

REM Options additionnelles
echo.
echo Options additionnelles:
echo.
set /p RUN_LINT="Executer lint avant build? (O/N, defaut: N): "
if /i "%RUN_LINT%"=="" set RUN_LINT=N

set /p RUN_TESTS="Executer les tests unitaires? (O/N, defaut: N): "
if /i "%RUN_TESTS%"=="" set RUN_TESTS=N

set /p COPY_TO_DIST="Copier l'APK vers le dossier dist/? (O/N, defaut: O): "
if /i "%COPY_TO_DIST%"=="" set COPY_TO_DIST=O

echo.
echo ========================================
echo   Etape 1/5: Lecture de la version
echo ========================================
echo.

REM Lire la version actuelle avec le script PowerShell
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0version-helper.ps1" -Action GetVersionCode 2^>^&1`) do set CURRENT_VERSION_CODE=%%i
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0version-helper.ps1" -Action GetVersionName 2^>^&1`) do set CURRENT_VERSION_NAME=%%i

if not defined CURRENT_VERSION_CODE (
    echo ERREUR: Impossible de lire versionCode!
    echo Verifiez que le fichier version-helper.ps1 est present.
    pause
    exit /b 1
)

if not defined CURRENT_VERSION_NAME (
    echo ERREUR: Impossible de lire versionName!
    echo Verifiez que le fichier version-helper.ps1 est present.
    pause
    exit /b 1
)

echo Version actuelle:
echo   versionCode: %CURRENT_VERSION_CODE%
echo   versionName: %CURRENT_VERSION_NAME%
echo.

REM Demander confirmation pour incrementer
set /p CONFIRM="Incrementer la version et builder? (O/N): "
if /i not "%CONFIRM%"=="O" (
    echo Build annule.
    pause
    exit /b 0
)

echo.
echo ========================================
echo   Etape 2/5: Incrementation de version
echo ========================================
echo.

REM Incrementer versionCode
set /a NEW_VERSION_CODE=%CURRENT_VERSION_CODE%+1

REM Incrementer versionName (alpha.X -> alpha.X+1)
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0version-helper.ps1" -Action IncrementAlpha 2^>^&1`) do set NEW_VERSION_NAME=%%i

if not defined NEW_VERSION_NAME (
    echo ERREUR: Impossible d'incrementer la version!
    pause
    exit /b 1
)

echo Nouvelle version:
echo   versionCode: %NEW_VERSION_CODE%
echo   versionName: %NEW_VERSION_NAME%
echo.

REM Mettre a jour le fichier build.gradle.kts
echo Mise a jour de build.gradle.kts...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0version-helper.ps1" -Action UpdateVersions -NewVersionCode %NEW_VERSION_CODE% -NewVersionName "%NEW_VERSION_NAME%"

if errorlevel 1 (
    echo ERREUR lors de la mise a jour du fichier!
    pause
    exit /b 1
)

echo OK - Fichier mis a jour!
echo.

REM Executer lint si demande
if /i "%RUN_LINT%"=="O" (
    echo ========================================
    echo   Etape 3/5: Verification Lint
    echo ========================================
    echo.
    echo Execution de lint...
    call "%~dp0gradlew.bat" lint%BUILD_NAME:~0,1%%BUILD_NAME:~1%
    if errorlevel 1 (
        echo.
        echo ATTENTION: Lint a detecte des problemes!
        echo Voulez-vous continuer quand meme?
        set /p CONTINUE_LINT="Continuer? (O/N): "
        if /i not "!CONTINUE_LINT!"=="O" (
            echo Build annule.
            echo Restauration de l'ancienne version...
            powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0version-helper.ps1" -Action UpdateVersions -NewVersionCode %CURRENT_VERSION_CODE% -NewVersionName "%CURRENT_VERSION_NAME%"
            pause
            exit /b 1
        )
    ) else (
        echo Lint: OK
    )
    echo.
) else (
    echo ========================================
    echo   Etape 3/5: Verification Lint (IGNOREE)
    echo ========================================
    echo.
)

REM Executer les tests si demande
if /i "%RUN_TESTS%"=="O" (
    echo ========================================
    echo   Etape 4/5: Tests unitaires
    echo ========================================
    echo.
    echo Execution des tests...
    call "%~dp0gradlew.bat" test%BUILD_NAME:~0,1%%BUILD_NAME:~1%UnitTest
    if errorlevel 1 (
        echo.
        echo ERREUR: Des tests ont echoue!
        echo Voulez-vous continuer quand meme?
        set /p CONTINUE_TESTS="Continuer? (O/N): "
        if /i not "!CONTINUE_TESTS!"=="O" (
            echo Build annule.
            echo Restauration de l'ancienne version...
            powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0version-helper.ps1" -Action UpdateVersions -NewVersionCode %CURRENT_VERSION_CODE% -NewVersionName "%CURRENT_VERSION_NAME%"
            pause
            exit /b 1
        )
    ) else (
        echo Tests: OK
    )
    echo.
) else (
    echo ========================================
    echo   Etape 4/5: Tests unitaires (IGNORES)
    echo ========================================
    echo.
)

echo ========================================
echo   Etape 5/5: Compilation de l'APK
echo ========================================
echo.

REM Nettoyer d'abord
echo Nettoyage...
call "%~dp0gradlew.bat" clean
set CLEAN_ERROR=%ERRORLEVEL%
if %CLEAN_ERROR% neq 0 (
    echo ERREUR lors du nettoyage!
    echo Restauration de l'ancienne version...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0version-helper.ps1" -Action UpdateVersions -NewVersionCode %CURRENT_VERSION_CODE% -NewVersionName "%CURRENT_VERSION_NAME%"
    pause
    exit /b 1
)

echo.
echo Compilation en cours (%BUILD_NAME%)...
call "%~dp0gradlew.bat" %GRADLE_TASK%
set BUILD_ERROR=%ERRORLEVEL%
if %BUILD_ERROR% neq 0 (
    echo.
    echo ========================================
    echo   ERREUR lors de la compilation!
    echo ========================================
    echo.
    echo Restauration de l'ancienne version...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0version-helper.ps1" -Action UpdateVersions -NewVersionCode %CURRENT_VERSION_CODE% -NewVersionName "%CURRENT_VERSION_NAME%"
    if errorlevel 1 (
        echo ATTENTION: Impossible de restaurer l'ancienne version!
        echo Version actuelle dans le fichier: %NEW_VERSION_CODE% / %NEW_VERSION_NAME%
        echo Version a restaurer manuellement: %CURRENT_VERSION_CODE% / %CURRENT_VERSION_NAME%
    ) else (
        echo Version restauree avec succes: %CURRENT_VERSION_CODE% / %CURRENT_VERSION_NAME%
    )
    echo.
    echo Corrigez les erreurs et relancez le build.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Verification et finalisation
echo ========================================
echo.

REM Detecter l'APK genere - Meilleure detection avec pattern matching
set APK_DIR=app\build\outputs\apk\%BUILD_NAME%
set APK_FILE=
set APK_COUNT=0

REM Compter et trouver les APKs
for %%F in ("%APK_DIR%\*.apk") do (
    set /a APK_COUNT+=1
    set APK_FILE=%%F
    set APK_NAME=%%~nxF
)

if %APK_COUNT% equ 0 (
    echo ERREUR: Aucun APK trouve dans %APK_DIR%
    echo.
    echo Verification du dossier de sortie...
    dir "%APK_DIR%" 2>nul
    if errorlevel 1 (
        echo Le dossier de sortie n'existe pas!
    )
    echo.
    pause
    exit /b 1
)

if %APK_COUNT% gtr 1 (
    echo ATTENTION: Plusieurs APKs detectes (%APK_COUNT%)
    echo Utilisation du dernier trouve: %APK_NAME%
    echo.
)

REM Verifier la taille de l'APK
set MIN_SIZE=1000000
for %%A in ("%APK_FILE%") do set APK_SIZE=%%~zA

if %APK_SIZE% lss %MIN_SIZE% (
    echo ATTENTION: L'APK semble trop petit (%APK_SIZE% octets ^< %MIN_SIZE% octets)
    echo L'APK pourrait etre corrompu ou incomplet.
    echo.
    set /p CONTINUE_SMALL="Continuer quand meme? (O/N): "
    if /i not "!CONTINUE_SMALL!"=="O" (
        pause
        exit /b 1
    )
)

REM Verification de signature pour release
if "%BUILD_NAME%"=="release" (
    echo Verification de la signature APK...
    where jarsigner >nul 2>&1
    if errorlevel 1 (
        echo ATTENTION: jarsigner non trouve, impossible de verifier la signature
    ) else (
        jarsigner -verify -verbose -certs "%APK_FILE%" >nul 2>&1
        if errorlevel 1 (
            echo ERREUR: L'APK release n'est pas signe ou la signature est invalide!
            echo Un APK release doit etre signe avant distribution.
            pause
            exit /b 1
        ) else (
            echo Signature: OK
        )
    )
    echo.
)

REM Afficher les informations de l'APK
echo.
echo ========================================
echo   SUCCES! APK genere avec succes
echo ========================================
echo.
echo Version: %NEW_VERSION_NAME% (build %NEW_VERSION_CODE%)
echo Type: %BUILD_NAME%
echo.
echo Fichier: %APK_NAME%
echo Chemin: %APK_FILE%
echo Taille: %APK_SIZE% octets (%APK_SIZE:~0,-6% MB environ)
echo.

REM Copier vers le dossier dist si demande
if /i "%COPY_TO_DIST%"=="O" (
    set DIST_DIR=dist
    if not exist "!DIST_DIR!" mkdir "!DIST_DIR!"

    set DIST_FILE=!DIST_DIR!\genpwd-pro-v%NEW_VERSION_NAME%-%BUILD_NAME%.apk
    echo Copie vers !DIST_FILE!...
    copy /Y "%APK_FILE%" "!DIST_FILE!" >nul
    if errorlevel 1 (
        echo ATTENTION: Impossible de copier vers le dossier dist
    ) else (
        echo Copie: OK
    )
    echo.
)

REM Generer un rapport de build
set REPORT_FILE=build-report-%NEW_VERSION_NAME%-%BUILD_NAME%.txt
echo Generation du rapport de build...
(
    echo ========================================
    echo   GenPwd Pro - Rapport de Build
    echo ========================================
    echo.
    echo Date: %DATE% %TIME%
    echo Version: %NEW_VERSION_NAME%
    echo Build Code: %NEW_VERSION_CODE%
    echo Type: %BUILD_NAME%
    echo.
    echo ========================================
    echo   Fichier genere
    echo ========================================
    echo.
    echo Nom: %APK_NAME%
    echo Chemin: %APK_FILE%
    echo Taille: %APK_SIZE% octets
    echo.
    echo ========================================
    echo   Options de build
    echo ========================================
    echo.
    echo Lint execute: %RUN_LINT%
    echo Tests executes: %RUN_TESTS%
    echo Copie vers dist: %COPY_TO_DIST%
    echo.
    echo ========================================
    echo   Versions Gradle
    echo ========================================
    echo.
    call "%~dp0gradlew.bat" --version 2^>^&1 | findstr /C:"Gradle" /C:"Kotlin" /C:"JVM"
    echo.
    echo ========================================
    echo   Changements
    echo ========================================
    echo.
    echo Version precedente: %CURRENT_VERSION_NAME% (build %CURRENT_VERSION_CODE%^)
    echo Nouvelle version: %NEW_VERSION_NAME% (build %NEW_VERSION_CODE%^)
    echo.
) > "%REPORT_FILE%"

echo Rapport sauvegarde: %REPORT_FILE%
echo.

echo ========================================
echo   Mise a jour terminee
echo ========================================
echo.
echo Le fichier build.gradle.kts a ete mis a jour avec:
echo   versionCode = %NEW_VERSION_CODE%
echo   versionName = "%NEW_VERSION_NAME%"
echo.
echo Prochaines etapes suggerees:
echo   1. Tester l'APK sur un appareil
if "%BUILD_NAME%"=="debug" (
    echo   2. Si OK, faire un build release
    echo   3. Commiter les changements de version
) else (
    echo   2. Distribuer l'APK signe
    echo   3. Commiter et taguer la version dans git
    echo   4. Mettre a jour les notes de version
)
echo.

pause
