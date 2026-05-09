# IPCM ERP — Mise en ligne (Railway)

## Comptes par défaut (à changer après connexion)

| Login      | Mot de passe  | Accès              |
|------------|---------------|--------------------|
| admin      | Admin2024!    | Tout (CEO)         |
| finance    | Finance2024!  | DFC uniquement     |
| rh         | RH2024!       | RH uniquement      |
| technique  | Tech2024!     | Technique uniquement |

---

## Étapes de déploiement

### 1. Créer un compte GitHub
- Aller sur https://github.com
- Créer un compte gratuit

### 2. Mettre le projet sur GitHub
- Aller sur https://github.com/new
- Créer un dépôt privé nommé "ipcm-erp"
- Suivre les instructions pour uploader les fichiers

### 3. Déployer sur Railway
- Aller sur https://railway.app
- Se connecter avec GitHub
- Cliquer "New Project" → "Deploy from GitHub repo"
- Choisir le dépôt "ipcm-erp"
- Railway détecte automatiquement Node.js et démarre

### 4. Ajouter le volume de données (IMPORTANT)
- Dans Railway, aller dans votre projet
- Cliquer "Add Service" → "Volume"
- Monter le volume sur `/app/data`
- Cela garantit que vos données ne se perdent pas

### 5. Ajouter la variable d'environnement
- Dans Railway → Variables
- Ajouter: `JWT_SECRET` = une longue phrase secrète (ex: `monSecret2024IpcmBoutema!`)

### 6. Accéder à l'application
- Railway vous donne une URL du type: `https://ipcm-erp-xxx.railway.app`
- Partagez cette URL avec vos équipes
- Chaque personne se connecte avec son login/mot de passe

---

## Sécurité — après le premier déploiement
1. Se connecter en tant qu'admin
2. Aller dans "Administration" → "Utilisateurs"
3. Changer les mots de passe de tous les comptes
