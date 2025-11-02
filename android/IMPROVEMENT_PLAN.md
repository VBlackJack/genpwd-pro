# Plan d'Amélioration - GenPwd Pro Android

**Date :** 2025-10-30
**Version actuelle :** 1.1.0
**Branche :** android

---

## 📊 État Actuel

### Statistiques du Projet
- **Code total :** ~23,100+ lignes
- **ViewModels :** 13
- **Tests unitaires :** 26 fichiers
- **Tests instrumentés :** 9 fichiers
- **Couverture :** ~85-90% sur composants critiques
- **Fonctionnalités principales :** 95% complètes

### Points Forts ✅
1. **Architecture solide** - Clean Architecture + MVVM
2. **Sécurité robuste** - Argon2id + AES-256-GCM, zero-knowledge
3. **Migration terminée** - Système file-based (.gpv) en production
4. **Cloud sync opérationnel** - Google Drive et WebDAV fonctionnels
5. **Tests complets** - Bonne couverture des composants critiques
6. **Documentation extensive** - 3,800+ lignes de documentation

### Points à Améliorer 🔧
1. **UI/UX** - Intégration de fonctionnalités existantes
2. **Gradle** - Problèmes de vérification de dépendances
3. **Migration utilisateurs** - Outil de migration Room → .gpv à finaliser
4. **Cloud providers** - Templates OneDrive/pCloud/ProtonDrive à compléter
5. **README** - Roadmap obsolète (certaines fonctionnalités déjà implémentées)

---

## 🎯 Axes d'Amélioration Prioritaires

### 🔴 PRIORITÉ 1 - Critiques (1-2 semaines)

#### 1.1. Corriger le Build Gradle
**Problème :** Build échoue avec erreur de vérification de dépendances
```
Dependency verification failed for configuration ':classpath'
- junit-bom-5.9.2.module (org.junit:junit-bom:5.9.2)
- junit-bom-5.9.3.module (org.junit:junit-bom:5.9.3)
```

**Solution :**
- Mettre à jour `gradle/verification-metadata.xml`
- Ou désactiver temporairement la vérification stricte en développement
- Vérifier les checksums des dépendances

**Impact :** Bloque le développement et la CI/CD

**Effort :** 1-2 heures

---

#### 1.2. Finaliser l'Outil de Migration Utilisateurs
**Problème :** Les utilisateurs avec des données Room legacy ne peuvent pas migrer

**État actuel :**
- `VaultRepository` conservé en DEBUG pour compatibilité
- Migration manuelle possible mais pas d'outil automatisé

**Solution :**
Implémenter `LegacyVaultMigrationTool` avec :
1. Détection automatique des vaults Room au lancement
2. Dialog de migration avec prévisualisation
3. Export Room → .gpv avec vérification d'intégrité
4. Backup automatique avant migration
5. Rollback en cas d'échec

**Impact :** Permet de nettoyer le code legacy et simplifier la base de code

**Effort :** 8-12 heures

**Fichiers à créer :**
- `data/migration/LegacyVaultMigrationTool.kt`
- `presentation/migration/MigrationViewModel.kt`
- `presentation/migration/MigrationScreen.kt`

---

#### 1.3. Intégrer Import/Export dans l'UI
**Problème :** `ImportExportRepository` existe mais n'est pas accessible aux utilisateurs

**État actuel :**
- ✅ Backend implémenté (CSV et JSON export/import)
- ❌ Pas de ViewModel
- ❌ Pas d'écran UI
- ❌ Pas de navigation

**Solution :**
1. Créer `ImportExportViewModel`
2. Créer `ImportExportScreen` avec:
   - Sélection du format (CSV/JSON)
   - Choix du fichier de destination/source (SAF)
   - Progress indicator
   - Gestion des erreurs
3. Ajouter la navigation depuis les paramètres du vault
4. Ajouter confirmation pour export CSV (données non chiffrées)

**Impact :** Fonctionnalité critique pour backup/restore et migration depuis autres gestionnaires

**Effort :** 6-8 heures

**Fichiers à créer :**
- `presentation/vault/ImportExportViewModel.kt` (150 lignes)
- `presentation/vault/ImportExportScreen.kt` (300 lignes)
- Mise à jour `navigation/Navigation.kt`

---

#### 1.4. Intégrer QR Scanner dans l'UI
**Problème :** `QrScannerScreen` existe mais n'est pas utilisé

**État actuel :**
- ✅ Backend implémenté (CameraX + ML Kit)
- ❌ Pas intégré dans `EntryEditScreen`
- ❌ Pas de bouton pour lancer le scan

**Solution :**
1. Ajouter bouton "Scanner QR Code" dans la section TOTP de `EntryEditScreen`
2. Lancer `QrScannerScreen` en mode Dialog ou nouvelle route
3. Parser l'URI `otpauth://totp/...` et pré-remplir les champs
4. Gérer les permissions caméra avec UX claire

**Impact :** Améliore grandement l'UX pour la configuration 2FA

**Effort :** 3-4 heures

**Fichiers à modifier :**
- `presentation/vault/EntryEditScreen.kt` (ajout bouton + callback)
- `presentation/vault/EntryViewModel.kt` (méthode parseOtpAuthUri)

---

### 🟠 PRIORITÉ 2 - Importantes (2-4 semaines)

#### 2.1. Compléter les Providers Cloud Templates
**Problème :** OneDrive, pCloud, ProtonDrive à 40% (templates uniquement)

**Solution :**
Pour chaque provider :
1. Implémenter l'authentification OAuth2
2. Implémenter les opérations CRUD (upload, download, delete)
3. Gérer le refresh token
4. Ajouter tests unitaires
5. Créer guide de configuration utilisateur

**Impact :** Offre plus de choix aux utilisateurs pour la sync cloud

**Effort :**
- OneDrive : 12-15 heures (Azure MSAL)
- pCloud : 8-10 heures (OAuth2 simple)
- ProtonDrive : 15-20 heures (API beta, documentation limitée)

**Priorité interne :**
1. OneDrive (popularité)
2. pCloud (privacy)
3. ProtonDrive (sécurité maximale)

---

#### 2.2. Améliorer le Déverrouillage Biométrique
**Problème :** Fonctionnalité à 50%

**État actuel :**
- ✅ Chiffrement master password avec Android Keystore
- ✅ Déverrouillage avec BiometricPrompt
- ⚠️ Gestion des erreurs à améliorer
- ⚠️ UX de configuration à simplifier

**Améliorations :**
1. **Configuration simplifiée**
   - Wizard lors de la création du vault
   - Option "Activer plus tard" visible

2. **Gestion d'erreurs robuste**
   - Fallback vers password si biométrie échoue
   - Explication claire des erreurs (sensor dirty, too many attempts, etc.)
   - Re-enrollment automatique si Keystore invalidé

3. **Paramètres avancés**
   - Option "Biométrie uniquement pour déverrouillage" vs "Pour toutes actions sensibles"
   - Délai de réactivation biométrie après lock

4. **Tests**
   - Tests instrumentés pour tous les scénarios
   - Tests de changement de biométrie (ajout/suppression empreinte)

**Impact :** Améliore significativement l'UX et la sécurité perçue

**Effort :** 10-12 heures

**Fichiers à modifier :**
- `security/BiometricVaultManager.kt` (gestion erreurs)
- `presentation/vault/UnlockVaultScreen.kt` (UX)
- `presentation/vault/CreateVaultScreen.kt` (wizard)

---

#### 2.3. Dashboard de Santé des Mots de Passe
**Problème :** Analyse de sécurité existe mais pas de dashboard visuel

**État actuel :**
- ✅ `PasswordAnalyzer` implémenté
- ✅ Détection mots de passe faibles, doublons
- ⚠️ Have I Been Pwned API intégration basique
- ❌ Pas de dashboard visuel

**Solution :**
Créer `SecurityDashboardScreen` avec :
1. **Vue d'ensemble**
   - Score de sécurité global (0-100)
   - Nombre de mots de passe faibles/compromis/réutilisés
   - Graphique d'évolution dans le temps

2. **Catégories détaillées**
   - Liste des mots de passe faibles (avec bouton "Générer nouveau")
   - Liste des doublons (avec suggestion de modification)
   - Liste des compromis (avec lien vers HaveIBeenPwned)

3. **Actions rapides**
   - "Tout analyser" (scan complet)
   - "Générer tous les faibles" (batch)
   - Export rapport PDF

4. **Notifications**
   - Alerte si nouveau mot de passe compromis détecté
   - Rappel mensuel de vérification

**Impact :** Augmente la sécurité réelle des utilisateurs

**Effort :** 15-18 heures

**Fichiers à créer :**
- `presentation/security/SecurityDashboardViewModel.kt`
- `presentation/security/SecurityDashboardScreen.kt`
- `presentation/security/components/SecurityScoreCard.kt`
- `data/security/HaveIBeenPwnedService.kt` (amélioration)

---

#### 2.4. Optimisation des Performances
**Problème :** Performances OK mais optimisables

**Améliorations :**

1. **Chargement paresseux des vaults**
   - Ne charger que les métadonnées au démarrage
   - Charger le contenu complet uniquement au déverrouillage
   - Implémenter pagination pour très gros vaults (>1000 entrées)

2. **Cache intelligent**
   - Cache en mémoire des entrées récemment consultées
   - Invalidation automatique au lock
   - LRU cache avec taille limite

3. **Optimisation recherche**
   - Index Trie pour recherche full-text rapide
   - Debounce sur le champ de recherche (300ms)
   - Recherche asynchrone avec Flow

4. **Baseline Profiles**
   - Générer profiles pour startup et navigation courantes
   - Macrobenchmark pour mesurer amélioration

5. **Compression .gpv (optionnelle)**
   - Compression gzip pour gros vaults
   - Option dans les paramètres
   - Transparent pour l'utilisateur

**Impact :** Fluidité améliorée, surtout sur devices bas de gamme

**Effort :** 12-15 heures

**Fichiers à créer/modifier :**
- `domain/cache/VaultCache.kt`
- `domain/search/SearchIndex.kt`
- `data/vault/VaultFileManager.kt` (compression)
- `baselineprofile/` (profiles)

---

### 🟡 PRIORITÉ 3 - Nice to Have (1-2 mois)

#### 3.1. Mode Hors Ligne Amélioré
**Amélioration :** Gestion plus intelligente du mode hors ligne

**Fonctionnalités :**
- Queue de synchronisation avec retry automatique
- Indicator visuel du statut de sync par vault
- Résolution de conflits optimiste (merge automatique quand possible)
- Backup local automatique avant sync

**Effort :** 8-10 heures

---

#### 3.2. Widgets Home Screen
**Amélioration :** Widgets pour accès rapide

**Types de widgets :**
1. **Widget Générateur**
   - Générer et copier mot de passe d'un tap
   - Configurable (mode, longueur)

2. **Widget Favoris**
   - Liste des 5 entrées favorites
   - Tap pour copier username/password
   - Requiert déverrouillage biométrique

3. **Widget TOTP**
   - Afficher codes 2FA des favoris
   - Compte à rebours visuel
   - Auto-refresh

**Effort :** 20-25 heures

**Impact :** Améliore grandement l'UX et la rapidité d'accès

---

#### 3.3. Partage Sécurisé
**Fonctionnalité :** Partager des entrées de façon sécurisée

**Implémentation :**
1. **Génération de lien temporaire**
   - Chiffré avec mot de passe unique
   - Expiration configurable (1h-7j)
   - Limite de consultations (1-10)

2. **Serveur intermédiaire**
   - API simple pour stocker temporairement
   - Zero-knowledge (données chiffrées côté client)
   - Auto-destruction après expiration

3. **UI**
   - Bouton "Partager" sur une entrée
   - Configuration (expiration, password)
   - QR code ou lien à copier

**Effort :** 30-40 heures (incluant backend)

**Note :** Nécessite infrastructure backend (coût)

---

#### 3.4. Support des Pièces Jointes
**Fonctionnalité :** Joindre des fichiers aux entrées (photos, PDFs, etc.)

**Implémentation :**
1. Chiffrer fichiers avec AES-256-GCM
2. Stocker dans dossier séparé (ou inline dans .gpv si petit)
3. Prévisualisation pour images
4. Limite de taille (10 MB par fichier)

**Use cases :**
- Photos de documents d'identité
- Copies de cartes bancaires
- PDFs de contrats
- Photos de QR codes de backup 2FA

**Effort :** 15-20 heures

**Impact :** Centralise toutes les données sensibles

---

#### 3.5. Passkeys / WebAuthn Support
**Fonctionnalité :** Support des Passkeys (FIDO2/WebAuthn)

**Implémentation :**
1. Générer et stocker des passkeys
2. Utiliser comme alternative à password + 2FA
3. Synchronisation sécurisée entre devices
4. Intégration avec Android Credential Manager

**Effort :** 25-30 heures

**Impact :** Futur de l'authentification, très sécurisé

**Note :** Nécessite Android 14+ (API 34)

---

### 🔵 PRIORITÉ 4 - Long Terme (3-6 mois)

#### 4.1. Application iOS
**Objectif :** Port iOS avec synchronisation cross-platform

**Approche recommandée :** Kotlin Multiplatform

**Modules partagés :**
- `vault-domain` (business logic)
- `VaultCryptoManager` (crypto)
- `VaultData` (models)
- `CloudProviders` (sync)

**Modules iOS spécifiques :**
- UI (SwiftUI)
- Keychain (équivalent Android Keystore)
- Biometric (FaceID/TouchID)

**Effort :** 200-300 heures

**Impact :** Double la base utilisateurs potentielle

---

#### 4.2. Application Desktop (Windows/macOS/Linux)
**Objectif :** Application desktop avec même format .gpv

**Approche recommandée :** Compose Multiplatform Desktop

**Effort :** 150-200 heures

**Avantages :**
- Même codebase UI que Android (80% partagé)
- Même format .gpv
- Synchronisation via cloud

---

#### 4.3. Extension Navigateur
**Objectif :** Extension Chrome/Firefox pour autofill web

**Fonctionnalités :**
- Autofill automatique des formulaires
- Génération de mots de passe
- Communication sécurisée avec l'app Android/Desktop
- Stockage local chiffré optionnel

**Effort :** 120-150 heures

**Impact :** Complète l'écosystème

---

## 📋 Roadmap Recommandée

### Sprint 1 (1-2 semaines) - Corrections Critiques
- [x] Documentation architecture (FAIT)
- [ ] Corriger build Gradle
- [ ] Intégrer QR Scanner dans UI
- [ ] Intégrer Import/Export dans UI
- [ ] Mettre à jour README (roadmap)

### Sprint 2 (2-3 semaines) - Migration & UX
- [ ] Finaliser outil migration utilisateurs
- [ ] Améliorer déverrouillage biométrique
- [ ] Dashboard sécurité (base)
- [ ] Tests supplémentaires

### Sprint 3 (3-4 semaines) - Cloud & Performance
- [ ] Implémenter OneDrive provider
- [ ] Optimisations performance
- [ ] Compression .gpv optionnelle
- [ ] Baseline profiles

### Sprint 4 (1-2 mois) - Polish & Features
- [ ] Implémenter pCloud provider
- [ ] Mode hors ligne amélioré
- [ ] Widgets home screen
- [ ] Documentation utilisateur

### Sprint 5+ (2-6 mois) - Expansion
- [ ] Partage sécurisé
- [ ] Support pièces jointes
- [ ] Passkeys/WebAuthn
- [ ] iOS app (Kotlin Multiplatform)

---

## 🎯 Métriques de Succès

### Technique
- ✅ Build passe sans erreur
- ✅ Couverture de tests > 90%
- ✅ Aucun warning de sécurité
- ✅ Performance: startup < 1s, unlock < 500ms

### Fonctionnel
- ✅ Toutes fonctionnalités backend exposées en UI
- ✅ Migration utilisateurs 100% automatisée
- ✅ 3+ cloud providers opérationnels
- ✅ Dashboard sécurité complet

### Qualité
- ✅ Crashes < 0.5%
- ✅ Note Play Store > 4.5/5
- ✅ Temps de réponse support < 24h
- ✅ Documentation complète et à jour

---

## 💡 Recommandations Générales

### Code Quality
1. **Activer ktlint strict** - Actuellement beaucoup de checks désactivés
2. **Augmenter couverture Detekt** - Utiliser toutes les règles recommandées
3. **CI/CD amélioration** - Ajouter tests de performance dans la CI
4. **Code review** - Établir process de review systématique

### Sécurité
1. **Audit externe** - Faire auditer le code crypto par expert
2. **Penetration testing** - Tests de sécurité applicative
3. **Bug bounty** - Programme de bug bounty après release
4. **Certifications** - Viser certifications de sécurité

### UX/UI
1. **User testing** - Tests avec vrais utilisateurs (alpha/beta)
2. **Accessibilité** - Support TalkBack complet
3. **Animations** - Micro-interactions pour feedback visuel
4. **Dark mode** - Améliorer contraste et lisibilité

### Documentation
1. **Guide utilisateur** - Documentation complète pour utilisateurs finaux
2. **FAQ** - Section FAQ sur site web
3. **Tutoriels vidéo** - Screencasts pour fonctionnalités clés
4. **Blog technique** - Articles sur architecture et décisions

---

## 🚀 Quick Wins (Résultats Rapides)

Ces améliorations ont un excellent ratio impact/effort :

1. **Corriger Gradle** (1-2h) → Débloquer développement
2. **Intégrer QR Scanner** (3-4h) → Amélioration UX majeure
3. **Intégrer Import/Export** (6-8h) → Fonctionnalité critique
4. **Mettre à jour README** (1h) → Documentation précise
5. **Baseline Profiles** (2-3h) → +20% performance startup

**Total Quick Wins : 13-18 heures pour impact massif**

---

## 📞 Prochaines Étapes

### Immédiat (Cette Semaine)
1. Décider des priorités avec l'équipe
2. Corriger le build Gradle
3. Commencer intégration QR Scanner

### Court Terme (2 Semaines)
4. Finaliser Sprint 1 complet
5. Tester avec beta testers
6. Planifier Sprint 2

### Moyen Terme (1 Mois)
7. Compléter Sprints 1-2
8. Premier provider cloud supplémentaire
9. Préparer release alpha

---

**Document créé le :** 2025-10-30
**Par :** Claude Code - Analyse & Recommandations
**Statut :** 📋 Plan d'action prêt pour exécution
