# Sprint Prompts - GenPwd Pro
## Roadmap 6 Semaines (3 Sprints × 2 Semaines)

**Généré le :** 2025-11-14
**Projet :** GenPwd Pro v2.6.0
**Contexte :** Roadmap inférée basée sur l'état actuel et les opportunités d'amélioration

---

## Roadmap Overview

### Sprint S1 - Consolidation & Qualité (Semaines 1-2)
**Objectif :** Renforcer la robustesse, les tests et la performance de la version web

**Items prioritaires :**
1. Amélioration couverture de tests (objectif 95%+)
2. Optimisation performances web (Core Web Vitals)
3. Amélioration accessibilité (WCAG AAA)
4. Documentation API exhaustive avec exemples
5. CI/CD GitHub Actions renforcé

**KPIs :**
- Couverture tests : 95%+
- Lighthouse Score : 95+ (toutes catégories)
- 0 violations WCAG AAA
- CI verte sur tous les browsers

---

### Sprint S2 - Fonctionnalités Avancées (Semaines 3-4)
**Objectif :** Enrichir l'écosystème avec des fonctionnalités différenciantes

**Items prioritaires :**
1. Système de plugins/extensions
2. Import/Export avancé (KeePass, 1Password, LastPass, Bitwarden)
3. PWA avec offline support complet
4. Intégration Have I Been Pwned (HIBP)
5. Préparation sync cloud (chiffrement E2E)

**KPIs :**
- 4+ formats import/export supportés
- PWA installable et fonctionnelle offline
- API HIBP intégrée et testée
- Architecture plugin documentée

---

### Sprint S3 - Mobile & Écosystème (Semaines 5-6)
**Objectif :** Étendre la portée cross-platform et l'adoption

**Items prioritaires :**
1. Finalisation version Android (Release Candidate)
2. Synchronisation cloud multi-plateformes
3. Extensions navigateur (Chrome, Firefox)
4. Version CLI pour développeurs
5. Onboarding interactif et tutoriels

**KPIs :**
- Android RC publié sur Play Store (beta)
- 2+ extensions navigateur publiées
- CLI npm package publié
- Sync cloud fonctionnel (iOS + Android + Web)

---

## Prompts de Sprint

Les prompts complets pour chaque sprint sont fournis ci-dessous au format XML, prêts à être exécutés.

---

## 🚀 Sprint S1 - Consolidation & Qualité

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sprint_session>
  <metadata>
    <sprint_id>S1</sprint_id>
    <sprint_name>Consolidation &amp; Qualité</sprint_name>
    <duration>2 semaines</duration>
    <team_size>1-3 développeurs</team_size>
    <priority>CRITIQUE</priority>
  </metadata>

  <objectives>
    <primary>Renforcer la robustesse, les tests et la performance de GenPwd Pro v2.6.0</primary>
    <secondary>
      <objective>Atteindre 95%+ de couverture de tests avec rapports détaillés</objective>
      <objective>Optimiser les Core Web Vitals pour un score Lighthouse 95+ sur toutes les catégories</objective>
      <objective>Garantir la conformité WCAG AAA (0 violations)</objective>
      <objective>Documenter l'API complète avec exemples fonctionnels</objective>
      <objective>Renforcer le CI/CD GitHub Actions avec tests cross-browser</objective>
    </secondary>
  </objectives>

  <backlog>
    <item id="S1-1" priority="P0" estimation="3j">
      <title>Amélioration couverture de tests (objectif 95%+)</title>
      <description>
        Étendre la suite de tests existante (src/tests/) pour couvrir tous les modules critiques.
        Ajouter tests unitaires, tests d'intégration, et tests de régression.
      </description>
      <acceptance_criteria>
        <criterion>Couverture de code mesurée via Istanbul/nyc ≥ 95%</criterion>
        <criterion>Tous les modules core/, ui/, utils/ ont des tests unitaires</criterion>
        <criterion>Tests d'intégration pour les flux principaux (génération, preset, historique, export)</criterion>
        <criterion>Tests de régression pour les bugs critiques corrigés (#23, etc.)</criterion>
        <criterion>npm run test génère un rapport HTML de couverture</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Installer et configurer nyc (Istanbul) pour la couverture de code</subtask>
        <subtask>Écrire tests unitaires manquants pour core/generators.js</subtask>
        <subtask>Écrire tests unitaires pour utils/ (i18n, preset-manager, history-manager, theme-manager)</subtask>
        <subtask>Écrire tests d'intégration pour ui/features-ui.js (modal, export, etc.)</subtask>
        <subtask>Ajouter tests de régression pour le bug #23 (vault lock)</subtask>
        <subtask>Configurer génération rapport HTML via npm run test:coverage</subtask>
        <subtask>Documenter les conventions de test dans docs/TESTING.md</subtask>
      </technical_subtasks>
      <risks>
        <risk severity="MEDIUM">Code legacy difficile à tester (refactoring nécessaire)</risk>
        <risk severity="LOW">Flakey tests sur les animations UI</risk>
      </risks>
      <mitigations>
        <mitigation>Refactorer progressivement le code legacy pour améliorer la testabilité</mitigation>
        <mitigation>Utiliser des mocks pour les animations et timers</mitigation>
      </mitigations>
    </item>

    <item id="S1-2" priority="P0" estimation="2j">
      <title>Optimisation performances web (Core Web Vitals)</title>
      <description>
        Optimiser LCP, FID, CLS pour atteindre un score Lighthouse 95+ sur Performance, Accessibility, Best Practices, SEO.
      </description>
      <acceptance_criteria>
        <criterion>Lighthouse Performance Score ≥ 95</criterion>
        <criterion>LCP (Largest Contentful Paint) &lt; 2.5s</criterion>
        <criterion>FID (First Input Delay) &lt; 100ms</criterion>
        <criterion>CLS (Cumulative Layout Shift) &lt; 0.1</criterion>
        <criterion>Score Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Auditer avec Lighthouse et Web Vitals extension</subtask>
        <subtask>Lazy-load des dictionnaires volumineux (dictionaries/*.json)</subtask>
        <subtask>Optimiser les images et assets (compression, formats modernes WebP)</subtask>
        <subtask>Implémenter code-splitting pour réduire le bundle initial</subtask>
        <subtask>Minifier et compresser CSS/JS en production</subtask>
        <subtask>Ajouter preconnect/prefetch pour les ressources critiques</subtask>
        <subtask>Éliminer les scripts bloquants, utiliser defer/async</subtask>
        <subtask>Documenter les optimisations dans docs/PERFORMANCE.md</subtask>
      </technical_subtasks>
      <risks>
        <risk severity="MEDIUM">Trade-off entre performance et richesse fonctionnelle</risk>
      </risks>
      <mitigations>
        <mitigation>Utiliser des stratégies de chargement intelligent (progressive enhancement)</mitigation>
      </mitigations>
    </item>

    <item id="S1-3" priority="P1" estimation="2j">
      <title>Amélioration accessibilité (WCAG AAA)</title>
      <description>
        Garantir la conformité WCAG AAA pour rendre l'application utilisable par tous, y compris les personnes en situation de handicap.
      </description>
      <acceptance_criteria>
        <criterion>0 violations WCAG AAA détectées par axe-core</criterion>
        <criterion>Navigation complète au clavier (focus visible, ordre logique)</criterion>
        <criterion>Lecteurs d'écran supportés (NVDA, JAWS, VoiceOver)</criterion>
        <criterion>Contrastes respectant AAA (ratio ≥ 7:1 pour texte normal)</criterion>
        <criterion>Textes alternatifs pour toutes les images/icônes</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Auditer avec axe DevTools et Lighthouse Accessibility</subtask>
        <subtask>Ajouter aria-labels, aria-describedby pour tous les composants interactifs</subtask>
        <subtask>Améliorer le focus management (skip links, focus trap dans modals)</subtask>
        <subtask>Vérifier et corriger les contrastes de couleurs (tous les thèmes)</subtask>
        <subtask>Tester avec lecteurs d'écran (NVDA sur Windows, VoiceOver sur macOS)</subtask>
        <subtask>Ajouter un mode à contraste élevé dédié si nécessaire</subtask>
        <subtask>Documenter les bonnes pratiques a11y dans docs/ACCESSIBILITY.md</subtask>
      </technical_subtasks>
      <risks>
        <risk severity="LOW">Incompatibilités entre différents lecteurs d'écran</risk>
      </risks>
      <mitigations>
        <mitigation>Suivre les recommandations ARIA Authoring Practices Guide</mitigation>
      </mitigations>
    </item>

    <item id="S1-4" priority="P1" estimation="2j">
      <title>Documentation API exhaustive avec exemples</title>
      <description>
        Compléter docs/API.md avec une documentation exhaustive de toutes les fonctions publiques, incluant JSDoc inline et exemples exécutables.
      </description>
      <acceptance_criteria>
        <criterion>Toutes les fonctions publiques documentées avec JSDoc</criterion>
        <criterion>docs/API.md contient des exemples exécutables pour chaque module</criterion>
        <criterion>Types TypeScript générés automatiquement (d.ts) si possible</criterion>
        <criterion>API playground interactif dans docs/ (optionnel)</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Compléter les JSDoc manquants dans src/js/core/, ui/, utils/</subtask>
        <subtask>Générer automatiquement la doc API via JSDoc ou TypeDoc</subtask>
        <subtask>Écrire des exemples d'utilisation pour chaque module dans docs/API.md</subtask>
        <subtask>Créer un fichier de types TypeScript (genpwd-pro.d.ts) pour auto-complétion IDE</subtask>
        <subtask>Ajouter des snippets VS Code dans .vscode/snippets.json (optionnel)</subtask>
        <subtask>Documenter les patterns d'extension dans docs/EXTENDING.md</subtask>
      </technical_subtasks>
    </item>

    <item id="S1-5" priority="P1" estimation="1j">
      <title>CI/CD GitHub Actions renforcé</title>
      <description>
        Améliorer le pipeline CI/CD pour exécuter tests, lint, build, et déploiement automatique sur plusieurs environnements et navigateurs.
      </description>
      <acceptance_criteria>
        <criterion>Tests exécutés automatiquement sur chaque PR (Node 16, 18, 20)</criterion>
        <criterion>Tests cross-browser via Playwright ou Puppeteer (Chrome, Firefox, Safari)</criterion>
        <criterion>Lint et formatage vérifiés automatiquement (ESLint, Prettier)</criterion>
        <criterion>Build de production validé sur chaque commit main</criterion>
        <criterion>Déploiement automatique sur GitHub Pages ou Netlify (optionnel)</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Créer .github/workflows/ci.yml pour tests et lint</subtask>
        <subtask>Ajouter matrix strategy pour tester sur Node 16, 18, 20</subtask>
        <subtask>Intégrer Playwright ou Puppeteer pour tests cross-browser</subtask>
        <subtask>Ajouter un workflow de déploiement automatique (CD)</subtask>
        <subtask>Configurer les badges de status dans README.md</subtask>
        <subtask>Documenter le pipeline CI/CD dans docs/CI-CD.md</subtask>
      </technical_subtasks>
    </item>
  </backlog>

  <deliverables>
    <code>
      <file>src/tests/* (nouveaux tests)</file>
      <file>coverage/ (rapports de couverture)</file>
      <file>.github/workflows/ci.yml</file>
      <file>docs/TESTING.md, PERFORMANCE.md, ACCESSIBILITY.md, CI-CD.md</file>
    </code>
    <tests>
      <test>Suite de tests étendue avec 95%+ de couverture</test>
      <test>Tests cross-browser via Playwright/Puppeteer</test>
    </tests>
    <docs>
      <doc>docs/API.md complétée avec exemples</doc>
      <doc>docs/TESTING.md (conventions de test)</doc>
      <doc>docs/PERFORMANCE.md (optimisations appliquées)</doc>
      <doc>docs/ACCESSIBILITY.md (conformité WCAG AAA)</doc>
      <doc>docs/CI-CD.md (pipeline CI/CD)</doc>
    </docs>
    <ci>
      <pipeline>GitHub Actions CI/CD opérationnel</pipeline>
      <pipeline>Tests automatisés sur chaque PR et commit</pipeline>
    </ci>
  </deliverables>

  <exit_criteria>
    <criterion>✅ Couverture de tests ≥ 95% (vérifiée par nyc)</criterion>
    <criterion>✅ Lighthouse Score ≥ 95 sur toutes les catégories</criterion>
    <criterion>✅ 0 violations WCAG AAA (validé par axe-core)</criterion>
    <criterion>✅ docs/API.md complète avec exemples exécutables</criterion>
    <criterion>✅ CI/CD GitHub Actions fonctionnel (tests verts)</criterion>
    <criterion>✅ Tous les tests passent (npm run test = 0 échecs)</criterion>
    <criterion>✅ Build de production réussi (npm run build = succès)</criterion>
  </exit_criteria>

  <handoff>
    <next_sprint>Sprint S2 - Fonctionnalités Avancées</next_sprint>
    <preparation>
      <action>Préparer l'architecture plugin pour S2-1</action>
      <action>Rechercher les formats d'import/export pour S2-2 (KeePass, 1Password, etc.)</action>
      <action>Documenter les patterns d'extension pour faciliter le développement de plugins</action>
    </preparation>

    <item_1_prompt>
      <![CDATA[
# Implémentation Item S1-1 : Amélioration Couverture de Tests (95%+)

## Contexte
GenPwd Pro v2.6.0 dispose d'une suite de tests basique (src/tests/test-suite.js, test-new-features.js).
Objectif : Atteindre 95%+ de couverture de code avec tests unitaires, intégration, et régression.

## Tâches
1. **Installer Istanbul/nyc** pour mesure de couverture
   ```bash
   npm install --save-dev nyc
   ```
   Configurer package.json :
   ```json
   "scripts": {
     "test:coverage": "nyc --reporter=html --reporter=text npm run test"
   }
   ```

2. **Tests unitaires pour core/generators.js**
   - generateSyllablePassword()
   - generatePassphrasePassword()
   - generateLeetPassword()
   - Cas limites : longueur 0, longueur max, paramètres invalides

3. **Tests unitaires pour utils/**
   - i18n.js : setLocale(), t(), loadTranslations()
   - preset-manager.js : createPreset(), loadPreset(), exportPreset()
   - history-manager.js : addEntry(), getHistory(), search()
   - theme-manager.js : setTheme(), getTheme()

4. **Tests d'intégration pour ui/features-ui.js**
   - Modal export : ouverture, sélection format, téléchargement
   - Modal presets : création, chargement, suppression
   - Modal historique : recherche, favoris, tags

5. **Tests de régression**
   - Bug #23 (vault lock) : s'assurer qu'il ne revient pas
   - Autres bugs critiques identifiés dans les commits récents

6. **Générer rapport HTML**
   ```bash
   npm run test:coverage
   ```
   Vérifier coverage/index.html → toutes les branches ≥ 95%

7. **Documentation**
   Créer docs/TESTING.md avec :
   - Conventions de nommage des tests
   - Structure des fichiers de test
   - Comment exécuter les tests
   - Comment lire le rapport de couverture

## Critères d'acceptation
✅ `npm run test:coverage` génère un rapport avec ≥ 95% de couverture
✅ Tous les modules core/, ui/, utils/ ont des tests
✅ Tests de régression pour bug #23 et autres bugs critiques
✅ docs/TESTING.md créé et complet

## Livrable
- Code : src/tests/* (nouveaux fichiers de test)
- Config : package.json (scripts test:coverage)
- Docs : docs/TESTING.md
- CI verte : tous les tests passent
      ]]>
    </item_1_prompt>

    <follow_up_prompts>
      <prompt id="S1-2">Implémenter l'optimisation des performances web (Core Web Vitals) pour atteindre Lighthouse 95+</prompt>
      <prompt id="S1-3">Garantir la conformité WCAG AAA avec 0 violations d'accessibilité</prompt>
    </follow_up_prompts>
  </handoff>
</sprint_session>
```

---

## 🔥 Sprint S2 - Fonctionnalités Avancées

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sprint_session>
  <metadata>
    <sprint_id>S2</sprint_id>
    <sprint_name>Fonctionnalités Avancées</sprint_name>
    <duration>2 semaines</duration>
    <team_size>1-3 développeurs</team_size>
    <priority>HIGH</priority>
  </metadata>

  <objectives>
    <primary>Enrichir GenPwd Pro avec des fonctionnalités différenciantes pour augmenter la valeur et l'adoption</primary>
    <secondary>
      <objective>Implémenter un système de plugins/extensions extensible</objective>
      <objective>Supporter l'import/export avancé (KeePass, 1Password, LastPass, Bitwarden)</objective>
      <objective>Transformer l'app en PWA installable avec offline support</objective>
      <objective>Intégrer Have I Been Pwned (HIBP) pour vérifier les mots de passe compromis</objective>
      <objective>Préparer l'architecture de synchronisation cloud avec chiffrement E2E</objective>
    </secondary>
  </objectives>

  <backlog>
    <item id="S2-1" priority="P0" estimation="4j">
      <title>Système de plugins/extensions</title>
      <description>
        Créer une architecture de plugins permettant d'étendre GenPwd Pro avec des générateurs personnalisés, des intégrations tierces, etc.
      </description>
      <acceptance_criteria>
        <criterion>API de plugin bien définie (registerPlugin, hooks, lifecycle)</criterion>
        <criterion>Au moins 2 plugins de démonstration fonctionnels</criterion>
        <criterion>Documentation complète pour créer des plugins (docs/PLUGIN_DEVELOPMENT.md)</criterion>
        <criterion>Plugin marketplace (liste de plugins disponibles) - optionnel</criterion>
        <criterion>Sécurité : sandboxing des plugins, validation des sources</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Concevoir l'API de plugin (interface, hooks, événements)</subtask>
        <subtask>Implémenter le plugin manager (src/js/utils/plugin-manager.js)</subtask>
        <subtask>Créer des hooks pour : génération, export, import, UI customization</subtask>
        <subtask>Développer 2 plugins de démo :
          - Plugin "Custom Generator" (générateur personnalisé)
          - Plugin "Export Format" (format d'export additionnel, ex: XML)
        </subtask>
        <subtask>Ajouter UI pour gérer les plugins (modal Settings → Plugins)</subtask>
        <subtask>Implémenter la sécurité : CSP pour les plugins, validation des sources</subtask>
        <subtask>Documenter l'API dans docs/PLUGIN_DEVELOPMENT.md</subtask>
        <subtask>Créer un template de plugin dans templates/plugin-template/</subtask>
      </technical_subtasks>
      <risks>
        <risk severity="HIGH">Risques de sécurité si les plugins ne sont pas sandboxés</risk>
        <risk severity="MEDIUM">Complexité de l'API pourrait rebuter les développeurs</risk>
      </risks>
      <mitigations>
        <mitigation>Utiliser CSP strict et validation rigoureuse des plugins</mitigation>
        <mitigation>Fournir une API simple et des exemples bien documentés</mitigation>
      </mitigations>
    </item>

    <item id="S2-2" priority="P0" estimation="3j">
      <title>Import/Export avancé (KeePass, 1Password, LastPass, Bitwarden)</title>
      <description>
        Permettre l'import et l'export de mots de passe depuis/vers les gestionnaires de mots de passe populaires.
      </description>
      <acceptance_criteria>
        <criterion>Import depuis : KeePass (XML/CSV), 1Password (1PIF), LastPass (CSV), Bitwarden (JSON)</criterion>
        <criterion>Export vers : KeePass (CSV), 1Password (CSV), LastPass (CSV), Bitwarden (JSON)</criterion>
        <criterion>Mapping automatique des champs (username, password, URL, notes, tags)</criterion>
        <criterion>Validation et sanitization des données importées</criterion>
        <criterion>UI intuitive pour sélectionner le format (modal Import/Export étendu)</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Rechercher les formats de fichier de chaque gestionnaire (spécifications)</subtask>
        <subtask>Implémenter parsers pour KeePass XML/CSV, 1Password 1PIF, LastPass CSV, Bitwarden JSON</subtask>
        <subtask>Implémenter exporters pour chaque format</subtask>
        <subtask>Créer un mapping générique (GenPwd Entry ↔ External Format)</subtask>
        <subtask>Ajouter validation et sanitization (éviter XSS, injection)</subtask>
        <subtask>Étendre ui/features-ui.js pour supporter ces nouveaux formats</subtask>
        <subtask>Tester avec des fichiers réels de chaque gestionnaire</subtask>
        <subtask>Documenter les formats supportés dans docs/IMPORT_EXPORT.md</subtask>
      </technical_subtasks>
      <risks>
        <risk severity="MEDIUM">Formats propriétaires non documentés (1Password 1PIF)</risk>
        <risk severity="HIGH">Risques de sécurité lors de l'import (XSS, injection)</risk>
      </risks>
      <mitigations>
        <mitigation>Reverse-engineer les formats si nécessaire, ou utiliser CSV comme fallback</mitigation>
        <mitigation>Validation stricte et sanitization de toutes les données importées</mitigation>
      </mitigations>
    </item>

    <item id="S2-3" priority="P0" estimation="2j">
      <title>PWA avec offline support complet</title>
      <description>
        Transformer GenPwd Pro en Progressive Web App installable, avec support offline complet via Service Worker.
      </description>
      <acceptance_criteria>
        <criterion>Application installable sur desktop et mobile (Add to Home Screen)</criterion>
        <criterion>Fonctionnement complet offline (génération, presets, historique)</criterion>
        <criterion>Service Worker avec stratégie de cache intelligente</criterion>
        <criterion>Manifest.json conforme aux standards PWA</criterion>
        <criterion>Score Lighthouse PWA = 100</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Créer manifest.json avec icônes (512x512, 192x192, etc.)</subtask>
        <subtask>Implémenter Service Worker (sw.js) avec stratégie Cache-First pour assets statiques</subtask>
        <subtask>Cacher les dictionnaires JSON pour offline access</subtask>
        <subtask>Implémenter stratégie Network-First pour API calls (si applicable)</subtask>
        <subtask>Ajouter UI pour notifier l'utilisateur de la disponibilité offline</subtask>
        <subtask>Tester l'installation et le fonctionnement offline sur mobile et desktop</subtask>
        <subtask>Documenter la stratégie PWA dans docs/PWA.md</subtask>
      </technical_subtasks>
      <risks>
        <risk severity="LOW">Complexité du Service Worker lifecycle</risk>
      </risks>
      <mitigations>
        <mitigation>Utiliser Workbox (Google) pour simplifier la gestion du Service Worker</mitigation>
      </mitigations>
    </item>

    <item id="S2-4" priority="P1" estimation="2j">
      <title>Intégration Have I Been Pwned (HIBP)</title>
      <description>
        Vérifier si un mot de passe généré a été compromis dans une fuite de données en utilisant l'API Have I Been Pwned.
      </description>
      <acceptance_criteria>
        <criterion>Intégration API HIBP Pwned Passwords (k-anonymity)</criterion>
        <criterion>Vérification automatique après génération (optionnel, activable par l'utilisateur)</criterion>
        <criterion>UI affichant un avertissement si le mot de passe est compromis</criterion>
        <criterion>Respect de la vie privée : utiliser k-anonymity (pas d'envoi du mot de passe en clair)</criterion>
        <criterion>Gestion des erreurs réseau (offline, API indisponible)</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Implémenter l'intégration HIBP Pwned Passwords API (k-anonymity)</subtask>
        <subtask>Créer src/js/services/hibp-service.js</subtask>
        <subtask>Ajouter une option dans Settings pour activer/désactiver la vérification HIBP</subtask>
        <subtask>Afficher un badge/warning dans l'UI si le mot de passe est compromis</subtask>
        <subtask>Gérer les cas d'erreur (offline, rate limit, API down)</subtask>
        <subtask>Documenter l'intégration HIBP dans docs/FEATURES_GUIDE.md</subtask>
      </technical_subtasks>
      <risks>
        <risk severity="LOW">API HIBP rate-limited ou indisponible</risk>
      </risks>
      <mitigations>
        <mitigation>Implémenter un cache local et un fallback gracieux si l'API est indisponible</mitigation>
      </mitigations>
    </item>

    <item id="S2-5" priority="P1" estimation="3j">
      <title>Préparation sync cloud (chiffrement E2E)</title>
      <description>
        Préparer l'architecture pour la synchronisation cloud cross-platform avec chiffrement bout-en-bout (sans implémentation complète des providers).
      </description>
      <acceptance_criteria>
        <criterion>Architecture de sync définie (docs/SYNC_ARCHITECTURE.md)</criterion>
        <criterion>Chiffrement E2E des données (AES-256-GCM)</criterion>
        <criterion>Abstraction provider-agnostic (interface SyncProvider)</criterion>
        <criterion>Implémentation d'un mock provider pour tests</criterion>
        <criterion>Détection et résolution de conflits (stratégie LWW - Last Write Wins)</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Concevoir l'architecture de sync (diagrammes, flux de données)</subtask>
        <subtask>Implémenter le chiffrement E2E avec Web Crypto API (AES-256-GCM)</subtask>
        <subtask>Créer l'interface SyncProvider (src/js/services/sync/sync-provider.js)</subtask>
        <subtask>Implémenter un MockSyncProvider pour tests (localStorage as backend)</subtask>
        <subtask>Implémenter la détection de conflits (timestamp-based, LWW)</subtask>
        <subtask>Créer l'UI de configuration sync (Settings → Sync) - en mode préparation</subtask>
        <subtask>Documenter l'architecture dans docs/SYNC_ARCHITECTURE.md</subtask>
      </technical_subtasks>
      <risks>
        <risk severity="HIGH">Complexité de la gestion des conflits</risk>
        <risk severity="MEDIUM">Sécurité du chiffrement E2E</risk>
      </risks>
      <mitigations>
        <mitigation>Utiliser une stratégie de résolution de conflits simple (LWW) pour v1</mitigation>
        <mitigation>Auditer le code de chiffrement par un expert en sécurité</mitigation>
      </mitigations>
    </item>
  </backlog>

  <deliverables>
    <code>
      <file>src/js/utils/plugin-manager.js</file>
      <file>src/js/services/hibp-service.js</file>
      <file>src/js/services/sync/* (architecture sync)</file>
      <file>manifest.json, sw.js (PWA)</file>
      <file>Parsers/exporters pour KeePass, 1Password, LastPass, Bitwarden</file>
    </code>
    <tests>
      <test>Tests unitaires pour plugin-manager, hibp-service, sync</test>
      <test>Tests d'intégration pour import/export avancé</test>
      <test>Tests PWA (offline, installation)</test>
    </tests>
    <docs>
      <doc>docs/PLUGIN_DEVELOPMENT.md</doc>
      <doc>docs/IMPORT_EXPORT.md</doc>
      <doc>docs/PWA.md</doc>
      <doc>docs/SYNC_ARCHITECTURE.md</doc>
    </docs>
  </deliverables>

  <exit_criteria>
    <criterion>✅ API de plugin fonctionnelle avec 2+ plugins de démo</criterion>
    <criterion>✅ Import/Export supportant 4+ formats (KeePass, 1Password, LastPass, Bitwarden)</criterion>
    <criterion>✅ PWA installable avec score Lighthouse PWA = 100</criterion>
    <criterion>✅ Intégration HIBP opérationnelle et testée</criterion>
    <criterion>✅ Architecture sync documentée et chiffrement E2E implémenté</criterion>
    <criterion>✅ Tous les tests passent (npm run test = 0 échecs)</criterion>
    <criterion>✅ CI verte sur toutes les nouvelles fonctionnalités</criterion>
  </exit_criteria>

  <handoff>
    <next_sprint>Sprint S3 - Mobile &amp; Écosystème</next_sprint>
    <preparation>
      <action>Préparer la roadmap Android pour S3-1 (Release Candidate)</action>
      <action>Rechercher les APIs browser extensions (Chrome, Firefox) pour S3-3</action>
      <action>Définir le scope du CLI pour S3-4</action>
    </preparation>

    <item_1_prompt>
      <![CDATA[
# Implémentation Item S2-1 : Système de Plugins/Extensions

## Contexte
GenPwd Pro v2.6.0 doit devenir extensible via un système de plugins permettant aux développeurs d'ajouter des générateurs personnalisés, des formats d'export, etc.

## Tâches
1. **Concevoir l'API de plugin**
   Interface PluginInterface :
   ```javascript
   {
     name: string,
     version: string,
     author: string,
     description: string,
     hooks: {
       onGenerate?: (config) => password,
       onExport?: (data, format) => file,
       onImport?: (file) => data,
       onUIRender?: (container) => void
     },
     lifecycle: {
       onLoad: () => void,
       onUnload: () => void
     }
   }
   ```

2. **Implémenter plugin-manager.js**
   ```javascript
   class PluginManager {
     registerPlugin(plugin) { /* validation, loading */ }
     unregisterPlugin(name) { /* cleanup */ }
     getPlugin(name) { /* retrieval */ }
     getAllPlugins() { /* list */ }
     callHook(hookName, ...args) { /* dispatch to plugins */ }
   }
   ```

3. **Créer 2 plugins de démo**
   - **custom-generator-plugin.js** : générateur de mots de passe avec émojis
   - **xml-export-plugin.js** : export au format XML

4. **UI de gestion des plugins**
   Modal Settings → onglet "Plugins" :
   - Liste des plugins installés
   - Bouton Activer/Désactiver
   - Bouton Installer (upload .js file)
   - Bouton Supprimer

5. **Sécurité**
   - CSP : interdire eval(), inline scripts dans les plugins
   - Validation : vérifier que le plugin implémente bien PluginInterface
   - Sandboxing : utiliser iframe sandbox si nécessaire

6. **Documentation**
   docs/PLUGIN_DEVELOPMENT.md :
   - Architecture du système de plugins
   - Comment créer un plugin
   - Hooks disponibles
   - Exemples de plugins
   - Bonnes pratiques de sécurité

7. **Template de plugin**
   templates/plugin-template/ :
   - plugin-template.js (squelette)
   - README.md (instructions)
   - package.json (si le plugin a des dépendances)

## Critères d'acceptation
✅ PluginManager fonctionnel avec registerPlugin(), callHook()
✅ 2 plugins de démo opérationnels
✅ UI de gestion des plugins dans Settings
✅ docs/PLUGIN_DEVELOPMENT.md complet
✅ Template de plugin disponible

## Livrable
- Code : src/js/utils/plugin-manager.js, src/plugins/*, ui/features-ui.js (modal plugins)
- Docs : docs/PLUGIN_DEVELOPMENT.md
- Template : templates/plugin-template/
- Tests : src/tests/test-plugin-manager.js
      ]]>
    </item_1_prompt>

    <follow_up_prompts>
      <prompt id="S2-2">Implémenter l'import/export avancé pour KeePass, 1Password, LastPass, Bitwarden</prompt>
      <prompt id="S2-3">Transformer GenPwd Pro en PWA installable avec offline support</prompt>
    </follow_up_prompts>
  </handoff>
</sprint_session>
```

---

## 📱 Sprint S3 - Mobile & Écosystème

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sprint_session>
  <metadata>
    <sprint_id>S3</sprint_id>
    <sprint_name>Mobile &amp; Écosystème</sprint_name>
    <duration>2 semaines</duration>
    <team_size>1-3 développeurs</team_size>
    <priority>HIGH</priority>
  </metadata>

  <objectives>
    <primary>Étendre GenPwd Pro à un écosystème cross-platform complet (Android, Web, Extensions, CLI)</primary>
    <secondary>
      <objective>Finaliser la version Android en Release Candidate (RC) et publier sur Play Store (beta)</objective>
      <objective>Implémenter la synchronisation cloud multi-plateformes (Google Drive, Dropbox, WebDAV)</objective>
      <objective>Développer et publier des extensions navigateur (Chrome, Firefox)</objective>
      <objective>Créer une version CLI npm pour développeurs</objective>
      <objective>Améliorer l'onboarding avec tutoriels interactifs</objective>
    </secondary>
  </objectives>

  <backlog>
    <item id="S3-1" priority="P0" estimation="5j">
      <title>Finalisation version Android (Release Candidate)</title>
      <description>
        Finaliser la version Android de GenPwd Pro, corriger les bugs restants, optimiser les performances, et publier une Release Candidate sur le Play Store (beta).
      </description>
      <acceptance_criteria>
        <criterion>Toutes les fonctionnalités core implémentées (génération, vaults, sync, presets)</criterion>
        <criterion>0 bugs critiques ou high priority</criterion>
        <criterion>Tests UI et intégration passent à 100%</criterion>
        <criterion>Performance validée (startup &lt; 2s, génération &lt; 100ms)</criterion>
        <criterion>App publiée sur Play Store en beta (internal testing ou closed beta)</criterion>
        <criterion>Documentation utilisateur Android complète</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Triager et corriger tous les bugs high/critical dans le tracker Android</subtask>
        <subtask>Optimiser les performances (startup time, génération, UI rendering)</subtask>
        <subtask>Finaliser les tests UI (Espresso) et tests d'intégration</subtask>
        <subtask>Vérifier la conformité Play Store (permissions, data safety, etc.)</subtask>
        <subtask>Préparer les assets (screenshots, description, icônes) pour le Play Store</subtask>
        <subtask>Créer un AAB (Android App Bundle) signé pour release</subtask>
        <subtask>Publier sur Play Store (internal testing ou closed beta)</subtask>
        <subtask>Documenter le processus de release dans android/docs/RELEASE_PROCESS.md</subtask>
      </technical_subtasks>
      <risks>
        <risk severity="HIGH">Bugs de dernière minute découverts lors des tests finaux</risk>
        <risk severity="MEDIUM">Rejet par le Play Store (violations de policies)</risk>
      </risks>
      <mitigations>
        <mitigation>Buffer de 2 jours pour correctifs de bugs de dernière minute</mitigation>
        <mitigation>Revue préalable des Play Store policies et data safety requirements</mitigation>
      </mitigations>
    </item>

    <item id="S3-2" priority="P0" estimation="4j">
      <title>Synchronisation cloud multi-plateformes</title>
      <description>
        Implémenter la synchronisation cloud complète avec support pour Google Drive, Dropbox, et WebDAV, en réutilisant l'architecture E2E du sprint S2.
      </description>
      <acceptance_criteria>
        <criterion>Support pour 3+ providers : Google Drive, Dropbox, WebDAV</criterion>
        <criterion>Chiffrement E2E maintenu (AES-256-GCM)</criterion>
        <criterion>Synchronisation automatique et manuelle</criterion>
        <criterion>Détection et résolution de conflits (LWW)</criterion>
        <criterion>Fonctionnement sur Web et Android</criterion>
        <criterion>UI de configuration et status de sync</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Implémenter GoogleDriveSyncProvider (OAuth 2.0, Drive API)</subtask>
        <subtask>Implémenter DropboxSyncProvider (OAuth 2.0, Dropbox API)</subtask>
        <subtask>Implémenter WebDAVSyncProvider (Basic Auth, WebDAV protocol)</subtask>
        <subtask>Tester la sync cross-platform (Web ↔ Android)</subtask>
        <subtask>Implémenter l'UI de configuration (Settings → Sync → Choose Provider)</subtask>
        <subtask>Ajouter des indicateurs de status de sync dans l'UI (syncing, synced, conflict)</subtask>
        <subtask>Documenter la configuration pour chaque provider dans docs/SYNC_SETUP.md</subtask>
      </technical_subtasks>
      <risks>
        <risk severity="HIGH">Complexité de l'intégration OAuth sur Android et Web</risk>
        <risk severity="MEDIUM">Limites de quota des APIs cloud (Drive, Dropbox)</risk>
      </risks>
      <mitigations>
        <mitigation>Utiliser des bibliothèques OAuth éprouvées (AppAuth pour Android)</mitigation>
        <mitigation>Implémenter un rate limiting et un retry avec backoff</mitigation>
      </mitigations>
    </item>

    <item id="S3-3" priority="P1" estimation="3j">
      <title>Extensions navigateur (Chrome, Firefox)</title>
      <description>
        Développer des extensions pour Chrome et Firefox permettant de générer des mots de passe directement depuis le navigateur, avec auto-fill dans les formulaires.
      </description>
      <acceptance_criteria>
        <criterion>Extension Chrome publiée sur Chrome Web Store</criterion>
        <criterion>Extension Firefox publiée sur Firefox Add-ons</criterion>
        <criterion>Génération de mots de passe via popup</criterion>
        <criterion>Auto-fill dans les champs de formulaires (optionnel)</criterion>
        <criterion>Synchronisation avec l'app web via storage.sync (si connecté)</criterion>
        <criterion>Respect des permissions minimales (principe du moindre privilège)</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Créer la structure de base de l'extension (manifest.json v3)</subtask>
        <subtask>Implémenter le popup HTML avec UI de génération</subtask>
        <subtask>Réutiliser le code core de génération (src/js/core/generators.js)</subtask>
        <subtask>Implémenter l'auto-fill dans les formulaires (content script)</subtask>
        <subtask>Implémenter la synchronisation via chrome.storage.sync / browser.storage.sync</subtask>
        <subtask>Créer les assets pour le store (icônes, screenshots, description)</subtask>
        <subtask>Publier sur Chrome Web Store et Firefox Add-ons</subtask>
        <subtask>Documenter l'extension dans docs/BROWSER_EXTENSIONS.md</subtask>
      </technical_subtasks>
      <risks>
        <risk severity="MEDIUM">Rejet par les stores (violations de policies)</risk>
        <risk severity="LOW">Incompatibilités Manifest v3 (Chrome) vs Manifest v2 (Firefox)</risk>
      </risks>
      <mitigations>
        <mitigation>Revue des policies avant soumission</mitigation>
        <mitigation>Utiliser un polyfill pour unifier Manifest v2/v3 si nécessaire</mitigation>
      </mitigations>
    </item>

    <item id="S3-4" priority="P1" estimation="2j">
      <title>Version CLI pour développeurs</title>
      <description>
        Créer une version en ligne de commande (CLI) de GenPwd Pro, publiée sur npm, pour les développeurs souhaitant générer des mots de passe via scripts.
      </description>
      <acceptance_criteria>
        <criterion>Package npm publié : @genpwd-pro/cli</criterion>
        <criterion>Commande globale : genpwd [options]</criterion>
        <criterion>Support des options : --mode, --length, --digits, --special, etc.</criterion>
        <criterion>Output au format texte ou JSON (--json flag)</criterion>
        <criterion>Documentation et exemples dans README</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Créer un nouveau package cli/ avec package.json</subtask>
        <subtask>Implémenter le CLI avec commander.js ou yargs</subtask>
        <subtask>Réutiliser src/js/core/generators.js pour la génération</subtask>
        <subtask>Ajouter des tests unitaires pour le CLI</subtask>
        <subtask>Créer un README.md avec exemples d'utilisation</subtask>
        <subtask>Publier sur npm : npm publish</subtask>
        <subtask>Documenter le CLI dans docs/CLI.md</subtask>
      </technical_subtasks>
      <risks>
        <risk severity="LOW">Nom npm déjà pris</risk>
      </risks>
      <mitigations>
        <mitigation>Utiliser un scope npm : @genpwd-pro/cli ou @julienbombled/genpwd-cli</mitigation>
      </mitigations>
    </item>

    <item id="S3-5" priority="P1" estimation="2j">
      <title>Onboarding interactif et tutoriels</title>
      <description>
        Améliorer l'expérience des nouveaux utilisateurs avec un onboarding interactif et des tutoriels step-by-step.
      </description>
      <acceptance_criteria>
        <criterion>Onboarding modal au premier lancement (web et Android)</criterion>
        <criterion>Tutoriels interactifs pour les fonctionnalités principales (génération, presets, export)</criterion>
        <criterion>Tooltips contextuels (hints) sur les éléments complexes</criterion>
        <criterion>Option "Skip tour" pour les utilisateurs avancés</criterion>
        <criterion>Tracking des étapes complétées (localStorage ou preferences)</criterion>
      </acceptance_criteria>
      <technical_subtasks>
        <subtask>Implémenter un modal d'onboarding avec Shepherd.js ou Intro.js</subtask>
        <subtask>Créer des tours guidés pour : génération, presets, historique, export</subtask>
        <subtask>Ajouter des tooltips avec Tippy.js ou similaire</subtask>
        <subtask>Implémenter la logique de "première visite" avec localStorage</subtask>
        <subtask>Adapter l'onboarding pour Android (DialogFragment ou BottomSheet)</subtask>
        <subtask>Tester l'expérience utilisateur avec des utilisateurs réels (bêta testeurs)</subtask>
        <subtask>Documenter l'onboarding dans docs/UX.md</subtask>
      </technical_subtasks>
    </item>
  </backlog>

  <deliverables>
    <code>
      <file>android/* (RC build)</file>
      <file>src/js/services/sync/* (providers implémentés)</file>
      <file>extensions/chrome/*, extensions/firefox/*</file>
      <file>cli/* (package npm)</file>
      <file>src/js/ui/onboarding.js</file>
    </code>
    <tests>
      <test>Tests Android complets (UI, intégration)</test>
      <test>Tests sync cross-platform</test>
      <test>Tests extensions (popup, content script)</test>
      <test>Tests CLI</test>
    </tests>
    <docs>
      <doc>android/docs/RELEASE_PROCESS.md</doc>
      <doc>docs/SYNC_SETUP.md</doc>
      <doc>docs/BROWSER_EXTENSIONS.md</doc>
      <doc>docs/CLI.md</doc>
      <doc>docs/UX.md</doc>
    </docs>
    <releases>
      <release>Android RC sur Play Store (beta)</release>
      <release>Extension Chrome sur Chrome Web Store</release>
      <release>Extension Firefox sur Firefox Add-ons</release>
      <release>CLI npm package sur npmjs.com</release>
    </releases>
  </deliverables>

  <exit_criteria>
    <criterion>✅ Android RC publié sur Play Store (beta) et téléchargeable</criterion>
    <criterion>✅ Sync cloud fonctionnel sur Web et Android (3+ providers)</criterion>
    <criterion>✅ Extensions Chrome et Firefox publiées et opérationnelles</criterion>
    <criterion>✅ CLI npm publié et installable via npm install -g @genpwd-pro/cli</criterion>
    <criterion>✅ Onboarding interactif implémenté sur Web et Android</criterion>
    <criterion>✅ Tous les tests passent (npm run test = 0 échecs)</criterion>
    <criterion>✅ Documentation complète et à jour</criterion>
  </exit_criteria>

  <handoff>
    <next_steps>
      <step>Lancer une campagne de bêta testing public</step>
      <step>Recueillir les feedbacks utilisateurs</step>
      <step>Planifier le sprint S4 basé sur les retours (améliorations, nouvelles features)</step>
      <step>Préparer le lancement officiel (v3.0.0) sur tous les canaux</step>
    </next_steps>

    <item_1_prompt>
      <![CDATA[
# Implémentation Item S3-1 : Finalisation Version Android (Release Candidate)

## Contexte
La version Android de GenPwd Pro est en développement avancé. Objectif : finaliser le RC et publier sur Play Store (beta).

## Tâches
1. **Triager les bugs restants**
   - Lister tous les bugs dans le tracker (GitHub Issues, Jira, etc.)
   - Prioriser : CRITICAL → HIGH → MEDIUM → LOW
   - Assigner et corriger les bugs CRITICAL et HIGH

2. **Optimisation des performances**
   - Mesurer le startup time (objectif &lt; 2s)
   - Profiler la génération de mots de passe (objectif &lt; 100ms)
   - Optimiser les layouts (éviter overdraw, nested layouts)
   - Implémenter lazy loading pour les modules non critiques

3. **Tests finaux**
   - Exécuter tous les tests UI (Espresso) : `./gradlew connectedAndroidTest`
   - Exécuter tous les tests unitaires : `./gradlew test`
   - Tester manuellement les flows critiques (génération, vaults, sync)

4. **Conformité Play Store**
   - Vérifier les permissions (ne demander que le strict nécessaire)
   - Remplir le formulaire Data Safety sur Play Console
   - Vérifier l'absence de violations de policies (pas de contenus interdits, etc.)

5. **Préparation des assets**
   - Screenshots (au moins 2 par langue, formats requis)
   - Icône app (512x512 PNG)
   - Feature graphic (1024x500 PNG)
   - Description courte et longue (FR, EN, ES)

6. **Build AAB signé**
   ```bash
   ./gradlew bundleRelease
   # Signer avec jarsigner ou via Android Studio
   ```

7. **Publication sur Play Store**
   - Créer une release sur Play Console
   - Uploader le AAB
   - Choisir "Internal testing" ou "Closed beta"
   - Inviter les bêta testeurs

8. **Documentation**
   android/docs/RELEASE_PROCESS.md :
   - Checklist de release
   - Instructions de build et signature
   - Process de publication sur Play Store

## Critères d'acceptation
✅ 0 bugs CRITICAL/HIGH restants
✅ Tous les tests passent (UI + unitaires)
✅ AAB signé généré
✅ App publiée sur Play Store (beta)
✅ docs/RELEASE_PROCESS.md créé

## Livrable
- APK/AAB : app/build/outputs/bundle/release/app-release.aab
- Docs : android/docs/RELEASE_PROCESS.md
- Play Store link : https://play.google.com/store/apps/details?id=com.julienbombled.genpwdpro (beta)
      ]]>
    </item_1_prompt>

    <follow_up_prompts>
      <prompt id="S3-2">Implémenter la synchronisation cloud multi-plateformes (Google Drive, Dropbox, WebDAV)</prompt>
      <prompt id="S3-3">Développer et publier les extensions navigateur (Chrome, Firefox)</prompt>
    </follow_up_prompts>
  </handoff>
</sprint_session>
```

---

## 📋 Résumé de la Roadmap

| Sprint | Durée | Focus Principal | KPIs Clés |
|--------|-------|-----------------|-----------|
| **S1** | 2 sem. | Consolidation & Qualité | Tests 95%+, Lighthouse 95+, 0 violations WCAG AAA |
| **S2** | 2 sem. | Fonctionnalités Avancées | Plugins, PWA, HIBP, 4+ formats import/export |
| **S3** | 2 sem. | Mobile & Écosystème | Android RC, Sync cloud, 2+ extensions, CLI npm |

**Total : 6 semaines**
**Livrables finaux :**
- GenPwd Pro Web v3.0.0 (PWA, plugins, import/export avancé, HIBP)
- GenPwd Pro Android RC (Play Store beta)
- Extensions Chrome & Firefox
- CLI npm package
- Documentation exhaustive
- CI/CD robuste

---

**Généré le :** 2025-11-14
**Par :** Claude (Sonnet 4.5)
**Projet :** GenPwd Pro v2.6.0
