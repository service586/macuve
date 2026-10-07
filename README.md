# MaCuve

Site de commande de livraison d'eau par citerne dans le Grand Libreville. Le client choisit un volume, paie par Airtel Money, et un livreur partenaire livre.

**Mode test** : `PAYMENT_PROVIDER="mock"`. Aucun argent ne circule ; une page de simulation remplace la validation par code PIN, et les SMS sont seulement enregistrés (menu Admin > SMS).

## Démarrer en local

Prérequis : Node.js 20 ou plus, PostgreSQL.

```bash
cp .env.example .env        # puis adapter DATABASE_URL et SESSION_SECRET
npm install
npx prisma migrate deploy
npm run db:seed             # communes, volumes, prix de test, comptes de démonstration
npm run dev                 # http://localhost:3000
```

Comptes créés par le seed (à changer avant toute mise en ligne) :

| Rôle | Téléphone | Mot de passe | Page |
| --- | --- | --- | --- |
| Administrateur | 077000000 | admin1234 | /admin |
| Livreur de démonstration | 074000001 | fournisseur1 | /fournisseur |

Les prix du seed sont **fictifs** : à remplacer dans Admin > Tarifs.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `prisma/schema.prisma` | Modèle de données : livreurs, communes, volumes, prix, commandes, paiements, reversements, SMS |
| `src/app/` (racine, `commande/`, `suivi/`) | Parcours client : commande, paiement, suivi, note |
| `src/app/fournisseur/` | Espace livreur : inscription, commandes disponibles, livraison avec code client, gains |
| `src/app/admin/` | Administration : commandes, validation des livreurs, tarifs et commission, reversements, SMS |
| `src/lib/payments/` | Paiement. Chaque prestataire (PVit, E-Billing, Airtel direct) implémente `PaymentProvider` ; seul `mock` existe pour l'instant |
| `src/app/api/paiement/webhook/[provider]` | Réception des notifications de paiement des prestataires |

## Brancher un vrai prestataire de paiement

1. Créer `src/lib/payments/<prestataire>.ts` qui implémente `PaymentProvider` (demande de paiement, statut, webhook, remboursement, reversement).
2. L'ajouter dans `src/lib/payments/index.ts`.
3. Mettre `PAYMENT_PROVIDER="<prestataire>"` et ses clés dans `.env`, et déclarer chez le prestataire l'URL de notification `https://<domaine>/api/paiement/webhook/<prestataire>`.

## Mise en ligne de test sur Vercel

1. Sur [vercel.com](https://vercel.com), créer un compte avec « Continue with GitHub », puis importer le dépôt `macuve`.
2. Dans le projet Vercel, onglet **Storage**, ajouter une base **Neon** (Postgres, offre gratuite). Vercel crée lui-même `DATABASE_URL` et `DATABASE_URL_UNPOOLED`.
3. Dans **Settings > Environment Variables**, ajouter :

| Variable | Valeur |
| --- | --- |
| `SESSION_SECRET` | une longue phrase aléatoire (au moins 32 caractères) |
| `ADMIN_PASSWORD` | le mot de passe de l'administrateur |
| `ADMIN_PHONE` | le numéro de connexion de l'administrateur (facultatif, 077000000 par défaut) |
| `PAYMENT_PROVIDER` | `mock` tant que le contrat de paiement n'est pas signé |
| `SEED_DEMO` | `1` pour créer le livreur de démonstration (facultatif) |

4. Relancer le déploiement (**Deployments > Redeploy**). Le script `vercel-build` applique les migrations, crée les données de départ, puis compile le site.
