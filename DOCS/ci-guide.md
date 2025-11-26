# Guide CI/CD - GenPwd Pro

## Vue d'ensemble

GenPwd Pro utilise GitHub Actions pour l'intégration et le déploiement continus. Cinq workflows principaux assurent la qualité du code et la sécurité.

## Workflows configurés

### 1. Web CI/CD (`web-ci.yml`)

**Déclencheurs:**
- Push sur `main` et branches de feature
- Pull requests vers `main`
- Schedule quotidien à 2h UTC
- Déclenchement manuel

**Jobs:**

#### Installation (`install`)
- Cache npm intelligent (node_modules + ~/.npm)
- Installation avec `PUPPETEER_SKIP_DOWNLOAD=true`
- Durée: ~30-60s

#### Lint (`lint`)
- ESLint sur `src/js/**/*.js` et `tools/**/*.js`
- Zéro erreur toléré
- Durée: ~5-10s

#### Tests rapides (`test-fast`)
- Tests principaux uniquement (`FAST_ONLY=1`)
- Parallèle avec la suite complète
- Durée: ~10-15s

#### Tests complets (`test`)
- Node 20 avec couverture
- Upload vers Codecov (non-bloquant)
- Seuils de couverture désactivés temporairement
- Durée: ~30-45s

#### Tests de compatibilité (`test-compat`)
- Matrice: Node 18 et 22
- Pas de couverture
- `fail-fast: false` pour tester toutes les versions
- Durée: ~20-30s par version

#### Tests navigateur (`browser-test`)
- Playwright Chromium
- Actuellement avec fallback pour éviter les crashs file://
- TODO: Améliorer la gestion du protocole file://
- Durée: ~15-25s

#### Build (`build`)
- Validation de la construction
- Cache des artefacts de build
- Production d'un HTML monolithique (dist/index.html)
- Durée: ~10-15s

#### Audit de sécurité (`security`)
- `npm audit --audit-level=moderate`
- Continue même en cas d'erreur
- Upload des résultats en artifact
- Durée: ~5-10s

#### Vérification finale (`status-check`)
- Agrège tous les statuts
- Échoue si un job critique échoue
- Jobs critiques: lint, test, test-fast, test-compat, build

**Durée totale:** ~3-5 minutes

---

### 2. Security Scan (`security-scan.yml`)

**Déclencheurs:**
- Push sur `main` et branches de feature
- Pull requests
- Schedule quotidien à 00:00 UTC

**Jobs:**

#### Scan des dépendances (`dependency-scan`)
- `npm audit --audit-level=moderate` (bloquant)
- `npm outdated` (informatif)
- Node 18
- Durée: ~30-45s

#### SAST avec Semgrep (`sast`)
- Rulesets: security-audit, owasp-top-ten, javascript, nodejs
- Upload SARIF vers GitHub Security
- Continue en cas d'erreur
- Durée: ~1-2 minutes

#### Scan des secrets (`secrets-scan`)
- Gitleaks avec historique complet
- Détection de clés API, tokens, mots de passe
- Durée: ~30-60s

**Durée totale:** ~2-4 minutes

---

### 3. Android CI (`android-ci.yml`)

**Déclencheurs:**
- Push/PR modifiant `android/**` ou le workflow

**Jobs:**
- Build JDK 17
- Lint, Detekt, ktlint, tests unitaires
- Vérification stricte des rapports
- Durée: ~3-5 minutes (si déclenché)

---

### 4. Android Security (`android-security.yml`)

**Déclencheurs:**
- Push/PR modifiant `android/**` ou le workflow
- Schedule quotidien à 02:00 UTC

**Jobs:**
- SAST (Semgrep + CodeQL)
- OWASP Dependency-Check
- Gitleaks
- Android Lint sécurité
- Durée: ~5-8 minutes (si déclenché)

---

### 5. SBOM Generation (`sbom-generation.yml`)

**Déclencheurs:**
- Release
- Push sur `main` modifiant package*.json
- Déclenchement manuel

**Jobs:**
- Génération CycloneDX SBOM
- Upload en artifact (90 jours)
- Attachement aux releases
- Durée: ~1-2 minutes

---

## Exécuter la CI en local

### Prérequis
```bash
node --version  # ≥16.0.0
npm ci
```

### Tests unitaires
```bash
# Suite complète
npm test

# Tests rapides uniquement
npm run test:fast

# Avec couverture
npm run test:coverage

# Tests lents uniquement
npm run test:slow
```

### Linting
```bash
npm run lint
```

### Build
```bash
npm run build
# Sortie: dist/index.html
```

### Audit de sécurité
```bash
npm audit --audit-level=moderate
```

### Tests browser (expérimental)
```bash
# Installer Playwright
npx playwright install chromium --with-deps

# Build puis test
npm run build
npm run test:browser
```

---

## Déboguer un job qui échoue

### 1. Identifier le job
Consulter l'onglet Actions sur GitHub et identifier le job rouge.

### 2. Reproduire localement

```bash
# Pour un échec de test
npm test

# Pour un échec de lint
npm run lint

# Pour un échec de build
npm run build

# Pour un échec d'audit
npm audit --audit-level=moderate
```

### 3. Analyser les logs
- Les logs GitHub Actions montrent la commande exacte qui a échoué
- Copier/coller la commande localement pour reproduire
- Vérifier les variables d'environnement (NODE_ENV, etc.)

### 4. Corriger et valider
```bash
# Corriger le code
# ...

# Valider localement
npm test && npm run lint && npm run build

# Commit et push
git add .
git commit -m "fix: description du correctif"
git push
```

---

## Politique anti-flaky

### Principes

1. **Tests déterministes**: Pas de `Math.random()` sans seed, pas de `Date.now()` sans mock
2. **Isolation**: Chaque test nettoie ses effets de bord
3. **Timeouts raisonnables**: 60s pour la suite de tests, 2min pour les benchmarks
4. **Retry ciblé**: Les tests réseau/I/O peuvent être retryés 1 fois (configuré dans package.json)
5. **Synchronisation explicite**: Pas de `sleep()` arbitraires, utiliser des conditions fiables

### Mesures en place

#### Tests
- Configuration `testConfig.retries: 1` dans package.json
- Tests de performance avec seuils généreux mais réalistes
- Mocking du dictionnaire français pour éviter les appels réseau
- Cache du dictionnaire pour stabilité

#### CI
- `fail-fast: false` dans les matrices pour tester toutes les versions Node
- Caches agressifs: npm, node_modules, Playwright, build artifacts
- Jobs indépendants pour parallélisation maximale
- Upload Codecov en `fail_ci_if_error: false` pour éviter les rate limits

#### Jobs non-critiques
- Browser tests: fallback si échec
- Audit npm: `continue-on-error` ou `|| true`
- Semgrep/Gitleaks: `continue-on-error: true`

### Exemples de tests stables

✅ **BON:**
```javascript
test('generates password with fixed seed', () => {
  const pwd = generatePassword({ seed: 42 });
  assert.strictEqual(pwd, 'ExpectedResult123!');
});
```

❌ **MAUVAIS:**
```javascript
test('generates random password', () => {
  const pwd = generatePassword();
  assert.ok(pwd.length > 10); // Flaky!
});
```

---

## Seuils de qualité

### Couverture de code
- **Actuellement:** Désactivée (tests Services incomplets)
- **Objectif:** ≥80% lignes, ≥70% branches
- **Config:** `test:coverage` avec c8

### Lint
- **Règles:** ESLint recommandé + règles custom
- **Tolérance:** Zéro erreur, warnings acceptés temporairement
- **Config:** `.eslintrc.json`

### Audit de sécurité
- **Niveau:** Moderate et supérieur
- **Tolérance:** Zéro vulnérabilité connue exploitable
- **Exceptions:** Documentées dans le code de commit

### Performance
- **Benchmarks:** 10 tests avec seuils stricts
- **Génération 1000 mots de passe:** <1000ms (avg)
- **Génération 100 passphrases:** <2000ms (avg)
- **Calcul entropie 100x:** <100ms (avg)

---

## Optimisations de cache

### Node modules
```yaml
key: node-modules-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
```
- Hit rate: ~95% sur les PR
- Économie: ~30-40s par job

### Playwright
```yaml
key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
```
- Hit rate: ~90%
- Économie: ~20-30s

### Build artifacts
```yaml
key: build-${{ runner.os }}-${{ hashFiles('src/**', 'tools/build.js', 'package.json') }}
```
- Hit rate: ~60-70%
- Économie: ~10-15s

---

## Dépannage fréquent

### ❌ "npm audit failed"
**Cause:** Nouvelle vulnérabilité détectée
**Solution:**
```bash
npm audit fix
# ou si breaking changes
npm audit fix --force
# Tester après correction
npm test
```

### ❌ "ESLint errors"
**Cause:** Code non conforme aux règles
**Solution:**
```bash
npm run lint -- --fix
git add .
```

### ❌ "Test timeout"
**Cause:** Test bloqué ou trop lent
**Solution:**
1. Identifier le test concerné dans les logs
2. Augmenter le timeout si légitime
3. Ou optimiser/mocker le test

### ❌ "Browser test crashed"
**Cause:** Problème file:// protocol ou ressources manquantes
**Solution:** Actuellement skip automatique, TODO à traiter

### ❌ "Cache restore failed"
**Cause:** Corruption du cache GitHub
**Solution:** Créer un nouveau cache via bump de version ou clear manuel

---

## Contribuer

### Avant de push
```bash
npm run lint
npm test
npm run build
npm audit --audit-level=moderate
```

### Convention de commit
```
type(scope): description courte

[body optionnel]

[footer optionnel: Refs #issue]
```

Types: `feat`, `fix`, `docs`, `test`, `chore`, `ci`, `perf`, `refactor`

---

## Ressources

- [GitHub Actions docs](https://docs.github.com/en/actions)
- [ESLint rules](https://eslint.org/docs/latest/rules/)
- [c8 coverage](https://github.com/bcoe/c8)
- [Playwright docs](https://playwright.dev/)
- [Semgrep rules](https://semgrep.dev/explore)

---

**Dernière mise à jour:** 2025-11-15
**Mainteneur:** Build & CI Team
