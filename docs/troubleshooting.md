# Guide de Dépannage - GenPwd Pro

**Version:** 2.6.0
**Dernière mise à jour:** 2025-11-15

## 📋 Table des matières

- [Problèmes Courants](#problèmes-courants)
- [Installation](#installation)
- [Génération de Mots de Passe](#génération-de-mots-de-passe)
- [Export et Import](#export-et-import)
- [Problèmes Spécifiques aux Plateformes](#problèmes-spécifiques-aux-plateformes)
- [Obtenir de l'Aide](#obtenir-de-laide)

---

## Problèmes Courants

### Le bouton "Copier" ne fonctionne pas

**Symptômes:** Cliquer sur "Copier" ne copie pas le mot de passe dans le presse-papiers.

**Causes possibles:**
- Permissions du navigateur bloquées
- Navigateur ne supportant pas l'API Clipboard
- Contexte non-HTTPS (sauf localhost)

**Solutions:**
1. Accordez la permission d'accès au presse-papiers quand le navigateur vous le demande
2. Utilisez HTTPS ou localhost pour le développement
3. Copiez manuellement avec Ctrl+C (Cmd+C sur Mac) après sélection du texte
4. Vérifiez la console navigateur pour les erreurs JavaScript

### Les mots de passe générés sont identiques

**Symptômes:** GenPwd Pro génère toujours le même mot de passe.

**Causes possibles:**
- Générateur aléatoire du navigateur défaillant
- Extension navigateur interférant
- Cache navigateur corrompu

**Solutions:**
1. Videz le cache du navigateur
2. Désactivez temporairement les extensions
3. Essayez dans une fenêtre de navigation privée
4. Mettez à jour votre navigateur vers la dernière version

### L'application ne se charge pas

**Symptômes:** Page blanche ou erreur de chargement.

**Causes possibles:**
- Fichiers JavaScript bloqués par CSP
- Erreur de réseau
- Fichiers manquants

**Solutions:**
1. Vérifiez la console navigateur (F12) pour les erreurs
2. Désactivez les bloqueurs de scripts (AdBlock, NoScript)
3. Rechargez la page avec Ctrl+Shift+R (vidage cache)
4. Essayez un autre navigateur

### L'historique a disparu

**Symptômes:** Les mots de passe précédemment générés ne sont plus dans l'historique.

**Causes possibles:**
- Cache navigateur vidé
- localStorage effacé
- Limite d'historique atteinte

**Solutions:**
1. L'historique est stocké localement, il est normal qu'il disparaisse après un nettoyage
2. Utilisez la fonction Export régulièrement pour sauvegarder vos données
3. Vérifiez la limite d'historique dans les paramètres (défaut: 100 entrées)

---

## Installation

### Windows Defender bloque l'application

**Symptômes:** Windows affiche un avertissement lors du lancement de l'exécutable.

**Solutions:**
1. Clic droit sur le fichier → Propriétés → Cochez "Débloquer" → Appliquer
2. Ajoutez une exception dans Windows Defender
3. Téléchargez depuis la [page officielle des releases](https://github.com/VBlackJack/genpwd-pro/releases)

### L'application Electron ne démarre pas

**Symptômes:** Double-clic sur l'icône ne lance rien.

**Solutions:**
1. Vérifiez que toutes les dépendances sont installées
2. Lancez depuis le terminal pour voir les erreurs:
   ```bash
   ./GenPwd-Pro
   ```
3. Réinstallez l'application
4. Vérifiez les logs dans `~/.config/GenPwd-Pro/logs/`

---

## Génération de Mots de Passe

### Les caractères spéciaux ne sont pas acceptés

**Symptômes:** Le site web refuse le mot de passe généré.

**Solutions:**
1. Désactivez les caractères spéciaux dans les options
2. Essayez le mode "Passphrase" avec des mots simples
3. Consultez les exigences du site web cible
4. Utilisez uniquement lettres et chiffres si le site est restrictif

### Le mot de passe généré est trop court

**Symptômes:** Le mot de passe ne respecte pas la longueur minimale souhaitée.

**Solutions:**
1. Augmentez le curseur de longueur à 16+ caractères
2. En mode Passphrase, augmentez le nombre de mots (4-6 recommandé)
3. Vérifiez que les options (chiffres, symboles) sont activées

### L'entropie affichée est faible

**Symptômes:** L'indicateur de force montre < 80 bits.

**Solutions:**
1. Augmentez la longueur du mot de passe
2. Activez chiffres ET caractères spéciaux
3. En mode Passphrase, utilisez 5-6 mots minimum
4. Évitez les patterns prévisibles en mode Leet

---

## Export et Import

### Le fichier CSV ne s'ouvre pas correctement dans Excel

**Symptômes:** Caractères bizarres ou colonnes mal alignées.

**Solutions:**
1. Ouvrez Excel → Données → Importer depuis CSV
2. Sélectionnez l'encodage UTF-8
3. Définissez le délimiteur comme "virgule"
4. Utilisez LibreOffice Calc qui gère mieux l'UTF-8

### L'export JSON génère une erreur

**Symptômes:** Le téléchargement échoue ou le fichier est vide.

**Solutions:**
1. Vérifiez qu'il y a au moins un mot de passe dans l'historique
2. Essayez le format TXT d'abord
3. Vérifiez la console pour les erreurs JavaScript
4. Réduisez la taille de l'historique si > 1000 entrées

---

## Problèmes Spécifiques aux Plateformes

### Android

**Problème:** L'application se ferme inopinément
- Videz le cache: Paramètres → Apps → GenPwd Pro → Vider le cache
- Réinstallez l'application
- Vérifiez Android 8.0+ requis

**Problème:** La synchronisation cloud échoue
- Vérifiez votre connexion Internet
- Re-autorisez l'accès dans Paramètres → Cloud Sync
- Consultez [CLOUD_SYNC_README.md](../android/CLOUD_SYNC_README.md)

### iOS (via navigateur)

**Problème:** L'application ne s'installe pas en PWA
- Utilisez Safari (Chrome iOS ne supporte pas PWA)
- Tapez sur Partager → Ajouter à l'écran d'accueil

### Linux

**Problème:** L'AppImage ne se lance pas
- Rendez le fichier exécutable: `chmod +x GenPwd-Pro.AppImage`
- Installez FUSE: `sudo apt install fuse libfuse2`

---

## Obtenir de l'Aide

### Documentation

- **Guide utilisateur:** [USER-GUIDE.md](USER-GUIDE.md)
- **Guide des fonctionnalités:** [FEATURES_GUIDE.md](FEATURES_GUIDE.md)
- **Documentation complète:** [INDEX.md](INDEX.md)

### Support

- **Signaler un bug:** [GitHub Issues](https://github.com/VBlackJack/genpwd-pro/issues)
- **Discussions:** [GitHub Discussions](https://github.com/VBlackJack/genpwd-pro/discussions)
- **Email sécurité:** security@genpwd.app (pour les vulnérabilités uniquement)

### Avant de Signaler un Problème

Collectez ces informations:
- Version de GenPwd Pro (visible dans le pied de page)
- Navigateur et version
- Système d'exploitation
- Message d'erreur exact (capture d'écran)
- Étapes pour reproduire le problème

### Logs et Debug

Pour activer les logs de debug:
1. Ouvrez la console du navigateur (F12)
2. Tapez: `localStorage.setItem('debug', 'true')`
3. Rechargez la page
4. Reproduisez le problème
5. Copiez les logs de la console

---

**Dernière révision:** 2025-11-15
**Contributeurs:** [CONTRIBUTING.md](../CONTRIBUTING.md)
