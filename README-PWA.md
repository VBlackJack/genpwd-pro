# GenPwd Pro PWA Guide

Ce guide présente les commandes essentielles pour travailler avec la Progressive Web App de GenPwd Pro v2.5.1.

## Générer les icônes

```bash
npm run icons:generate
```

Cette commande s'appuie sur `tools/generate-icons.js` pour créer un SVG de base "GP" puis exporter toutes les tailles d'icônes requises (72×72 à 512×512) dans `src/assets/icons/`.

## Builder la PWA

```bash
npm run pwa:build
```

Le script `tools/build-pwa.js` régénère les icônes, copie les ressources nécessaires dans `dist/pwa/`, vérifie la présence des fichiers critiques (`index.html`, `manifest.json`, `service-worker.js`, dictionnaires, assets) et génère un rapport de build.

## Tester localement

```bash
npm run pwa:test
```

Cette commande exécute le build puis sert la PWA depuis `dist/pwa/` grâce à `http-server` sur `http://localhost:8080`. Ouvrez ce lien dans votre navigateur et utilisez la page `tests/test-pwa.html` pour diagnostiquer l'enregistrement du service worker, le cache et les scénarios d'installation.

## Déployer en production

```bash
npm run pwa:deploy
```

Le script prépare la sortie dans `dist/pwa/` et rappelle de déployer ce contenu sur un serveur HTTPS. Copiez l'intégralité du dossier sur votre infrastructure de production (CDN, hébergement statique ou serveur web) en conservant la même arborescence.

## Tester l'installation PWA

1. Ouvrez la PWA dans un navigateur compatible (Chrome, Edge, Firefox pour Android, Safari iOS 16+).
2. Vérifiez que le service worker est actif via la bannière ou la console DevTools.
3. Utilisez le bouton "Installer l'app" injecté par `pwa-installer.js` ou l'option "Installer" du navigateur.
4. Confirmez que l'application installée démarre en mode standalone et que les raccourcis (`/?mode=syllables`, `/?mode=passphrase`) fonctionnent hors ligne.

## Prérequis HTTPS

Les PWA exigent un contexte sécurisé. Assurez-vous que :

- Le domaine de production sert toutes les pages via HTTPS avec un certificat valide.
- Les ressources tierces (APIs, polices, images) sont également disponibles en HTTPS.
- Les en-têtes `Service-Worker-Allowed` ou `Content-Security-Policy` ne bloquent pas `service-worker.js`.

En environnement local, `http-server` utilise HTTP simple ; c'est acceptable pour le développement tant que vous testez les fonctionnalités d'installation sur `localhost` ou via `chrome://flags/#unsafely-treat-insecure-origin-as-secure` si nécessaire.
