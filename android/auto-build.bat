@echo off
REM ============================================================================
REM auto-build.bat - Build automatique avec incrementation de version
REM GenPwd Pro - Android
REM ============================================================================
setlocal enabledelayedexpansion

echo ========================================
echo   GenPwd Pro - Auto Build
echo ========================================
echo.

REM Verifier que nous sommes dans le bon dossier
if not exist "app\build.gradle.kts" (
    echo ERREUR: Fichier app\build.gradle.kts introuvable!
    echo Assurez-vous d'etre dans le dossier android/
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

echo.
echo ========================================
echo   Etape 1/4: Lecture de la version
echo ========================================
echo.

REM Utiliser PowerShell pour extraire les versions
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$content = Get-Content 'app\build.gradle.kts' -Raw; if ($content -match 'versionCode\s*=\s*(\d+)') { $matches[1] }"`) do set CURRENT_VERSION_CODE=%%i
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$content = Get-Content 'app\build.gradle.kts' -Raw; if ($content -match 'versionName\s*=\s*\"([^\"]+)\"') { $matches[1] }"`) do set CURRENT_VERSION_NAME=%%i

if not defined CURRENT_VERSION_CODE (
    echo ERREUR: Impossible de lire versionCode!
    pause
    exit /b 1
)

if not defined CURRENT_VERSION_NAME (
    echo ERREUR: Impossible de lire versionName!
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
echo   Etape 2/4: Incrementation de version
echo ========================================
echo.

REM Incrementer versionCode
set /a NEW_VERSION_CODE=%CURRENT_VERSION_CODE%+1

REM Incrementer versionName (alpha.X -> alpha.X+1)
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "if ('%CURRENT_VERSION_NAME%' -match '^(.+\-alpha\.)(\d+)$') { $baseVersion = $matches[1]; $alphaNum = [int]$matches[2] + 1; Write-Output ($baseVersion + $alphaNum) } else { Write-Output '%CURRENT_VERSION_NAME%' }"`) do set NEW_VERSION_NAME=%%i

echo Nouvelle version:
echo   versionCode: %NEW_VERSION_CODE%
echo   versionName: %NEW_VERSION_NAME%
echo.

REM Mettre a jour le fichier build.gradle.kts
echo Mise a jour de build.gradle.kts...
powershell -NoProfile -Command ^
    "$content = Get-Content 'app\build.gradle.kts' -Raw; ^
     $content = $content -replace 'versionCode\s*=\s*\d+', 'versionCode = %NEW_VERSION_CODE%'; ^
     $content = $content -replace 'versionName\s*=\s*\"[^\"]+\"', 'versionName = \"%NEW_VERSION_NAME%\"'; ^
     Set-Content 'app\build.gradle.kts' -Value $content -NoNewline"

if errorlevel 1 (
    echo ERREUR lors de la mise a jour du fichier!
    pause
    exit /b 1
)

echo OK - Fichier mis a jour!
echo.

echo ========================================
echo   Etape 3/4: Compilation de l'APK
echo ========================================
echo.

REM Nettoyer d'abord
echo Nettoyage...
call gradlew.bat clean
if errorlevel 1 (
    echo ERREUR lors du nettoyage!
    pause
    exit /b 1
)

echo.
echo Compilation en cours (%BUILD_NAME%)...
call gradlew.bat %GRADLE_TASK%
if errorlevel 1 (
    echo.
    echo ========================================
    echo   ERREUR lors de la compilation!
    echo ========================================
    echo.
    echo La version a ete incrementee mais le build a echoue.
    echo Corrigez les erreurs et relancez le build.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Etape 4/4: Verification
echo ========================================
echo.

REM Detecter l'APK genere
set APK_FILE=
for %%F in (app\build\outputs\apk\%BUILD_NAME%\genpwd-pro-v%NEW_VERSION_NAME%-%BUILD_NAME%.apk) do set APK_FILE=%%F

if defined APK_FILE (
    echo.
    echo ========================================
    echo   SUCCES! APK genere avec succes
    echo ========================================
    echo.
    echo Version: %NEW_VERSION_NAME% (build %NEW_VERSION_CODE%)
    echo.
    echo L'APK se trouve dans:
    echo %APK_FILE%
    echo.
    for %%A in (%APK_FILE%) do (
        set SIZE=%%~zA
        echo Taille: !SIZE! octets
    )
    echo.
    echo Le fichier build.gradle.kts a ete mis a jour avec:
    echo   versionCode = %NEW_VERSION_CODE%
    echo   versionName = "%NEW_VERSION_NAME%"
    echo.
) else (
    echo ERREUR: L'APK n'a pas ete genere!
    echo Chemin attendu: app\build\outputs\apk\%BUILD_NAME%\genpwd-pro-v%NEW_VERSION_NAME%-%BUILD_NAME%.apk
)

echo.
pause
