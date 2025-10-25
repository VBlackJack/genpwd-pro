@echo off
REM Script de nettoyage du projet
echo ========================================
echo   GenPwd Pro - Nettoyage
echo ========================================
echo.

if not exist "gradlew.bat" (
    echo ERREUR: gradlew.bat introuvable!
    pause
    exit /b 1
)

echo Nettoyage des fichiers de build...
call gradlew.bat clean
if errorlevel 1 (
    echo ERREUR lors du nettoyage!
    pause
    exit /b 1
)

echo.
echo Suppression des caches Gradle...
if exist ".gradle" (
    echo Suppression de .gradle\
    rmdir /s /q .gradle
)

if exist "app\build" (
    echo Suppression de app\build\
    rmdir /s /q app\build
)

if exist "build" (
    echo Suppression de build\
    rmdir /s /q build
)

echo.
echo ========================================
echo   Nettoyage termine!
echo ========================================
echo.
echo Le projet a ete nettoye.
echo Executez build.bat pour recompiler.
echo.
pause
