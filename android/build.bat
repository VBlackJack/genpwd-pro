@echo off
REM Script de compilation de l'APK debug
echo ========================================
echo   GenPwd Pro - Compilation APK Debug
echo ========================================
echo.

REM Verifier que gradlew existe
if not exist "gradlew.bat" (
    echo ERREUR: gradlew.bat introuvable!
    echo Assurez-vous d'etre dans le dossier android/
    pause
    exit /b 1
)

echo [1/3] Nettoyage du projet...
call gradlew.bat clean
if errorlevel 1 (
    echo ERREUR lors du nettoyage!
    pause
    exit /b 1
)

echo.
echo [2/3] Compilation de l'APK...
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo ERREUR lors de la compilation!
    pause
    exit /b 1
)

echo.
echo [3/3] Verification...
if exist "app\build\outputs\apk\debug\app-debug.apk" (
    echo.
    echo ========================================
    echo   SUCCES! APK genere avec succes
    echo ========================================
    echo.
    echo L'APK se trouve dans:
    echo app\build\outputs\apk\debug\app-debug.apk
    echo.
    echo Taille du fichier:
    for %%A in (app\build\outputs\apk\debug\app-debug.apk) do echo %%~zA octets
    echo.
    echo Vous pouvez maintenant:
    echo - Installer sur un appareil: install.bat
    echo - Copier l'APK ailleurs
    echo.
) else (
    echo ERREUR: L'APK n'a pas ete genere!
)

pause
