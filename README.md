# NeoFactory — Tableau de bord opérationnel

## Description du projet

NeoFactory est un **tableau de bord opérationnel** développé avec **Next.js, React et TypeScript**.
Il permet de visualiser et gérer des sites, départements et machines avec :

* **Filtres dynamiques** (Ville, Département, État).
* **Recherche intelligente avec autocomplétion**.
* **Affichage hiérarchique** Sites → Départements → Machines.
* **Cartes Google Maps intégrées** pour la localisation des sites.
* **Indicateurs de performance et uptime**.
* **Fenêtres de détails machines** avec rapports et configuration.
* **Mode sombre/clair** géré localement.

---

## Instructions de test

1. **Cloner le projet** :

   ```bash
   git clone https://github.com/timothyroch/intelligence_industrielle_hackaton.git
   cd intelligence_industrielle_hackaton
   ```

2. **Installer les dépendances** :

   ```bash
   npm install
   ```

3. **Configurer la clé Google Maps** :
   Crée un fichier `.env.local` à la racine avec :

   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=ta_clé_google_maps
   ```

4. **Lancer le serveur de développement** :

   ```bash
   npm run dev
   ```

5. Ouvrir dans ton navigateur :
   👉 [http://localhost:3000](http://localhost:3000)

---

## Lien de déploiement

Le projet est déployé sur **Vercel** :
👉 [https://neofactory.vercel.app](https://neofactory.vercel.app)
