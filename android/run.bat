@echo off
REM Script pour compiler et lancer l'application
echo ========================================
echo   GenPwd Pro - Build ^& Run
echo ========================================
echo.

if not exist "gradlew.bat" (
    echo ERREUR: gradlew.bat introuvable!
    echo Executez d'abord setup.bat
    pause
    exit /b 1
)

echo [1/3] Compilation de l'APK...
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo ERREUR lors de la compilation!
    pause
    exit /b 1
)

echo.
echo [2/3] Installation sur l'appareil...
call gradlew.bat installDebug
if errorlevel 1 (
    echo ERREUR lors de l'installation!
    echo Verifiez qu'un appareil est connecte.
    pause
    exit /b 1
)

echo.
echo [3/3] Lancement de l'application...
adb shell am start -n com.julien.genpwdpro/.presentation.MainActivity
if errorlevel 1 (
    echo AVERTISSEMENT: Impossible de lancer automatiquement l'application.
    echo Lancez-la manuellement depuis votre appareil.
) else (
    echo Application lancee!
)

echo.
echo ========================================
echo   Application installee et lancee!
echo ========================================
echo.
pause
