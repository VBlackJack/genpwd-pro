# ⚠️ IMPORTANT : Redémarrer le serveur de développement

## Le problème
Les dictionnaires retournent toujours 404 car le serveur de développement 
n'a PAS été redémarré avec le nouveau code.

## Solution

### 1. Arrêter le serveur actuel
```bash
# Trouvez le processus
ps aux | grep "node.*dev-server"

# Tuez-le (remplacez PID par le numéro du processus)
kill <PID>

# OU utilisez Ctrl+C dans le terminal où il tourne
```

### 2. Redémarrer le serveur
```bash
cd /home/user/genpwd-pro
node tools/dev-server.js
```

### 3. Vider le cache du navigateur
1. Ouvrez DevTools (F12)
2. Clic droit sur le bouton Actualiser
3. Sélectionnez "Vider le cache et actualiser de force"

### 4. Ou utiliser le mode incognito
Ouvrez http://localhost:3000 en mode navigation privée

## Vérification
Après redémarrage, vous devriez voir dans les logs du serveur :
```
[DEV] Demande dictionnaire: /home/user/genpwd-pro/src/dictionaries/french.json
```

Au lieu de voir des 404 dans la console du navigateur.
