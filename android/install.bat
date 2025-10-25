@echo off
REM Script d'installation de l'APK sur un appareil
echo ========================================
echo   GenPwd Pro - Installation APK
echo ========================================
echo.

REM Verifier que l'APK existe
if not exist "app\build\outputs\apk\debug\app-debug.apk" (
    echo ERREUR: L'APK n'existe pas!
    echo Executez d'abord build.bat pour compiler l'application.
    pause
    exit /b 1
)

REM Verifier que ADB est accessible
where adb >nul 2>&1
if errorlevel 1 (
    echo AVERTISSEMENT: ADB n'est pas dans le PATH
    echo Tentative d'utilisation via Gradle...
    echo.
    call gradlew.bat installDebug
    if errorlevel 1 (
        echo ERREUR lors de l'installation!
        echo.
        echo Assurez-vous que:
        echo - Un appareil Android est connecte en USB
        echo - Le debogage USB est active
        echo - Les pilotes USB sont installes
        pause
        exit /b 1
    )
    goto success
)

REM Verifier qu'un appareil est connecte
echo Recherche d'appareils connectes...
adb devices | findstr /R /C:"device$" >nul
if errorlevel 1 (
    echo ERREUR: Aucun appareil Android detecte!
    echo.
    echo Verifiez que:
    echo - Votre appareil est connecte en USB
    echo - Le debogage USB est active
    echo - Les pilotes USB sont installes
    echo.
    echo Appareils detectes:
    adb devices
    pause
    exit /b 1
)

echo Appareil(s) detecte(s):
adb devices
echo.

echo Installation de l'APK...
adb install -r app\build\outputs\apk\debug\app-debug.apk
if errorlevel 1 (
    echo ERREUR lors de l'installation!
    pause
    exit /b 1
)

:success
echo.
echo ========================================
echo   SUCCES! Application installee
echo ========================================
echo.
echo L'application GenPwd Pro est maintenant installee sur votre appareil.
echo Vous pouvez la lancer depuis le lanceur d'applications.
echo.
pause
