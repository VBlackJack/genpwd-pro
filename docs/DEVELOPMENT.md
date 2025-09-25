# Guide de Développement - GenPwd Pro v2.5

> Configuration et bonnes pratiques pour le développement local

## 🚀 Démarrage rapide

### Prérequis

- Node.js ≥ 16.0.0
- npm ≥ 8.0.0
- Navigateur moderne avec support ES6 modules

### Installation

```bash
# Cloner le repository
git clone https://github.com/VBlackJack/genpwd-pro.git
cd genpwd-pro

# Installer les dépendances de développement (optionnel)
cd tools && npm install && cd ..
```

### Lancement du serveur de développement

```bash
# Méthode 1 : npm script (recommandé)
npm run dev

# Méthode 2 : Node.js direct
node tools/dev-server.js

# Méthode 3 : Port personnalisé
node tools/dev-server.js 8080

# Méthode 4 : Mode watch (rechargement auto)
npm run watch
```

L'application sera accessible à : http://localhost:3000

## 🏗️ Architecture de développement

### Structure des fichiers

```
genpwd-pro/
├── src/
│   ├── index.html          # Point d'entrée
│   ├── js/                 # Modules ES6
│   │   ├── app.js         # Application principale
│   │   ├── config/        # Configuration
│   │   ├── core/          # Logique métier
│   │   ├── ui/            # Interface
│   │   └── utils/         # Utilitaires
│   ├── styles/            # CSS modulaire
│   └── tests/             # Tests unitaires
├── dictionaries/          # Dictionnaires JSON
├── tools/                 # Outils de développement
│   ├── dev-server.js     # Serveur HTTP
│   ├── build.js          # Build production
│   ├── run_tests.js      # Runner de tests
│   └── watch.js          # File watcher
└── package.json          # Configuration npm
```

### Serveur de développement

Le serveur (`tools/dev-server.js`) fournit :

- ✅ Serveur HTTP statique avec support ES6 modules
- ✅ CORS activé pour les requêtes cross-origin  
- ✅ Types MIME corrects (JS, CSS, JSON)
- ✅ Logging coloré avec timestamps
- ✅ Cache désactivé pour le développement
- ✅ Protection contre les attaques path traversal

## 🔧 Configuration

### Scripts npm disponibles

| Commande | Description | Port |
|----------|-------------|------|
| `npm run dev` | Serveur de développement | 3000 |
| `npm run watch` | Dev + rechargement auto | 3000 |
| `npm run test` | Lance les tests | - |
| `npm run build` | Build production | - |
| `npm run lint` | Vérification code | - |
| `npm run format` | Formatage code | - |

### Variables d'environnement

```bash
# Personnaliser le port
PORT=8080 npm run dev

# Désactiver CORS (non recommandé)
CORS_ENABLED=false npm run dev

# Mode verbose pour debug
DEBUG=true npm run dev
```

## 🛠️ Workflow de développement

### 1. Développement d'une nouvelle fonctionnalité

```bash
# Créer une branche feature
git checkout -b feature/nom-fonctionnalite

# Développer avec le serveur en mode watch
npm run watch

# Lancer les tests en continu
npm run test:watch

# Commit avec message conventionnel
git commit -m "feat: ajout de la fonctionnalité X"
```

### 2. Convention de commits

Utilisez les préfixes conventionnels :

- `feat:` Nouvelle fonctionnalité
- `fix:` Correction de bug
- `docs:` Documentation
- `style:` Formatage, pas de changement de code
- `refactor:` Refactoring du code
- `test:` Ajout ou modification de tests
- `chore:` Maintenance, configuration

### 3. Tests

```bash
# Lancer tous les tests
npm run test

# Tests avec couverture
npm run test:coverage

# Tests d'un module spécifique
npm run test -- --grep "generators"

# Tests en mode watch
npm run test:watch
```

### 4. Build de production

```bash
# Créer un build optimisé
npm run build

# Tester le build localement
npm run serve:build

# Analyser la taille du bundle
npm run analyze
```

## 🐛 Débogage

### Outils recommandés

1. **Chrome DevTools**
   - Sources : Debugging avec breakpoints
   - Network : Analyse des requêtes
   - Performance : Profiling
   - Console : Logs et erreurs

2. **Extensions navigateur**
   - Vue DevTools (si migration Vue.js)
   - React DevTools (si migration React)
   - Redux DevTools (si state management)

### Logs du serveur

Le serveur affiche des logs colorés :

```
🟢 [10:23:45] GET /js/app.js → 200 (12.3 KB)
🟡 [10:23:46] GET /missing.js → 404
🔴 [10:23:47] Error: ENOENT - File not found
🟣 [10:23:48] Security: Path traversal attempt blocked
```

### Points d'attention courants

| Problème | Solution |
|----------|----------|
| Modules ES6 non chargés | Vérifier `type="module"` dans HTML |
| CORS errors | S'assurer que le serveur dev est lancé |
| Cache navigateur | Utiliser Ctrl+Shift+R (hard reload) |
| Port déjà utilisé | `lsof -ti:3000 \| xargs kill` (Unix) |
| Dictionnaire non chargé | Vérifier le path dans `dictionaries.js` |

## 🔒 Sécurité en développement

### Bonnes pratiques

1. **Ne jamais commiter :**
   - Clés API ou secrets
   - Fichiers `.env` avec données sensibles
   - Données de test personnelles
   - Builds de développement

2. **Toujours vérifier :**
   - Validation des entrées utilisateur
   - Échappement des sorties HTML
   - CSP headers en production
   - Dépendances à jour (`npm audit`)

### Audit de sécurité

```bash
# Vérifier les vulnérabilités
npm audit

# Corriger automatiquement (prudence)
npm audit fix

# Mise à jour des dépendances
npm update
```

## 📦 Préparation pour la production

### Checklist avant déploiement

- [ ] Tous les tests passent (`npm test`)
- [ ] Pas d'erreurs de lint (`npm run lint`)
- [ ] Build production réussi (`npm run build`)
- [ ] Performance validée (Lighthouse > 90)
- [ ] Sécurité auditée (`npm audit`)
- [ ] Documentation à jour
- [ ] Version bumped dans `package.json`
- [ ] CHANGELOG.md mis à jour
- [ ] Tag git créé

### Déploiement

```bash
# Build et déploiement automatique (GitHub Actions)
git push origin main

# Ou déploiement manuel
npm run build
npm run deploy
```

## 🤝 Contribution

### Process de Pull Request

1. Fork le repository
2. Créer une branche feature
3. Développer et tester
4. Soumettre la PR avec description détaillée
5. Attendre la review
6. Merger après approbation

### Standards de code

- **Indentation** : 2 espaces
- **Quotes** : Simple quotes pour JS
- **Semicolons** : Toujours en fin de statement
- **Line length** : Max 100 caractères
- **Commentaires** : JSDoc pour les fonctions publiques

## 📚 Ressources

### Documentation

- [README Principal](./README.md) - Vue d'ensemble du projet
- [Guide Utilisateur](./docs/USER-GUIDE.md) - Utilisation de l'application
- [Documentation Technique](./docs/TECHNICAL.md) - Architecture détaillée
- [Cahier des Charges](./docs/SPECIFICATIONS.md) - Spécifications complètes

### Liens utiles

- [MDN Web Docs](https://developer.mozilla.org/) - Référence JavaScript
- [Can I Use](https://caniuse.com/) - Compatibilité navigateurs
- [ES6 Features](http://es6-features.org/) - Guide ES6
- [OWASP Top 10](https://owasp.org/Top10/) - Sécurité web

## 💡 Tips & Tricks

### Raccourcis utiles

- `npm run dev` + `npm run test:watch` en parallèle
- Utiliser les Chrome Workspaces pour éditer directement
- Installer `nodemon` globalement pour auto-reload
- Configurer des snippets VS Code pour les patterns courants

### Performance

- Profiler régulièrement avec Chrome DevTools
- Utiliser le lazy loading pour les dictionnaires
- Minimiser les re-renders DOM
- Implémenter la memoization pour les calculs coûteux

---

<div align="center">
  <b>GenPwd Pro v2.5 - Guide de Développement</b><br>
  Pour toute question : <a href="https://github.com/VBlackJack/genpwd-pro/discussions">GitHub Discussions</a>
</div>
