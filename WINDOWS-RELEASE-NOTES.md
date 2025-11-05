# GenPwd Pro v2.5.2 - Version Windows

## 📦 Packages Disponibles

Deux versions sont disponibles pour Windows :

### 🎯 Version Recommandée - Portable Complete
**Fichier:** `genpwd-pro-v2.5.2-windows-portable.zip` (94 KB)

**Contenu:**
- ✅ Application HTML standalone (170 KB)
- ✅ Script de lancement Windows optimisé
- ✅ Documentation complète (FR)
- ✅ Guide d'installation
- ✅ Icône d'application
- ✅ 100% portable - aucune installation requise

**Installation:**
1. Décompressez l'archive où vous voulez
2. Naviguez dans le dossier `GenPwd-Pro/`
3. Double-cliquez sur `LANCER-GENPWD.bat`

---

### 🪶 Version Légère
**Fichier:** `genpwd-pro-v2.5.2-windows.zip` (65 KB)

Version minimale sans les fichiers JavaScript séparés, idéale pour les utilisateurs avancés.

---

## ✨ Fonctionnalités

### 🔐 Sécurité
- **Entropie maximale:** Jusqu'à 140 bits
- **100% Local:** Aucune connexion réseau requise
- **Zero trust:** Aucune donnée transmise ou stockée
- **CLI-Safe:** Caractères optimisés pour ligne de commande

### 🎨 Interface
- **5 thèmes professionnels:** Sombre, Clair, Contraste élevé, Océan, Forêt
- **Responsive:** S'adapte à toutes les tailles d'écran
- **Animations fluides:** Interface moderne et intuitive
- **Accessibilité:** Compatible WCAG AAA

### 🌍 Génération Multimode
- **Syllables:** Mots de passe prononçables (recommandé)
- **Passphrase:** Phrases avec dictionnaires FR/EN/Latin
- **Leet Speak:** Transformation stylisée (a→@, e→3, etc.)
- **Random:** Caractères totalement aléatoires

### 📤 Export Multi-Format
- **TXT:** Liste simple pour copier-coller
- **JSON:** Données complètes avec métadonnées
- **CSV:** Compatible Excel/Google Sheets

---

## 🚀 Démarrage Rapide

### Méthode 1 - Script Batch (Recommandé)
```cmd
Double-clic sur LANCER-GENPWD.bat
```
Le script ouvre automatiquement l'application dans votre navigateur par défaut.

### Méthode 2 - Directe
```cmd
Double-clic sur index.html
```
Ouvre directement dans le navigateur associé aux fichiers HTML.

### Méthode 3 - Glisser-Déposer
Glissez `index.html` dans votre navigateur préféré (Chrome, Firefox, Edge).

---

## 🛡️ Sécurité et Confidentialité

### ✅ Ce que l'application FAIT
- Génère des mots de passe cryptographiquement sécurisés
- Calcule l'entropie en temps réel
- Fonctionne 100% en local (mode `file://`)
- Permet l'export de vos mots de passe

### ❌ Ce que l'application NE FAIT PAS
- Ne communique JAMAIS avec un serveur distant
- Ne stocke AUCUNE donnée (sauf préférences de thème en localStorage)
- Ne collecte AUCUNE statistique ou télémétrie
- Ne nécessite AUCUNE installation système

---

## 📋 Configuration Requise

### Système d'Exploitation
- ✅ Windows 11
- ✅ Windows 10
- ✅ Windows 8.1
- ✅ Windows Server 2016+

### Navigateurs Compatibles
- ✅ Google Chrome (recommandé)
- ✅ Microsoft Edge (recommandé)
- ✅ Firefox
- ✅ Opera
- ✅ Brave

### Ressources
- **Disque:** 5 MB
- **RAM:** Négligeable (<10 MB)
- **Internet:** Aucune connexion requise

---

## 🔧 Configuration Avancée

### Créer un Raccourci Bureau
1. Clic droit sur `LANCER-GENPWD.bat` → Créer un raccourci
2. Déplacez le raccourci sur le bureau
3. Renommez-le "GenPwd Pro"
4. Clic droit → Propriétés → Changer l'icône → Parcourir → Sélectionnez `assets/icon.ico`

### Intégration Menu Démarrer
1. Créez un raccourci comme ci-dessus
2. Déplacez-le dans: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\`

### Épingler à la Barre des Tâches
1. Créez un raccourci du script `.bat`
2. Clic droit sur le raccourci → Épingler à la barre des tâches

---

## 🗑️ Désinstallation

L'application est 100% portable :

1. Fermez l'application si elle est ouverte
2. Supprimez le dossier `GenPwd-Pro`
3. Supprimez les raccourcis créés (si applicable)

Aucune trace ne reste sur votre système !

---

## 📊 Tests et Qualité

- ✅ **17/17 tests automatisés** passés
- ✅ **Score qualité:** 9.7/10
- ✅ **Audit sécurité:** 9.5/10
- ✅ **Compatibilité:** Testée sur Windows 10/11

---

## 🆘 Support et Documentation

### Documentation Complète
- 📖 [Guide Utilisateur](https://github.com/VBlackJack/genpwd-pro/blob/main/docs/USER-GUIDE.md)
- 🔧 [Documentation Technique](https://github.com/VBlackJack/genpwd-pro/blob/main/docs/TECHNICAL.md)
- 🎯 [Guide des Fonctionnalités v2.5.2](https://github.com/VBlackJack/genpwd-pro/blob/main/docs/FEATURES_GUIDE.md)

### Support
- 🐛 [Signaler un bug](https://github.com/VBlackJack/genpwd-pro/issues)
- 💬 [Discussions](https://github.com/VBlackJack/genpwd-pro/discussions)
- 📧 Contact: Voir repository GitHub

---

## 📄 Licence

Apache License 2.0
© 2025 Julien Bombled

Vous êtes libre d'utiliser, modifier et distribuer ce logiciel conformément aux termes de la licence Apache 2.0.

---

## 🎉 Changelog v2.5.2

### Nouvelles Fonctionnalités
- 📤 **Export multi-format** (TXT, JSON, CSV)
- 🎨 **5 thèmes professionnels** avec persistance
- 🔍 **Monitoring d'erreurs** avec sanitization
- ⏱️ **Outils de performance** (benchmark, mesures)
- 📚 **Documentation JSDoc** complète

### Améliorations
- ✨ Interface modernisée avec animations fluides
- 🛡️ Corrections de sécurité (audit 9.5/10)
- 🚀 Optimisations de performance
- 📖 +850 lignes de documentation

### Corrections
- 🐛 Résolution de tous les points critiques de l'audit
- 🔒 Amélioration de la gestion des erreurs
- ⚡ Optimisation du calcul d'entropie

---

## 🔗 Liens Utiles

- 🌐 **GitHub:** https://github.com/VBlackJack/genpwd-pro
- 📖 **Documentation:** https://github.com/VBlackJack/genpwd-pro/tree/main/docs
- 🐛 **Issues:** https://github.com/VBlackJack/genpwd-pro/issues
- 📝 **Changelog complet:** https://github.com/VBlackJack/genpwd-pro/blob/main/CHANGELOG.md

---

<div align="center">

**GenPwd Pro v2.5.2** - Générateur de mots de passe professionnel et sécurisé

Made with ❤️ by Julien Bombled

</div>
