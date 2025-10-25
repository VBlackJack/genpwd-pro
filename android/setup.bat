@echo off
REM Script d'initialisation du projet
echo ========================================
echo   GenPwd Pro - Configuration initiale
echo ========================================
echo.

echo Ce script va preparer le projet Android pour la compilation.
echo.

REM Verifier Java
echo [1/5] Verification de Java...
where java >nul 2>&1
if errorlevel 1 (
    echo ERREUR: Java n'est pas installe ou pas dans le PATH!
    echo.
    echo Telechargez et installez Java JDK 17 ou superieur:
    echo https://adoptium.net/
    echo.
    pause
    exit /b 1
)

echo Version de Java detectee:
java -version 2>&1
echo.

REM Extraire la version de Java
for /f "tokens=3" %%g in ('java -version 2^>^&1 ^| findstr /i "version"') do (
    set JAVA_VERSION=%%g
)
set JAVA_VERSION=%JAVA_VERSION:"=%
for /f "delims=. tokens=1-2" %%v in ("%JAVA_VERSION%") do (
    set JAVA_MAJOR=%%v
    if "%%v"=="1" set JAVA_MAJOR=%%w
)

echo Version majeure de Java: %JAVA_MAJOR%
echo.

REM Verifier que Java >= 17 (minimum 11)
if %JAVA_MAJOR% LSS 11 (
    echo ========================================
    echo   ERREUR: Java version incompatible!
    echo ========================================
    echo.
    echo Votre version: Java %JAVA_MAJOR%
    echo Version requise: Java 11 minimum (Java 17 recommande^)
    echo.
    echo Android Gradle Plugin 8.1.2 necessite Java 11+
    echo.
    echo SOLUTION:
    echo 1. Telechargez Java 17 (recommande^):
    echo    https://adoptium.net/temurin/releases/?version=17
    echo.
    echo 2. Installez-le
    echo.
    echo 3. Ajoutez-le au PATH ou definissez JAVA_HOME:
    echo    set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.x.x
    echo    set PATH=%%JAVA_HOME%%\bin;%%PATH%%
    echo.
    pause
    exit /b 1
)

if %JAVA_MAJOR% LSS 17 (
    echo AVERTISSEMENT: Java %JAVA_MAJOR% detecte
    echo Java 17 est recommande pour de meilleures performances.
    echo.
    set /p continue="Continuer avec Java %JAVA_MAJOR%? (O/N): "
    if /i not "%continue%"=="O" exit /b 0
    echo.
)

echo Java %JAVA_MAJOR% OK - Compatible!
echo.

REM Verifier Android SDK
echo [2/5] Verification de Android SDK...
if defined ANDROID_HOME (
    echo Android SDK trouve: %ANDROID_HOME%
) else (
    echo AVERTISSEMENT: Variable ANDROID_HOME non definie!
    echo.
    echo Si vous n'avez pas Android Studio:
    echo 1. Installez Android Studio: https://developer.android.com/studio
    echo 2. Ouvrez Android Studio et installez les SDK
    echo 3. Definissez ANDROID_HOME dans les variables d'environnement
    echo.
    set /p continue="Continuer quand meme? (O/N): "
    if /i not "%continue%"=="O" exit /b 0
)
echo.

REM Creer le gradle wrapper s'il n'existe pas
echo [3/5] Configuration de Gradle Wrapper...
if not exist "gradlew.bat" (
    echo Gradle wrapper introuvable, generation...
    if exist "gradle\wrapper\gradle-wrapper.properties" (
        echo Fichier de configuration trouve.
    ) else (
        echo Creation de la configuration Gradle wrapper...
        mkdir gradle\wrapper 2>nul

        echo distributionBase=GRADLE_USER_HOME > gradle\wrapper\gradle-wrapper.properties
        echo distributionPath=wrapper/dists >> gradle\wrapper\gradle-wrapper.properties
        echo distributionUrl=https\://services.gradle.org/distributions/gradle-8.7-bin.zip >> gradle\wrapper\gradle-wrapper.properties
        echo zipStoreBase=GRADLE_USER_HOME >> gradle\wrapper\gradle-wrapper.properties
        echo zipStorePath=wrapper/dists >> gradle\wrapper\gradle-wrapper.properties
    )
) else (
    echo Gradle wrapper deja present.
)
echo.

REM Verifier la connexion internet
echo [4/5] Verification de la connexion internet...
ping -n 1 google.com >nul 2>&1
if errorlevel 1 (
    echo AVERTISSEMENT: Impossible de verifier la connexion internet.
    echo Gradle aura besoin d'internet pour telecharger les dependances.
) else (
    echo Connexion internet OK.
)
echo.

REM Premier build pour telecharger les dependances
echo [5/5] Telechargement des dependances...
echo Cela peut prendre plusieurs minutes lors de la premiere execution...
echo.
if exist "gradlew.bat" (
    call gradlew.bat tasks --quiet
    if errorlevel 1 (
        echo ERREUR lors du telechargement des dependances!
        echo Verifiez votre connexion internet et reessayez.
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo   Configuration terminee!
echo ========================================
echo.
echo Vous pouvez maintenant:
echo - build.bat      : Compiler l'APK
echo - install.bat    : Installer sur un appareil
echo - test.bat       : Lancer les tests
echo - clean.bat      : Nettoyer le projet
echo - release.bat    : Compiler la version release
echo.
echo Pour ouvrir le projet dans Android Studio:
echo File ^> Open ^> Selectionnez le dossier android/
echo.
pause
