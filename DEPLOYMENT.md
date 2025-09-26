# Déploiement de GenPwd Pro PWA

Ce document détaille les étapes à suivre avant, pendant et après le déploiement de la Progressive Web App GenPwd Pro.

## 1. Checklist pré-déploiement

- [ ] Exécuter `npm install` pour s'assurer que toutes les dépendances sont à jour.
- [ ] Lancer `npm run icons:generate` pour régénérer les icônes PWA.
- [ ] Construire la PWA avec `npm run pwa:build` et vérifier que `dist/pwa/` contient les fichiers attendus.
- [ ] Examiner le rapport de build généré dans `dist/pwa/pwa-build-report.json`.
- [ ] Tester le fonctionnement hors ligne via `npm run pwa:test` et `tests/test-pwa.html`.
- [ ] Mettre à jour le numéro de version et la note de version dans `CHANGELOG.md` si nécessaire.

## 2. Configuration serveur

Pour garantir une expérience PWA optimale :

- Servez la PWA depuis un domaine HTTPS avec un certificat TLS valide.
- Configurez les en-têtes HTTP suivants :
  - `Service-Worker-Allowed: /` pour autoriser le scope racine.
  - `Cache-Control: public, max-age=31536000, immutable` pour les assets fingerprintés (icônes, CSS/JS versionnés).
  - `Content-Security-Policy` permettant le chargement des scripts et styles utilisés par GenPwd Pro.
- Activez la compression (Gzip ou Brotli) pour les fichiers statiques (`.html`, `.css`, `.js`, `.json`).
- Vérifiez que `manifest.json` et `service-worker.js` sont servis avec le type MIME approprié (`application/json`, `text/javascript`).

## 3. Déploiement

1. Nettoyez le dossier de destination sur le serveur ou le CDN.
2. Transférez l'intégralité de `dist/pwa/` en conservant l'arborescence.
3. Invalidez le cache CDN si nécessaire pour diffuser la nouvelle version.
4. Vérifiez que `https://votre-domaine/manifest.json` et `https://votre-domaine/service-worker.js` sont accessibles.

## 4. Tests d'installation

- **Mobile (Android / Chrome, Firefox)** : Ouvrez l'URL, attendez la bannière d'installation puis installez. Vérifiez le lancement hors ligne.
- **iOS (Safari 16+)** : Ajoutez la PWA à l'écran d'accueil via le menu de partage, testez le lancement hors ligne.
- **Desktop (Chrome, Edge)** : Utilisez le bouton d'installation ou l'icône "Installer" dans la barre d'adresse, puis testez les raccourcis et l'état offline.

## 5. Debugging PWA

- Ouvrez Chrome DevTools > Application > Service Workers pour surveiller l'état d'enregistrement, forcer la mise à jour et inspecter les caches.
- Utilisez l'onglet Application > Manifest pour vérifier les métadonnées, icônes et critères d'installation.
- L'onglet Lighthouse permet d'exécuter un audit PWA, mesurant la performance et l'installabilité.
- En cas de problème d'installation, vérifiez la console JavaScript et les logs du service worker (`chrome://serviceworker-internals`).

## 6. Métriques de performance

Surveillez les indicateurs suivants après le déploiement :

- **Largest Contentful Paint (LCP)** et **First Input Delay (FID)** pour la réactivité.
- **Core Web Vitals** via Google Search Console ou PageSpeed Insights.
- **Taille du bundle** (`dist/pwa/`) et poids du cache pour s'assurer que la PWA reste légère.
- **Taux d'installation** et **rétention hors ligne** si vous collectez des métriques analytiques consenties.

Ces étapes garantissent que GenPwd Pro fournit une expérience PWA fiable et performante sur l'ensemble des plateformes.
