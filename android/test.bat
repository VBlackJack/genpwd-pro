@echo off
REM Script d'execution des tests
echo ========================================
echo   GenPwd Pro - Execution des tests
echo ========================================
echo.

if not exist "gradlew.bat" (
    echo ERREUR: gradlew.bat introuvable!
    pause
    exit /b 1
)

echo Que souhaitez-vous faire?
echo.
echo 1. Tests unitaires uniquement (rapide)
echo 2. Tests UI uniquement (necessite un appareil)
echo 3. Tous les tests
echo 4. Tests avec rapport de couverture
echo.
set /p choice="Votre choix (1-4): "

if "%choice%"=="1" goto unit_tests
if "%choice%"=="2" goto ui_tests
if "%choice%"=="3" goto all_tests
if "%choice%"=="4" goto coverage
goto invalid

:unit_tests
echo.
echo Execution des tests unitaires...
call gradlew.bat test
goto end

:ui_tests
echo.
echo Execution des tests UI...
echo IMPORTANT: Un appareil ou emulateur doit etre connecte!
pause
call gradlew.bat connectedAndroidTest
goto end

:all_tests
echo.
echo Execution de tous les tests...
call gradlew.bat test connectedAndroidTest
goto end

:coverage
echo.
echo Execution des tests avec couverture...
call gradlew.bat jacocoTestReport
echo.
echo Rapport de couverture genere dans:
echo app\build\reports\jacoco\jacocoTestReport\html\index.html
goto end

:invalid
echo Choix invalide!
pause
exit /b 1

:end
if errorlevel 1 (
    echo.
    echo ========================================
    echo   ECHEC! Des tests ont echoue
    echo ========================================
    echo.
    echo Verifiez les logs ci-dessus pour plus de details.
) else (
    echo.
    echo ========================================
    echo   SUCCES! Tous les tests ont reussi
    echo ========================================
    echo.
    echo Rapports de tests disponibles dans:
    echo app\build\reports\tests\
)
echo.
pause
