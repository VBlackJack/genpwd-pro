@echo off
REM Script de compilation de la version release
echo ========================================
echo   GenPwd Pro - Build Release
echo ========================================
echo.

if not exist "gradlew.bat" (
    echo ERREUR: gradlew.bat introuvable!
    pause
    exit /b 1
)

echo ATTENTION: Pour generer un APK release signe, vous devez:
echo 1. Avoir un keystore (fichier .jks ou .keystore)
echo 2. Configurer les proprietes de signature dans gradle.properties
echo.
echo Fichier gradle.properties requis:
echo   RELEASE_STORE_FILE=chemin/vers/votre.keystore
echo   RELEASE_STORE_PASSWORD=votre_mot_de_passe
echo   RELEASE_KEY_ALIAS=votre_alias
echo   RELEASE_KEY_PASSWORD=votre_mot_de_passe_cle
echo.

set /p continue="Avez-vous configure le keystore? (O/N): "
if /i not "%continue%"=="O" (
    echo.
    echo Pour creer un keystore, utilisez:
    echo keytool -genkey -v -keystore genpwd-release.keystore -alias genpwd -keyalg RSA -keysize 2048 -validity 10000
    echo.
    pause
    exit /b 0
)

echo.
echo [1/3] Nettoyage...
call gradlew.bat clean

echo.
echo [2/3] Compilation de l'APK release...
call gradlew.bat assembleRelease
if errorlevel 1 (
    echo ERREUR lors de la compilation!
    echo Verifiez la configuration du keystore.
    pause
    exit /b 1
)

echo.
echo [3/3] Verification...
if exist "app\build\outputs\apk\release\app-release.apk" (
    echo.
    echo ========================================
    echo   SUCCES! APK release genere
    echo ========================================
    echo.
    echo L'APK se trouve dans:
    echo app\build\outputs\apk\release\app-release.apk
    echo.
    for %%A in (app\build\outputs\apk\release\app-release.apk) do echo Taille: %%~zA octets
    echo.
    echo Cet APK est signe et pret pour la distribution.
    echo.
) else (
    echo ERREUR: L'APK release n'a pas ete genere!
)

echo.
echo Voulez-vous aussi generer un Android App Bundle (.aab)?
set /p bundle="(recommande pour Google Play) (O/N): "
if /i "%bundle%"=="O" (
    echo.
    echo Generation du bundle...
    call gradlew.bat bundleRelease
    if exist "app\build\outputs\bundle\release\app-release.aab" (
        echo Bundle genere: app\build\outputs\bundle\release\app-release.aab
    )
)

echo.
pause
