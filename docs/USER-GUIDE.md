# Guide Utilisateur - GenPwd Pro v2.6.0

> Guide complet pour maîtriser toutes les fonctionnalités du générateur de mots de passe

## Table des matières

1. [Démarrage rapide](#démarrage-rapide)
2. [Modes de génération](#modes-de-génération)
3. [Placement avancé](#placement-avancé)
4. [Système de blocs de casse](#système-de-blocs-de-casse)
5. [Dictionnaires multilingues](#dictionnaires-multilingues)
6. [Tests intégrés](#tests-intégrés)
7. [Conseils de sécurité](#conseils-de-sécurité)

## 🚀 Démarrage rapide

### Premier lancement

1. **Ouvrez l'application** dans votre navigateur
2. L'interface dark theme s'affiche avec les options principales
3. **Choisissez un mode** : Syllables (défaut), Passphrase ou Leet
4. **Cliquez sur "Générer"** pour créer votre premier mot de passe
5. **Copiez** le résultat avec le bouton dédié

### Interface principale

L'interface se compose de :
- **Zone de configuration** : Mode, longueur, options
- **Bouton de génération** : Action principale avec animation
- **Zone de résultat** : Affichage du mot de passe avec indicateur d'entropie
- **Actions rapides** : Copier, Masquer/Afficher, Exporter
- **Zone de tests** : Validation automatique des fonctionnalités

## 🎯 Modes de génération

### Mode Syllables (Prononcable)

**Cas d'usage** : Mots de passe mémorisables mais sécurisés

Le mode Syllables crée des mots de passe prononcables en alternant consonnes et voyelles :

```
Exemple court : nywOVyQep.Ocy (36.8 bits)
Exemple sécurisé : nywOVyQep.OcyBoWEFY8KiLu (89.4 bits)
Pour atteindre 100+ bits : 25+ caractères recommandés
```

**Options disponibles** :
- **Longueur** : 3 à 10 syllabes
- **Caractères spéciaux** : Insertion automatique ou manuelle
- **Chiffres** : Placement intelligent en fin de mot

**Avantages** :
- ✅ Facile à mémoriser phonétiquement
- ✅ Très haute entropie (jusqu'à 140 bits)
- ✅ Compatible avec tous les systèmes

### Mode Passphrase (Mots séparés)

**Cas d'usage** : Phrases de passe longues mais simples à retenir

Génère une phrase composée de mots réels séparés par des caractères :

```
Exemple : Forcer-Vague-Nature2
Entropie : 105 bits
Dictionnaire : 2429 mots français
```

**Options disponibles** :
- **Nombre de mots** : 3 à 8 mots
- **Séparateurs** : `-`, `_`, `.` ou espace
- **Casse** : Title Case, MAJUSCULES, minuscules
- **Dictionnaire** : Français, English, Latin

**Stratégies de mémorisation** :
1. Créez une histoire avec les mots
2. Utilisez la première lettre de chaque mot
3. Associez à des images mentales

### Mode Leet Speak (L33t)

**Cas d'usage** : Transformation de mots familiers en version sécurisée

Convertit du texte normal en leet speak avec substitutions :

```
Exemple : P@55W0RD_
Transformations : a→@, e→3, o→0, s→5
```

**Table de conversion** :
| Lettre | Leet | Lettre | Leet |
|--------|------|--------|------|
| a/A | @ | o/O | 0 |
| e/E | 3 | s/S | 5 |
| i/I | 1 | t/T | 7 |
| l/L | ! | g/G | 9 |

**Conseils** :
- Partez d'un mot que vous connaissez
- Appliquez les transformations systématiquement
- Ajoutez des caractères en début/fin

## 📍 Placement avancé

### Système de placement visuel

Le placement visuel permet de positionner précisément les caractères spéciaux :

```
Début    : #6HOBumefyri
Milieu   : HoBu#6mefyri  
Fin      : HOBumefyri#6
```

### Utilisation de l'interface

1. **Activez le mode placement** en cliquant sur l'icône 📍
2. **Glissez la barre** pour choisir la position (0-100%)
3. **Aperçu en temps réel** du placement
4. **Générez** pour appliquer le placement

### Stratégies de placement

**Début (0-20%)** : Idéal pour satisfaire les exigences "commence par un caractère spécial"
```
Exemple : @3RIQafosifyvunacy
Usage : Systèmes exigeant un symbole en premier
```

**Milieu (40-60%)** : Distribution équilibrée, moins prévisible
```
Exemple : RIQafo@3sifyvunacy
Usage : Maximum de sécurité contre les attaques
```

**Fin (80-100%)** : Compatible avec la plupart des systèmes legacy
```
Exemple : RIQafosifyvunacy@3
Usage : Bases de données anciennes, systèmes restrictifs
```

## 🎨 Système de blocs de casse

### Comprendre les blocs U/T/L

Le système de blocs permet de créer des patterns de casse personnalisés :

- **U (UPPER)** : Tout en MAJUSCULES
- **T (Title)** : Première Lettre Majuscule
- **L (lower)** : tout en minuscules

### Exemples de patterns

**Pattern U-T-L** :
```
PREMIER-Deuxieme-troisieme
```

**Pattern T-T-T** (défaut) :
```
Premier-Deuxieme-Troisieme
```

**Pattern L-U-L** :
```
premier-DEUXIEME-troisieme
```

### Création de patterns personnalisés

1. **Définissez votre pattern** : Ex: "U-L-T-L"
2. **Appliquez aux mots générés**
3. **Résultat** : PREMIER-deuxieme-Troisieme-quatrieme

**Cas d'usage** :
- Respect de politiques d'entreprise spécifiques
- Amélioration de la mémorisation par pattern visuel
- Contournement de filtres de mots de passe

## 🌍 Dictionnaires multilingues

### Dictionnaires disponibles

| Langue | Mots | Fichier | Entropie/mot |
|--------|------|---------|--------------|
| Français | 2429 | french.json | ~11.2 bits |
| English | 3000+ | english.json | ~11.5 bits |
| Latin | 1500+ | latin.json | ~10.5 bits |

### Changement de langue

1. **Ouvrez les paramètres** (icône ⚙️)
2. **Sélectionnez la langue** dans le menu déroulant
3. Le dictionnaire se **charge dynamiquement**
4. **Générez** un nouveau mot de passe

### Ajout de dictionnaires personnalisés

Pour ajouter votre propre dictionnaire :

1. **Créez un fichier JSON** dans `/dictionaries/`
```json
{
  "language": "italian",
  "words": ["casa", "sole", "mare", "cielo", ...]
}
```

2. **Déclarez dans `dictionaries.js`** :
```javascript
AVAILABLE_DICTIONARIES.set('italian', {
  path: '/dictionaries/italian.json',
  wordCount: 2000
});
```

3. **Rechargez l'application**

## 🧪 Tests intégrés

### Lancement des tests

**Via l'interface** :
1. Cliquez sur le bouton "Tests" en bas de l'interface
2. La modal s'ouvre avec la progression
3. Résultats détaillés après ~30 secondes

**Via la console** :
```bash
npm run test
```

### Interprétation des résultats

```
📊 RAPPORT FINAL - Score: 100%
✅ Tests réussis: 13 | ❌ Tests échoués: 0
```

**Signification des tests** :

| Test | Vérifie | Succès = |
|------|---------|----------|
| Syllables Base | Génération standard | Pattern correct, entropie >100 bits |
| Passphrase | Mots du dictionnaire | Mots valides, séparateurs OK |
| Leet | Transformations | Au moins 3 substitutions |
| Placement | Position caractères | Respect de la position demandée |
| Blocks | Patterns de casse | Application correcte U/T/L |
| UI | Interface | Boutons fonctionnels, copie OK |

### Diagnostic des problèmes

**Test échoué** : Vérifiez :
- Console JavaScript pour les erreurs
- Dictionnaires correctement chargés
- Permissions du navigateur (clipboard)

## 🔐 Conseils de sécurité

### Bonnes pratiques

#### Longueur optimale
- **Minimum** : 12 caractères (80+ bits d'entropie)
- **Recommandé** : 16-20 caractères (100+ bits)
- **Maximum sécurité** : 20+ caractères (120+ bits)

#### Composition idéale
```
✅ Majuscules + minuscules + chiffres + spéciaux
✅ Éviter les mots du dictionnaire non transformés
✅ Pas d'informations personnelles
✅ Unique pour chaque service
```

### ⚠️ Attention aux fausses entropies

Certains générateurs affichent des valeurs d'entropie gonflées artificiellement. 
Les vraies valeurs pour des mots de passe standards :
- 6 caractères : ~35-40 bits maximum
- 12 caractères : ~70-80 bits  
- 18+ caractères : 100+ bits possibles

### Stockage sécurisé

**Recommandations** :
1. **Gestionnaire de mots de passe** (recommandé)
2. **Carnet physique** dans un coffre
3. **Jamais** : Post-it, fichier texte, email

### Renouvellement

**Fréquence suggérée** :
- Services critiques : Tous les 3-6 mois
- Services standards : Tous les 12 mois
- Après incident : Immédiatement

### Indicateurs de compromission

Changez immédiatement si :
- 🚨 Notification de breach/fuite
- 🚨 Activité suspecte sur le compte
- 🚨 Email de réinitialisation non sollicité
- 🚨 Le service a été piraté

## 💡 Astuces avancées

### Combinaison de modes

Créez des mots de passe ultra-sécurisés en combinant :
1. Générez une passphrase
2. Appliquez le leet speak à certains mots
3. Ajoutez un placement personnalisé

**Résultat** : `@Soleil-Pl@g3-Vacances-2024!`

### Mémorisation efficace

**Technique de l'histoire** :
1. Passphrase : `Cheval-Galoper-Prairie-Vent`
2. Histoire : "Le cheval galope dans la prairie avec le vent"
3. Ajoutez votre touche : `Cheval7-Galoper-Prairie-Vent!`

### Export et sauvegarde

L'export JSON contient :
```json
{
  "password": "VotreMotDePasse",
  "entropy": 120.5,
  "mode": "passphrase",
  "timestamp": "2024-01-15T10:30:00Z",
  "options": {
    "length": 5,
    "dictionary": "french"
  }
}
```

---

<div align="center">
  <b>Besoin d'aide ?</b><br>
  Consultez la <a href="./TECHNICAL.md">documentation technique</a> ou créez une <a href="https://github.com/VBlackJack/genpwd-pro/issues">issue sur GitHub</a>
</div>
