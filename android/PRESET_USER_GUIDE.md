# 📱 Guide d'Utilisation - Système de Presets

Guide rapide pour utiliser le système de presets dans GenPwd Pro Android.

## 🎯 Workflow du Système de Presets

### 1. Création d'un Vault
Lors de la création d'un nouveau vault, un **preset par défaut** est automatiquement créé avec les paramètres suivants :
- **Mode** : Syllables (par défaut)
- **Longueur** : 20 caractères
- **Chiffres** : 2
- **Spéciaux** : 2
- **Icône** : 🔐
- **Non modifiable** : Ce preset système ne peut pas être supprimé

### 2. Utilisation des Presets dans le Générateur

#### Dashboard (Écran d'accueil)
Le **générateur rapide** du Dashboard utilise des paramètres par défaut simples :
- Mode : Syllables
- Longueur : 16 caractères
- Chiffres : 2
- Spéciaux : 2

**Note** : Le générateur rapide n'utilise pas de presets car il n'est pas lié à un vault spécifique.

#### Générateur Complet (Onglet "Générateur")

**Pour utiliser vos presets :**
1. ✅ Déverrouillez un vault (via l'onglet "Coffres")
2. ✅ Allez dans l'onglet "Générateur" (bottom navigation)
3. ✅ Le **sélecteur de presets** apparaît automatiquement
4. ✅ Le **preset par défaut** est automatiquement sélectionné
5. ✅ Cliquez sur le sélecteur pour choisir un autre preset

### 3. Gestion des Presets

#### Créer un Preset Personnalisé
1. Déverrouillez un vault
2. Allez dans "Générateur"
3. Configurez vos paramètres souhaités
4. Cliquez sur "Enregistrer comme preset"
5. Donnez un nom et choisissez une icône (15 disponibles)
6. Option : Cochez "Définir comme défaut"

**Limite** : Maximum **3 presets personnalisés** par mode (Syllables et Passphrase)

#### Gérer vos Presets Existants
1. Depuis le Dashboard, cliquez sur "Gérer les presets" d'un vault
   OU
2. Depuis le sélecteur de presets, cliquez sur "Gérer"

**Actions disponibles :**
- ✏️ Modifier le nom et l'icône
- ⭐ Définir comme défaut
- 🗑️ Supprimer (sauf preset système)
- 📊 Voir les statistiques d'utilisation

### 4. Icônes de Presets Disponibles

Lors de la création/modification d'un preset, 15 icônes sont disponibles :
```
🔐 🔑 🛡️ ⚡ 🎯
🌟 💎 🚀 🔥 ⭐
💪 🎨 🎭 🎪 🎬
```

### 5. Statistiques de Presets

Chaque preset track :
- **Nombre d'utilisations** : Incrémenté à chaque génération
- **Dernière utilisation** : Timestamp mis à jour automatiquement

Ces stats sont visibles dans l'écran de gestion des presets.

## 🔐 Sécurité

- ✅ **Presets chiffrés** : Stockés avec AES-256-GCM
- ✅ **Liés aux vaults** : Chaque preset appartient à un vault
- ✅ **Clé du vault** : Utilisée pour chiffrer/déchiffrer les presets
- ✅ **Cascade delete** : Si vous supprimez un vault, ses presets sont aussi supprimés

## 🎨 Navigation dans l'App

### Bottom Navigation (Barre du bas)
3 onglets principaux (icônes seulement pour gagner de l'espace) :
- 🏠 **Accueil** : Dashboard avec générateur rapide
- 🔑 **Générateur** : Générateur complet avec presets
- 🔒 **Coffres** : Gestion des vaults

### Dashboard (Accueil)
- **Générateur rapide** : Génération instantanée (sans preset)
- **Liste des coffres** : Statistiques et accès rapide
- **Outils rapides** : Analyzer, Historique, Phrases personnalisées

## ❓ FAQ

**Q : Pourquoi je ne vois pas le sélecteur de presets ?**
R : Il faut d'abord déverrouiller un vault. Le sélecteur apparaît uniquement dans l'onglet "Générateur" quand un vault est déverrouillé.

**Q : Puis-je utiliser des presets dans le générateur rapide du Dashboard ?**
R : Non, le générateur rapide utilise des paramètres par défaut simples. Pour utiliser vos presets, allez dans l'onglet "Générateur" après avoir déverrouillé un vault.

**Q : Combien de presets puis-je créer ?**
R : Maximum 3 presets personnalisés par mode (Syllables et Passphrase), plus 1 preset système par défaut non supprimable.

**Q : Puis-je modifier le preset par défaut ?**
R : Le preset "Défaut" système ne peut pas être modifié ou supprimé. Vous pouvez créer vos propres presets et les marquer comme "défaut" pour les utiliser automatiquement.

**Q : Les presets sont-ils synchronisés ?**
R : Les presets sont stockés localement dans chaque vault. Si vous utilisez la synchronisation cloud, les presets sont inclus dans le vault chiffré.

## 🔄 Workflow Complet Exemple

1. **Lancement de l'app** → Dashboard visible
2. **Créer un nouveau vault** → Preset par défaut créé automatiquement
3. **Déverrouiller le vault** → VaultSessionManager garde la session en mémoire
4. **Aller dans "Générateur"** → Preset par défaut chargé automatiquement
5. **Cliquer sur "Générer"** → Mot de passe généré avec preset
6. **Modifier les paramètres** → Ajuster selon vos besoins
7. **"Enregistrer comme preset"** → Créer un preset personnalisé
8. **Sélectionner le nouveau preset** → Utiliser vos paramètres personnalisés
9. **Marquer comme défaut** → Utilisé automatiquement au prochain lancement

## 📝 Notes Techniques

- **VaultSessionManager** : Garde en mémoire le vault déverrouillé et gère le timeout
- **GeneratorViewModel** : Charge automatiquement les presets du vault actif
- **PresetRepository** : Gère le chiffrement/déchiffrement
- **Database Migration** : v4 → v5 ajoute la table presets
- **Material Design 3** : UI moderne et cohérente

---

**Version** : 2.5.2
**Branch** : claude/android-ux-design-011CUXbWzXbED17n7GUmyX47
**Documentation** : Complète et à jour

🤖 Généré avec [Claude Code](https://claude.com/claude-code)
