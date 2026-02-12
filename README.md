# GenPwd Pro

> **v3.1.1** — Password generator + encrypted vault + TOTP

[🇫🇷 Français](#-version-française) | [🇬🇧 English](#-english-version)

---

# 🇫🇷 Version Française

## A propos

**GenPwd Pro** est un gestionnaire de mots de passe que j'ai construit parce que je voulais un outil simple, gratuit et qui respecte vraiment la vie privee. Pas de compte a creer, pas de cloud obligatoire, pas de pub — juste un generateur solide et un coffre-fort chiffre.

C'est une alternative open source a KeePass, Bitwarden ou 1Password.

## Fonctionnalites

- **Generateur intelligent** — 3 modes : prononcable, phrase de mots, transformation Leet
- **Coffre-fort chiffre** — Argon2id + XSalsa20-Poly1305 (Electron), stockage 100% local
- **TOTP / 2FA** — Codes d'authentification a deux facteurs (compatible Google Authenticator)
- **Audit de securite** — Detection des mots de passe faibles, reutilises ou anciens
- **Import / Export** — KeePass 2.x XML, Bitwarden JSON, CSV generique
- **Organisation** — Dossiers, tags, favoris
- **Historique** — Retrouvez vos mots de passe generes recemment
- **5 themes** — Sombre, clair, contraste eleve, ocean, foret
- **3 langues** — Francais, English, Espanol
- **Accessible** — WCAG 2.1, navigation clavier, lecteurs d'ecran (NVDA, JAWS, VoiceOver)

### Desktop (Electron)

- **System Tray** avec generation rapide
- **Raccourci global** `Ctrl+Shift+P` (Boss Key)
- **Mode compact** — widget flottant Always on Top
- **Verrouillage auto** apres inactivite

## Plateformes

| Plateforme | Statut |
|-----------|--------|
| [**Web**](https://vblackjack.github.io/genpwd-pro/) | Disponible — aucune installation |
| [**Windows**](https://github.com/VBlackJack/genpwd-pro/releases) | Disponible — installeur, portable ou ZIP |
| **Extension navigateur** | Bientot disponible |
| **Android** | Bientot disponible |

> Mac et Linux arrivent prochainement.

## Demarrage rapide

1. Ouvrez [vblackjack.github.io/genpwd-pro](https://vblackjack.github.io/genpwd-pro/) (ou lancez l'appli desktop)
2. Choisissez un mode, reglez la longueur (16+ caracteres recommande)
3. Cliquez **Generer**, puis **Copier**

C'est tout.

## Modes de generation

### Prononcable (Syllables)

Des mots de passe qui ressemblent a de vrais mots — faciles a lire et a taper.

```
NyWoVyQep!Ocy8
DuNoKuPeRa!Ki7Lu
```

- Longueur : 12-25 caracteres (16 recommande)
- Options : chiffres, caracteres speciaux

### Phrase de mots (Passphrase)

Plusieurs vrais mots du dictionnaire, separes par des tirets.

```
Soleil-Vague-Nature-Montagne7
Forcer_Prairie_Vent_Nuage!
```

- 3 a 6 mots (4 recommande)
- Separateur : `-` `_` `.`
- Dictionnaires : francais (2 429 mots), anglais (3 000+), latin (1 500+)

Astuce : inventez une petite histoire avec les mots pour les retenir.

### Transformation Leet

Transforme un mot ou une phrase en remplacant des lettres par des chiffres/symboles.

```
P@55W0RD!        (depuis "PASSWORD")
S0l31l_D3_M@1    (depuis "Soleil de mai")
```

Substitutions : `a→@` `e→3` `i→1` `o→0` `s→5` `t→7`

> N'utilisez pas de mots trop evidents (nom, date de naissance).

## Vie privee et securite

Je ne collecte **rien**. Pas de tracking, pas de cookies, pas de compte, pas de pub.

Vos mots de passe ne quittent jamais votre appareil. Meme moi, je ne peux pas les voir. Le code est open source — [verifiez par vous-meme](https://github.com/VBlackJack/genpwd-pro).

**Comment c'est securise :**

- **Crypto systeme** — Utilise le generateur cryptographique de votre appareil (Web Crypto API), le meme que les banques
- **Stockage local uniquement** — L'historique et les configs restent sur votre machine
- **Chiffrement fort** — Derivation Argon2id + chiffrement XSalsa20-Poly1305 pour le coffre local (AES-256-GCM pour import/export cross-platform)
- **Code ouvert** — Auditable par n'importe qui sur [GitHub](https://github.com/VBlackJack/genpwd-pro)

**Si vous activez la synchro cloud (Android) :** vos donnees sont chiffrees avant l'envoi. Sans votre mot de passe maitre, le coffre est illisible.

### Bonnes pratiques

- Un mot de passe **different** par site
- **16 caracteres minimum** pour les comptes importants
- Activez la **2FA** quand c'est possible
- Utilisez un **gestionnaire de mots de passe** pour tout stocker
- N'ecrivez jamais vos mots de passe sur un Post-it

## Export

Exportez vos mots de passe generes en **TXT**, **JSON** ou **CSV** pour les importer dans un autre gestionnaire ou garder une sauvegarde.

> Supprimez le fichier d'export apres utilisation. Ne l'envoyez pas par email non chiffre.

## Accessibilite

- **WCAG 2.1** — Navigation clavier complete, ARIA, focus visible
- **Lecteurs d'ecran** — NVDA, JAWS, VoiceOver
- **Theme contraste eleve** pour les malvoyants
- **Pas de CAPTCHA**

### Raccourcis clavier

**Coffre-fort (Desktop) :**

| Raccourci | Action |
|-----------|--------|
| `Ctrl+Shift+P` | Afficher/masquer (global) |
| `Ctrl+L` | Verrouiller le coffre |
| `Ctrl+N` | Nouvelle entree |
| `Ctrl+E` | Modifier l'entree |
| `Ctrl+D` | Dupliquer |
| `Ctrl+Suppr` | Supprimer |
| `Ctrl+F` | Rechercher |
| `Ctrl+B` | Copier le nom d'utilisateur |
| `Ctrl+C` | Copier le mot de passe |
| `?` | Afficher les raccourcis |

**Generateur :**

| Raccourci | Action |
|-----------|--------|
| `Ctrl+G` ou `G` | Generer |
| `Ctrl+Shift+C` | Copier tout |
| `Echap` | Fermer les modales |

### Themes

| Theme | Description |
|-------|-------------|
| 🌙 Sombre | Fond noir, accents colores |
| ☀️ Clair | Fond blanc |
| ⚫⚪ Contraste eleve | Noir et blanc |
| 🌊 Ocean | Tons bleus |
| 🌲 Foret | Tons verts |

### Compatibilite

**Navigateurs :** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
**OS :** Windows 10/11, macOS 10.15+, Linux, Android 8.0+, iOS 14+ (web)

## Questions frequentes

**GenPwd Pro est-il gratuit ?**
Oui, 100%. Open source, pas d'abonnement, pas de version premium.

**Faut-il creer un compte ?**
Non. Ca fonctionne sans compte, sans inscription.

**Ca marche hors ligne ?**
L'appli desktop, oui. La version web necessite un premier chargement, puis fonctionne hors ligne si vous l'ajoutez a l'ecran d'accueil.

**Mes mots de passe sont securises ?**
Oui. Generation cryptographique (Web Crypto API), rien ne transite sur internet. Un mot de passe de 16 caracteres resistera des millions d'annees au brute-force.

**Le bouton Copier ne marche pas**
Votre navigateur bloque probablement l'acces au presse-papiers. Accordez la permission, ou copiez manuellement avec `Ctrl+C`.

**Mon historique a disparu**
Si vous avez vide le cache ou desinstalle l'appli, l'historique local est supprime. Pensez a exporter regulierement.

## Besoin d'aide ?

- [Creer un rapport de bug](https://github.com/VBlackJack/genpwd-pro/issues)
- [Forum de discussions](https://github.com/VBlackJack/genpwd-pro/discussions)
- [Guide utilisateur](./docs/USER-GUIDE.md)
- [Contribuer au projet](./CONTRIBUTING.md)

## Licence

[Apache 2.0](./LICENSE) — Logiciel libre. Utilisez-le, modifiez-le, partagez-le.

Code source : [github.com/VBlackJack/genpwd-pro](https://github.com/VBlackJack/genpwd-pro)

## Documentation technique

Pour l'architecture, les API et les instructions de build : [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)

---

**Construit par Julien Bombled** | v3.1.1 | [GitHub](https://github.com/VBlackJack/genpwd-pro)

---
---

# 🇬🇧 English Version

## About

**GenPwd Pro** is a password manager I built because I wanted a simple, free tool that actually respects your privacy. No account required, no mandatory cloud, no ads — just a solid generator and an encrypted vault.

It's an open-source alternative to KeePass, Bitwarden, or 1Password.

## Features

- **Smart generator** — 3 modes: pronounceable, passphrase, Leet transformation
- **Encrypted vault** — Argon2id + XSalsa20-Poly1305 (Electron), 100% local storage
- **TOTP / 2FA** — Two-factor authentication codes (Google Authenticator compatible)
- **Security audit** — Detects weak, reused, or outdated passwords
- **Import / Export** — KeePass 2.x XML, Bitwarden JSON, generic CSV
- **Organization** — Folders, tags, favorites
- **History** — Find your recently generated passwords
- **5 themes** — Dark, light, high contrast, ocean, forest
- **3 languages** — French, English, Spanish
- **Accessible** — WCAG 2.1, keyboard navigation, screen readers (NVDA, JAWS, VoiceOver)

### Desktop (Electron)

- **System tray** with quick generation
- **Global hotkey** `Ctrl+Shift+P` (Boss Key)
- **Compact mode** — floating Always on Top widget
- **Auto-lock** after inactivity

## Platforms

| Platform | Status |
|----------|--------|
| [**Web**](https://vblackjack.github.io/genpwd-pro/) | Available — no install needed |
| [**Windows**](https://github.com/VBlackJack/genpwd-pro/releases) | Available — installer, portable, or ZIP |
| **Browser extension** | Coming soon |
| **Android** | Coming soon |

> Mac and Linux builds coming soon.

## Quick start

1. Open [vblackjack.github.io/genpwd-pro](https://vblackjack.github.io/genpwd-pro/) (or launch the desktop app)
2. Pick a mode, set the length (16+ characters recommended)
3. Hit **Generate**, then **Copy**

That's it.

## Generation modes

### Pronounceable (Syllables)

Passwords that look like real words — easy to read and type.

```
NyWoVyQep!Ocy8
DuNoKuPeRa!Ki7Lu
```

- Length: 12-25 characters (16 recommended)
- Options: digits, special characters

### Passphrase (Word phrase)

Real dictionary words joined by separators.

```
Sunlight-Wave-Nature-Mountain7
Force_Prairie_Wind_Cloud!
```

- 3 to 6 words (4 recommended)
- Separator: `-` `_` `.`
- Dictionaries: French (2,429 words), English (3,000+), Latin (1,500+)

Tip: make up a short story with the words to remember them.

### Leet transformation

Turns a word or phrase into a password by swapping letters for numbers/symbols.

```
P@55W0RD!        (from "PASSWORD")
S0l31l_D3_M@1    (from "Soleil de mai")
```

Substitutions: `a→@` `e→3` `i→1` `o→0` `s→5` `t→7`

> Don't use obvious words (your name, birthday).

## Privacy & security

I collect **nothing**. No tracking, no cookies, no accounts, no ads.

Your passwords never leave your device. Even I can't see them. The code is open source — [check for yourself](https://github.com/VBlackJack/genpwd-pro).

**How it's secured:**

- **System crypto** — Uses your device's cryptographic RNG (Web Crypto API), same as banks
- **Local storage only** — History and configs stay on your machine
- **Strong encryption** — Argon2id key derivation + XSalsa20-Poly1305 for local vaults (AES-256-GCM for cross-platform import/export)
- **Open source** — Auditable by anyone on [GitHub](https://github.com/VBlackJack/genpwd-pro)

**If you enable cloud sync (Android):** your data is encrypted before upload. Without your master password, the vault is unreadable.

### Good practices

- A **different** password for every site
- **16 characters minimum** for important accounts
- Enable **2FA** whenever possible
- Use a **password manager** to store everything
- Never write passwords on a sticky note

## Export

Export your generated passwords as **TXT**, **JSON**, or **CSV** to import them into another manager or keep a backup.

> Delete the export file after use. Don't email it unencrypted.

## Accessibility

- **WCAG 2.1** — Full keyboard navigation, ARIA, visible focus
- **Screen readers** — NVDA, JAWS, VoiceOver
- **High contrast theme** for low vision
- **No CAPTCHA**

### Keyboard shortcuts

**Vault (Desktop):**

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Show/hide (global) |
| `Ctrl+L` | Lock vault |
| `Ctrl+N` | New entry |
| `Ctrl+E` | Edit entry |
| `Ctrl+D` | Duplicate |
| `Ctrl+Delete` | Delete |
| `Ctrl+F` | Search |
| `Ctrl+B` | Copy username |
| `Ctrl+C` | Copy password |
| `?` | Show shortcuts |

**Generator:**

| Shortcut | Action |
|----------|--------|
| `Ctrl+G` or `G` | Generate |
| `Ctrl+Shift+C` | Copy all |
| `Escape` | Close modals |

### Themes

| Theme | Description |
|-------|-------------|
| 🌙 Dark | Black background, colored accents |
| ☀️ Light | White background |
| ⚫⚪ High Contrast | Black and white |
| 🌊 Ocean | Blue tones |
| 🌲 Forest | Green tones |

### Compatibility

**Browsers:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
**OS:** Windows 10/11, macOS 10.15+, Linux, Android 8.0+, iOS 14+ (web)

## FAQ

**Is GenPwd Pro free?**
Yes, 100%. Open source, no subscription, no premium tier.

**Do I need an account?**
No. It works without an account, without signing up.

**Does it work offline?**
The desktop app does. The web version needs a first load, then works offline if you add it to your home screen.

**Are my passwords secure?**
Yes. Cryptographic generation (Web Crypto API), nothing goes over the wire. A 16-character password would take millions of years to brute-force.

**The Copy button doesn't work**
Your browser is probably blocking clipboard access. Grant permission, or copy manually with `Ctrl+C`.

**My history disappeared**
If you cleared your browser cache or uninstalled the app, local history is gone. Export regularly to keep a backup.

## Need help?

- [File a bug report](https://github.com/VBlackJack/genpwd-pro/issues)
- [Discussion forum](https://github.com/VBlackJack/genpwd-pro/discussions)
- [User guide](./docs/USER-GUIDE.md)
- [Contribute](./CONTRIBUTING.md)

## License

[Apache 2.0](./LICENSE) — Free software. Use it, modify it, share it.

Source code: [github.com/VBlackJack/genpwd-pro](https://github.com/VBlackJack/genpwd-pro)

## Developer docs

For architecture, APIs, and build instructions: [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)

---

**Built by Julien Bombled** | v3.1.1 | [GitHub](https://github.com/VBlackJack/genpwd-pro)
