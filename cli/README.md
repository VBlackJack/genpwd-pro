# GenPwd Pro CLI

Générateur de mots de passe sécurisés en ligne de commande pour développeurs.

## 📦 Installation

### npm (global)

```bash
npm install -g @genpwd-pro/cli
```

### npx (sans installation)

```bash
npx @genpwd-pro/cli [options]
```

### Installation locale

```bash
npm install @genpwd-pro/cli
npx genpwd [options]
```

## 🚀 Utilisation

### Commande de base

```bash
# Générer un mot de passe syllabique (par défaut)
genpwd

# Générer 5 mots de passe
genpwd -q 5

# Générer une passphrase de 6 mots
genpwd -m passphrase -w 6

# Générer en mode leet speak
genpwd -m leet -W MyPassword
```

### Options

```
Options:
  -V, --version              Afficher le numéro de version
  -h, --help                 Afficher l'aide

  -m, --mode <mode>          Mode de génération (syllables, passphrase, leet) (default: "syllables")
  -l, --length <number>      Longueur du mot de passe (6-64) (default: "20")
  -w, --words <number>       Nombre de mots (passphrase) (default: "5")
  -d, --digits <number>      Nombre de chiffres (0-6) (default: "2")
  -s, --specials <number>    Nombre de caractères spéciaux (0-6) (default: "2")
  -c, --case <mode>          Mode de casse (mixte, upper, lower, title) (default: "mixte")
  -p, --policy <policy>      Politique de caractères (standard, alphanumerique) (default: "standard")
  -q, --quantity <number>    Quantité de mots de passe à générer (default: "1")
  -S, --separator <char>     Séparateur pour passphrase (default: "-")
  -D, --dictionary <lang>    Dictionnaire (french, english, latin) (default: "french")
  -W, --word <word>          Mot à transformer (leet mode) (default: "password")
  --json                     Sortie au format JSON
  --no-entropy               Ne pas afficher l'entropie
  --copy                     Copier le premier mot de passe dans le presse-papiers
```

## 📚 Exemples

### Mode Syllabes

```bash
# Mot de passe de 30 caractères avec 3 chiffres et 3 spéciaux
genpwd -l 30 -d 3 -s 3

# Alphanumérique uniquement (sans caractères spéciaux)
genpwd -p alphanumerique -s 0

# Majuscules uniquement
genpwd -c upper

# 10 mots de passe courts
genpwd -l 12 -q 10
```

### Mode Passphrase

```bash
# Passphrase française de 5 mots
genpwd -m passphrase -w 5 -D french

# Passphrase anglaise de 7 mots avec point comme séparateur
genpwd -m passphrase -w 7 -D english -S .

# Passphrase latine
genpwd -m passphrase -D latin
```

### Mode Leet Speak

```bash
# Transformer un mot en leet speak
genpwd -m leet -W SuperSecure

# Leet speak avec 4 chiffres
genpwd -m leet -W MyApp2025 -d 4
```

### Format JSON

```bash
# Sortie JSON pour intégration dans scripts
genpwd --json

# Sortie JSON formatée
genpwd --json | jq .

# Extraire uniquement le mot de passe
genpwd --json | jq -r '.[0].value'
```

### Scripts Bash

```bash
#!/bin/bash
# Générer et stocker dans une variable
PASSWORD=$(genpwd --no-entropy)
echo "Mot de passe généré: $PASSWORD"

# Utiliser dans un script d'automatisation
DB_PASSWORD=$(genpwd -l 32 -d 4 -s 4 --no-entropy)
mysql -u root -p"$DB_PASSWORD" -e "CREATE USER 'app'@'localhost' IDENTIFIED BY '$DB_PASSWORD';"

# Générer plusieurs mots de passe pour des utilisateurs
for user in alice bob charlie; do
  password=$(genpwd --no-entropy)
  echo "$user:$password" >> users.txt
done
```

### Scripts Node.js

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function generatePassword() {
  const { stdout } = await execAsync('genpwd --json');
  const result = JSON.parse(stdout);
  return result[0].value;
}

const password = await generatePassword();
console.log('Generated:', password);
```

### Scripts Python

```python
import subprocess
import json

def generate_password(length=20, digits=2, specials=2):
    result = subprocess.run(
        ['genpwd', '-l', str(length), '-d', str(digits), '-s', str(specials), '--json'],
        capture_output=True,
        text=True
    )
    data = json.loads(result.stdout)
    return data[0]['value']

password = generate_password(30, 3, 3)
print(f"Generated: {password}")
```

## 🔐 Sécurité

- **Randomness cryptographique** : Utilise `crypto.getRandomValues()` via Node.js `webcrypto`
- **Entropie calculée** : Affichage de l'entropie en bits pour chaque mot de passe
- **Pas de stockage** : Aucun mot de passe n'est sauvegardé ou envoyé à des serveurs
- **Open source** : Code source auditable sur GitHub

## 📊 Calcul de l'Entropie

L'entropie mesure la force d'un mot de passe :

- **< 40 bits** : Faible (vulnérable)
- **40-60 bits** : Moyen
- **60-80 bits** : Fort
- **> 80 bits** : Très Fort (recommandé)

Exemples :

```bash
$ genpwd -l 20 -d 2 -s 2
duNokUpYg!aKuKYMaci5@
  └─ Entropy: 103.4 bits (Très Fort)

$ genpwd -m passphrase -w 6
Forcer-Vague-Nature-Coeur-Liberte-Soleil47@
  └─ Entropy: 77.5 bits (Fort)
```

## 🛠️ Développement

### Cloner le dépôt

```bash
git clone https://github.com/VBlackJack/genpwd-pro.git
cd genpwd-pro/cli
```

### Installer les dépendances

```bash
npm install
```

### Tester localement

```bash
node bin/genpwd.js --help
```

### Lancer les tests

```bash
npm test
```

### Publier sur npm

```bash
npm login
npm publish --access public
```

## 📄 Licence

Apache License 2.0 - Copyright 2025 Julien Bombled

## 🔗 Liens

- [Projet GitHub](https://github.com/VBlackJack/genpwd-pro)
- [Documentation complète](../docs/CLI.md)
- [Signaler un bug](https://github.com/VBlackJack/genpwd-pro/issues)
- [npm package](https://www.npmjs.com/package/@genpwd-pro/cli)
