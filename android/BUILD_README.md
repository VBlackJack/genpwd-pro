# 🚀 Scripts de Build Android - GenPwd Pro

## 📦 Script principal : `auto-build.bat`

**Script automatique avec incrémentation de version**

### ✨ Fonctionnalités
- ✅ Lit automatiquement la version actuelle depuis `build.gradle.kts`
- ✅ Incrémente `versionCode` (+1)
- ✅ Incrémente le suffixe alpha (ex: `1.2.0-alpha.9` → `1.2.0-alpha.10`)
- ✅ Met à jour `build.gradle.kts` automatiquement
- ✅ Lance le build (debug ou release)
- ✅ Affiche le chemin et la taille de l'APK généré

### 📝 Utilisation

```batch
cd android
auto-build.bat
```

Le script vous demandera :
1. **Type de build** : Debug (1) ou Release (2)
2. **Confirmation** pour incrémenter la version

### 📊 Exemple de sortie

```
Version actuelle:
  versionCode: 11
  versionName: 1.2.0-alpha.9

Nouvelle version:
  versionCode: 12
  versionName: 1.2.0-alpha.10

✅ APK généré: app\build\outputs\apk\debug\genpwd-pro-v1.2.0-alpha.10-debug.apk
```

---

## 🛠️ Autres scripts disponibles

### Configuration initiale
```batch
setup.bat           # Configuration du projet (Java, SDK, dépendances)
```

### Build manuel (sans incrémentation)
```batch
build.bat           # Build APK debug (version actuelle)
release.bat         # Build APK release + AAB (version actuelle)
```

### Utilitaires
```batch
clean.bat           # Nettoyage complet du projet
test.bat            # Exécution des tests (unitaires, UI, couverture)
run.bat             # Build + Install + Lancement sur appareil
install.bat         # Installation APK debug sur appareil
```

---

## 📌 Gestion des versions

### Format de version
- **versionCode** : Entier incrémenté à chaque build (usage interne Android)
- **versionName** : Version affichée (format: `1.2.0-alpha.X`)

### Historique
- `v2.5.1` : Générateur de mots de passe web original
- `v1.0.0-alpha` : Application Android avec coffre sécurisé
- `v1.2.0-alpha.9` : Version actuelle (après correction)

### Nom des APK générés
- **Debug** : `genpwd-pro-v1.2.0-alpha.X-debug.apk`
- **Release** : `genpwd-pro-v1.2.0-alpha.X-release.apk`

---

## ⚠️ Notes importantes

### Build Release
Pour générer un APK release signé, vous devez :
1. Créer un keystore :
   ```bash
   keytool -genkey -v -keystore genpwd-release.keystore -alias genpwd -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Configurer `gradle.properties` :
   ```properties
   RELEASE_STORE_FILE=chemin/vers/votre.keystore
   RELEASE_STORE_PASSWORD=votre_mot_de_passe
   RELEASE_KEY_ALIAS=votre_alias
   RELEASE_KEY_PASSWORD=votre_mot_de_passe_cle
   ```

### Prérequis
- **Java JDK 17+** (recommandé)
- **Android SDK** (via Android Studio)
- **Gradle Wrapper** (inclus dans le projet)

---

## 🔄 Workflow recommandé

### Pour un nouveau build
```batch
cd android
auto-build.bat      # Incrémente automatiquement et build
```

### Pour tester sans incrémenter
```batch
build.bat           # Build avec la version actuelle
```

### Pour nettoyer et rebuilder
```batch
clean.bat
auto-build.bat
```

---

## 📁 Structure des outputs

```
android/
└── app/
    └── build/
        └── outputs/
            └── apk/
                ├── debug/
                │   └── genpwd-pro-v1.2.0-alpha.X-debug.apk
                └── release/
                    └── genpwd-pro-v1.2.0-alpha.X-release.apk
```
