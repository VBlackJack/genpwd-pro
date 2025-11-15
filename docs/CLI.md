# GenPwd Pro CLI - Documentation Complète

Générateur de mots de passe sécurisés en ligne de commande pour développeurs et scripts d'automatisation.

## 📋 Table des Matières

- [Installation](#installation)
- [Utilisation Rapide](#utilisation-rapide)
- [Options et Paramètres](#options-et-paramètres)
- [Modes de Génération](#modes-de-génération)
- [Exemples Avancés](#exemples-avancés)
- [Intégration](#intégration)
- [API Programmatique](#api-programmatique)
- [Sécurité](#sécurité)
- [Publication npm](#publication-npm)

## 📦 Installation

### Installation Globale (Recommandé)

```bash
npm install -g @genpwd-pro/cli
```

Après installation, la commande `genpwd` est disponible globalement.

### Utilisation avec npx (Sans Installation)

```bash
npx @genpwd-pro/cli [options]
```

### Installation Locale (Projet)

```bash
npm install @genpwd-pro/cli
npx genpwd [options]
```

## 🚀 Utilisation Rapide

```bash
# Générer un mot de passe (défaut: syllables, 20 caractères)
genpwd

# Afficher l'aide
genpwd --help

# Afficher la version
genpwd --version
```

## ⚙️ Options et Paramètres

### Options Générales

| Option | Alias | Description | Défaut |
|--------|-------|-------------|--------|
| `--version` | `-V` | Afficher la version | - |
| `--help` | `-h` | Afficher l'aide | - |
| `--json` | - | Sortie au format JSON | false |
| `--no-entropy` | - | Ne pas afficher l'entropie | false |
| `--copy` | - | Copier dans le presse-papiers | false |

### Options de Génération

| Option | Alias | Description | Valeurs | Défaut |
|--------|-------|-------------|---------|--------|
| `--mode` | `-m` | Mode de génération | syllables, passphrase, leet | syllables |
| `--length` | `-l` | Longueur (syllables) | 6-64 | 20 |
| `--words` | `-w` | Nombre de mots (passphrase) | 2-8 | 5 |
| `--digits` | `-d` | Nombre de chiffres | 0-6 | 2 |
| `--specials` | `-s` | Nombre de spéciaux | 0-6 | 2 |
| `--case` | `-c` | Mode de casse | mixte, upper, lower, title | mixte |
| `--policy` | `-p` | Politique caractères | standard, alphanumerique | standard |
| `--quantity` | `-q` | Quantité générée | 1-100 | 1 |
| `--separator` | `-S` | Séparateur (passphrase) | any char | - |
| `--dictionary` | `-D` | Dictionnaire | french, english, latin | french |
| `--word` | `-W` | Mot à transformer (leet) | any string | password |

## 📖 Modes de Génération

### 1. Mode Syllabes (Défaut)

Génère des mots de passe basés sur l'alternance consonnes/voyelles.

**Avantages** :
- Prononçable (facile à retenir temporairement)
- Haute entropie
- Configurable (longueur, politique)

**Exemples** :

```bash
# Basique (20 caractères)
genpwd
# → duNokUpYg!aKuKYMaci5@

# 30 caractères avec 3 chiffres et 3 spéciaux
genpwd -l 30 -d 3 -s 3
# → fyRiVuCeNyGoLyTuKaMuWyXePo2!8@

# Alphanumérique uniquement (pas de spéciaux)
genpwd -p alphanumerique -s 0
# → buKeZiDaMoRuPyNiFu67

# Majuscules uniquement
genpwd -c upper -l 16
# → DUKOZYPAGAKUKYMA52!@

# Title case (première lettre majuscule)
genpwd -c title -l 24
# → Dunokygokakykymacizy5@!
```

### 2. Mode Passphrase

Génère des passphrases basées sur des dictionnaires de mots.

**Avantages** :
- Très mémorable
- Haute entropie avec suffisamment de mots
- Support multi-langues

**Exemples** :

```bash
# Passphrase française de 5 mots
genpwd -m passphrase
# → Forcer-Vague-Nature-Coeur-Liberte47@

# Passphrase anglaise de 7 mots
genpwd -m passphrase -w 7 -D english
# → Market-Shadow-Forest-Ocean-Planet-Window-Thunder23!

# Passphrase avec point comme séparateur
genpwd -m passphrase -S .
# → Abri.Acier.Actif.Aimer.Algue47@

# Passphrase latine
genpwd -m passphrase -D latin -w 6
# → Amor-Aqua-Caelum-Domus-Fides-Gens12!

# Passphrase sans chiffres ni spéciaux
genpwd -m passphrase -d 0 -s 0
# → Forcer-Vague-Nature-Coeur-Liberte
```

### 3. Mode Leet Speak

Transforme un mot avec des substitutions leet speak.

**Substitutions** :
- a/A → @
- e/E → 3
- i/I → 1
- o/O → 0
- s/S → 5
- t/T → 7
- l/L → !
- g/G → 9
- b/B → 8

**Exemples** :

```bash
# Transformer "password"
genpwd -m leet
# → P@55W0RD47!

# Transformer "SuperSecure"
genpwd -m leet -W SuperSecure
# → 5UP3R53CUR347!

# Transformer avec 4 chiffres
genpwd -m leet -W MyApp2025 -d 4
# → MY@PP20251234!

# Sans caractères spéciaux
genpwd -m leet -W Database -s 0
# → D@7@8@5312
```

## 🎯 Exemples Avancés

### Génération en Masse

```bash
# Générer 10 mots de passe
genpwd -q 10

# Générer 20 passphrases courtes
genpwd -m passphrase -w 4 -q 20

# Générer 50 mots de passe alphanuméeriques de 12 caractères
genpwd -l 12 -p alphanumerique -s 0 -q 50
```

### Sortie JSON

```bash
# Format JSON
genpwd --json
# → [{ "value": "duNokUpYg!aKuKYMaci5@", "entropy": 103.4, "mode": "syllables", ... }]

# JSON formaté avec jq
genpwd --json | jq .

# Extraire uniquement le mot de passe
genpwd --json | jq -r '.[0].value'

# Extraire l'entropie
genpwd --json | jq -r '.[0].entropy'

# Générer 5 et afficher en JSON
genpwd -q 5 --json | jq -r '.[] | "\(.value) (\(.entropy) bits)"'
```

### Copie dans le Presse-papiers

```bash
# Copier automatiquement (requiert clipboardy)
genpwd --copy

# Générer et copier une passphrase
genpwd -m passphrase --copy

# Installation de clipboardy si nécessaire
npm install -g clipboardy
```

## 🔧 Intégration

### Scripts Bash

```bash
#!/bin/bash

# Stocker dans une variable
PASSWORD=$(genpwd --no-entropy)
echo "Password: $PASSWORD"

# Utiliser pour MySQL
DB_PASSWORD=$(genpwd -l 32 -d 4 -s 4 --no-entropy)
mysql -u root -p"$DB_PASSWORD" -e "CREATE DATABASE mydb;"

# Générer pour plusieurs utilisateurs
for user in alice bob charlie; do
  password=$(genpwd --no-entropy)
  echo "$user:$password" >> users.txt
  echo "Generated for $user: $password"
done

# Génération conditionnelle
if [ ! -f .env ]; then
  SECRET_KEY=$(genpwd -l 64 --no-entropy)
  echo "SECRET_KEY=$SECRET_KEY" > .env
fi
```

### Scripts Node.js

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function generatePassword(options = {}) {
  const args = [
    '--json',
    ...(options.length ? [`-l`, options.length] : []),
    ...(options.mode ? [`-m`, options.mode] : []),
    ...(options.quantity ? [`-q`, options.quantity] : [])
  ];

  const { stdout } = await execAsync(`genpwd ${args.join(' ')}`);
  const result = JSON.parse(stdout);
  return result;
}

// Usage
const passwords = await generatePassword({ length: 30, quantity: 5 });
passwords.forEach(p => {
  console.log(`${p.value} (${p.entropy.toFixed(1)} bits)`);
});
```

### Scripts Python

```python
import subprocess
import json

def generate_password(mode='syllables', length=20, digits=2, specials=2, quantity=1):
    """Generate password using genpwd CLI"""
    cmd = [
        'genpwd',
        '-m', mode,
        '-l', str(length),
        '-d', str(digits),
        '-s', str(specials),
        '-q', str(quantity),
        '--json'
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    return data

# Usage
passwords = generate_password(length=30, quantity=5)
for pwd in passwords:
    print(f"{pwd['value']} ({pwd['entropy']:.1f} bits)")

# Passphrase
passphrases = generate_password(mode='passphrase', digits=0, specials=0)
print(passphrases[0]['value'])
```

### Makefile

```makefile
.PHONY: generate-secrets

generate-secrets:
	@echo "Generating secrets..."
	@echo "DB_PASSWORD=$$(genpwd -l 32 --no-entropy)" > .env
	@echo "SECRET_KEY=$$(genpwd -l 64 --no-entropy)" >> .env
	@echo "API_KEY=$$(genpwd -l 40 --no-entropy)" >> .env
	@echo "Secrets generated in .env"
```

### Docker Compose

```yaml
version: '3.8'

services:
  app:
    image: myapp:latest
    environment:
      - DB_PASSWORD=${DB_PASSWORD}
    command: sh -c "npm start"

# Generate passwords:
# DB_PASSWORD=$(genpwd -l 32 --no-entropy) docker-compose up
```

### CI/CD (GitHub Actions)

```yaml
name: Deploy

on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Install GenPwd CLI
        run: npm install -g @genpwd-pro/cli

      - name: Generate secrets
        run: |
          genpwd -l 32 --no-entropy > db_password.txt
          genpwd -m passphrase -w 6 --no-entropy > master_passphrase.txt

      - name: Use secrets
        run: |
          DB_PASSWORD=$(cat db_password.txt)
          echo "::add-mask::$DB_PASSWORD"
          # Use $DB_PASSWORD in deployment
```

## 📚 API Programmatique

Vous pouvez aussi utiliser GenPwd Pro comme bibliothèque Node.js :

```javascript
import { generatePassword } from '@genpwd-pro/cli/lib/generator.js';

const config = {
  mode: 'syllables',
  length: 20,
  digits: 2,
  specials: 2,
  caseMode: 'mixte',
  policy: 'standard',
  quantity: 5
};

const results = await generatePassword(config);
results.forEach(result => {
  console.log(result.value);        // Password
  console.log(result.entropy);      // Entropy in bits
  console.log(result.strength);     // Faible/Moyen/Fort/Très Fort
});
```

## 🔐 Sécurité

### Randomness Cryptographique

GenPwd CLI utilise `crypto.webcrypto.getRandomValues()` de Node.js pour générer des nombres aléatoires cryptographiquement sécurisés.

```javascript
// Implémentation interne (helpers.js)
import { webcrypto } from 'node:crypto';

function randInt(min, max) {
  const range = max - min + 1;
  // Rejection sampling pour éviter le biais modulo
  // ...
  crypto.getRandomValues(randomBytes);
  // ...
}
```

### Calcul de l'Entropie

L'entropie est calculée en bits selon la formule :

```
Entropy = length × log₂(charset_size)
```

**Niveaux de force** :
- **< 40 bits** : Faible (vulnérable au brute force)
- **40-60 bits** : Moyen
- **60-80 bits** : Fort
- **> 80 bits** : Très Fort (recommandé)

**Exemples** :

| Password | Longueur | Charset | Entropie | Force |
|----------|----------|---------|----------|-------|
| `abc123` | 6 | 36 | 31 bits | Faible |
| `duNokUpYg!aKu` | 14 | 94 | 91 bits | Très Fort |
| `Forcer-Vague-Nature` | 3 mots | 800 | 58 bits | Moyen |
| `Market-Shadow-Forest-Ocean-Planet` | 5 mots | 1000 | 100 bits | Très Fort |

### Bonnes Pratiques

✅ **DO** :
- Utiliser `--mode syllables` avec `-l 20` minimum
- Utiliser `--mode passphrase` avec `-w 5` minimum
- Afficher l'entropie (`--entropy`) pour vérifier la force
- Stocker les mots de passe dans un gestionnaire sécurisé (Bitwarden, 1Password)
- Utiliser `--json` pour l'automatisation

❌ **DON'T** :
- Ne pas stocker les mots de passe en clair dans des fichiers non chiffrés
- Ne pas réutiliser le même mot de passe
- Ne pas utiliser des longueurs < 12 caractères
- Ne pas désactiver les chiffres ET les spéciaux en même temps

## 📦 Publication npm

### Publier le Package

```bash
cd cli

# Vérifier le package.json
cat package.json

# Tester localement
npm test

# Se connecter à npm
npm login

# Publier (première fois)
npm publish --access public

# Publier une mise à jour
npm version patch  # ou minor, ou major
npm publish
```

### Versions

Utilisez [Semantic Versioning](https://semver.org/) :
- **MAJOR** : Breaking changes (1.0.0 → 2.0.0)
- **MINOR** : Nouvelles fonctionnalités (1.0.0 → 1.1.0)
- **PATCH** : Corrections de bugs (1.0.0 → 1.0.1)

```bash
npm version major  # 1.0.0 → 2.0.0
npm version minor  # 1.0.0 → 1.1.0
npm version patch  # 1.0.0 → 1.0.1
```

## 📄 Licence

Apache License 2.0 - Copyright 2025 Julien Bombled

## 🔗 Liens

- [npm package](https://www.npmjs.com/package/@genpwd-pro/cli)
- [GitHub](https://github.com/VBlackJack/genpwd-pro)
- [Documentation](https://github.com/VBlackJack/genpwd-pro/tree/main/docs)
- [Signaler un bug](https://github.com/VBlackJack/genpwd-pro/issues)
