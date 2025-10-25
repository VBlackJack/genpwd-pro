# Scripts de compilation GenPwd Pro Android

Ce dossier contient des scripts Windows (.bat) pour faciliter le développement et la compilation de l'application Android.

## 🚀 Premier lancement

**Exécutez d'abord `setup.bat`** pour vérifier votre environnement et télécharger les dépendances.

```batch
setup.bat
```

Ce script vérifiera:
- ✅ Installation de Java JDK
- ✅ Configuration d'Android SDK
- ✅ Gradle Wrapper
- ✅ Connexion internet
- ✅ Téléchargement des dépendances

## 📝 Scripts disponibles

### `build.bat` - Compiler l'APK
Compile l'application en mode debug.

```batch
build.bat
```

**Sortie:** `app\build\outputs\apk\debug\app-debug.apk`

---

### `install.bat` - Installer sur un appareil
Installe l'APK compilé sur un appareil Android connecté.

```batch
install.bat
```

**Prérequis:**
- Appareil Android connecté en USB
- Débogage USB activé
- Pilotes USB installés

---

### `run.bat` - Compiler, installer et lancer
Script tout-en-un qui compile, installe et lance l'application.

```batch
run.bat
```

---

### `test.bat` - Exécuter les tests
Menu interactif pour lancer différents types de tests.

```batch
test.bat
```

**Options:**
1. Tests unitaires (rapide, pas d'appareil requis)
2. Tests UI (nécessite un appareil connecté)
3. Tous les tests
4. Tests avec rapport de couverture

---

### `clean.bat` - Nettoyer le projet
Supprime tous les fichiers de build et caches.

```batch
clean.bat
```

Utilise ce script si:
- Le build échoue de manière inexpliquée
- Vous voulez libérer de l'espace disque
- Après avoir changé de branche Git

---

### `release.bat` - Compiler la version release
Génère un APK signé prêt pour la distribution.

```batch
release.bat
```

**Prérequis:** Keystore configuré

**Pour créer un keystore:**
```batch
keytool -genkey -v -keystore genpwd-release.keystore -alias genpwd -keyalg RSA -keysize 2048 -validity 10000
```

**Configuration dans `gradle.properties`:**
```properties
RELEASE_STORE_FILE=../genpwd-release.keystore
RELEASE_STORE_PASSWORD=votre_mot_de_passe
RELEASE_KEY_ALIAS=genpwd
RELEASE_KEY_PASSWORD=votre_mot_de_passe
```

---

## 🔧 Prérequis système

### Obligatoires
- **Windows** 10 ou supérieur
- **Java JDK 17+** ([Télécharger](https://adoptium.net/))
- **Android Studio** ([Télécharger](https://developer.android.com/studio))
  - Ou au minimum: Android SDK Command-line tools

### Optionnels
- **ADB** dans le PATH (inclus avec Android Studio)
- **Git** pour cloner le repository

## 📱 Configuration de l'appareil Android

Pour installer l'application sur votre appareil:

1. **Activer le mode développeur:**
   - Paramètres → À propos du téléphone
   - Appuyez 7 fois sur "Numéro de build"

2. **Activer le débogage USB:**
   - Paramètres → Options pour les développeurs
   - Activer "Débogage USB"

3. **Connecter l'appareil:**
   - Branchez votre appareil en USB
   - Acceptez l'autorisation de débogage sur l'appareil

4. **Vérifier la connexion:**
   ```batch
   adb devices
   ```

## 🏗️ Structure des fichiers générés

```
android/
├── app/build/outputs/
│   ├── apk/
│   │   ├── debug/
│   │   │   └── app-debug.apk          # APK debug (généré par build.bat)
│   │   └── release/
│   │       └── app-release.apk        # APK release signé (généré par release.bat)
│   └── bundle/
│       └── release/
│           └── app-release.aab        # Android App Bundle (pour Google Play)
└── app/build/reports/
    ├── tests/                         # Rapports de tests unitaires
    └── androidTests/                  # Rapports de tests UI
```

## 🐛 Résolution de problèmes

### "gradlew.bat introuvable"
**Solution:** Exécutez `setup.bat` pour générer le Gradle wrapper.

### "Java not found"
**Solution:**
1. Installez Java JDK 17+: https://adoptium.net/
2. Ajoutez Java au PATH système

### "Android SDK not found"
**Solution:**
1. Installez Android Studio
2. Définissez la variable d'environnement ANDROID_HOME:
   ```
   ANDROID_HOME=C:\Users\VotreNom\AppData\Local\Android\Sdk
   ```

### "No connected devices"
**Solution:**
1. Vérifiez que l'appareil est connecté: `adb devices`
2. Activez le débogage USB
3. Installez les pilotes USB de votre appareil

### "Build failed: Could not download dependencies"
**Solution:**
1. Vérifiez votre connexion internet
2. Configurez un proxy si nécessaire dans `gradle.properties`:
   ```properties
   systemProp.http.proxyHost=proxy.example.com
   systemProp.http.proxyPort=8080
   ```

### "Execution failed for task ':app:packageDebug'"
**Solution:**
1. Exécutez `clean.bat`
2. Re-exécutez `build.bat`

## 📊 Workflow typique de développement

```batch
# Premier jour
setup.bat              # Configuration initiale

# Développement quotidien
run.bat                # Compiler et tester rapidement
test.bat               # Lancer les tests avant commit

# Avant de distribuer
clean.bat              # Nettoyer
release.bat            # Compiler la version finale
```

## 🚀 Commandes Gradle avancées

Si vous voulez utiliser Gradle directement:

```batch
# Lister toutes les tâches
gradlew.bat tasks

# Compiler avec logs détaillés
gradlew.bat assembleDebug --stacktrace

# Lancer l'application sur émulateur
gradlew.bat installDebug
adb shell am start -n com.julien.genpwdpro/.presentation.MainActivity

# Générer la documentation
gradlew.bat dokkaHtml

# Analyser les dépendances
gradlew.bat dependencies
```

## 📝 Notes importantes

- ⚠️ **Ne commitez JAMAIS votre keystore dans Git**
- ⚠️ **Gardez vos mots de passe de signature en sécurité**
- 💡 Les builds debug ne nécessitent pas de signature
- 💡 Les fichiers `.apk` debug fonctionnent sur tous les appareils
- 💡 Pour Google Play, utilisez le format `.aab` (Android App Bundle)

## 🆘 Support

En cas de problème:
1. Vérifiez les messages d'erreur dans la console
2. Consultez les logs dans `app/build/outputs/logs/`
3. Exécutez `clean.bat` puis `setup.bat`
4. Ouvrez une issue sur GitHub avec les logs complets
