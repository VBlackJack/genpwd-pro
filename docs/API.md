# API technique GenPwd Pro

## `computeCharacterSpace(result: string): number`

Localisation : `src/js/core/generators.js`

Calcule dynamiquement l'espace de caractères réellement mobilisé par un mot de
passe généré. La fonction évalue la présence de quatre familles de caractères :
minuscules, majuscules, chiffres et caractères spéciaux. Chaque détection
utilise une expression régulière dédiée pour sonder la chaîne, puis additionne
la cardinalité du sous-ensemble détecté (26 pour les
lettres, 10 pour les chiffres, 32 pour les symboles). Le résultat numérique est
ensuite transmis au calcul d'entropie pour ajuster la valeur annoncée au
contexte précis du mot de passe.

```js
function computeCharacterSpace(result) {
  const hasLower = /[a-z]/.test(result);
  const hasUpper = /[A-Z]/.test(result);
  const hasDigits = /[0-9]/.test(result);
  const hasSpecials = /[^a-zA-Z0-9]/.test(result);

  return (hasLower ? 26 : 0)
    + (hasUpper ? 26 : 0)
    + (hasDigits ? 10 : 0)
    + (hasSpecials ? 32 : 0);
}
```

## `copyAllPasswords(): Promise<void>`

Localisation : `src/js/ui/events.js`

Agrège l'ensemble des mots de passe présents dans l'état UI et tente une copie
unique dans le presse-papiers. La fonction :

1. Récupère le tableau courant via `getResults()` et valide sa présence.
2. Filtre les entrées falsy, applique `join('\n')` pour produire un bloc
   multiligne et vérifie qu'il reste du contenu.
3. Transmet la chaîne au service `copyToClipboard`.
4. Calcule le nombre de lignes copiées pour alimenter les messages
   utilisateur.
5. Affiche un toast contextualisé (succès ou erreur) et trace l'opération via
   `safeLog` en cas de réussite.

Cette approche réduit la logique de transformation à une seule pipeline, ce qui
limite les allocations intermédiaires et simplifie la maintenance.

```js
const success = await copyToClipboard(passwords);
const count = passwords.split('\n').length;

showToast(
  success
    ? `${count} mot${count > 1 ? 's' : ''} de passe copiés !`
    : 'Impossible de copier les mots de passe',
  success ? 'success' : 'error'
);

if (success) {
  safeLog(`Copie groupée: ${count} entrées`);
}
```

## Métriques de performance (février 2025)

Les scripts de qualité tournent sur Node.js 20.19 :

- `npm run lint` : ~3,5 s, 0 avertissement, 0 erreur.
- `npm test` : 13 scénarios exécutés en ~4,2 s, 0 échec.

Les temps sont mesurés sur l'environnement de développement containerisé
standard utilisé pour la CI. Ils peuvent varier selon la machine locale.
