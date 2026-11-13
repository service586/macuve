# MaCuve

Site de commande de livraison d'eau par citerne dans le Grand Libreville. Le client choisit un volume, paie par Airtel Money, et un livreur partenaire livre.

**Mode test** : `PAYMENT_PROVIDER="mock"` (ou `mypayga` avec une clé `stest_`, voir plus bas). Aucun argent ne circule ; une page de simulation remplace la validation par code PIN, et les SMS sont seulement enregistrés (menu Admin > SMS).

## Démarrer en local

Prérequis : Node.js 20 ou plus, PostgreSQL.

```bash
cp .env.example .env        # puis adapter DATABASE_URL et SESSION_SECRET
npm install
npx prisma migrate deploy
npm run db:seed             # communes, comptes de démonstration
npm run dev                 # http://localhost:3000
```

Comptes créés par le seed (à changer avant toute mise en ligne) :

| Rôle | Téléphone | Mot de passe | Page |
| --- | --- | --- | --- |
| Administrateur | 077000000 | admin1234 | /admin |
| Livreur de démonstration | 074000001 | fournisseur1 | /fournisseur |

Le client commande de 1000 L à 10 000 L, par tranches de 1000 L. Le prix d'une cuve de 1000 L se règle par commune dans Admin > Tarifs (5000 FCFA au départ).

## Organisation

| Dossier | Contenu |
| --- | --- |
| `prisma/schema.prisma` | Modèle de données : livreurs, communes, volumes, prix, commandes, paiements, reversements, SMS |
| `src/app/` (racine, `commande/`, `suivi/`) | Parcours client : commande, paiement, suivi, note |
| `src/app/compte/` | Compte client : connexion par code SMS, historique des commandes |
| `src/app/fournisseur/` | Espace livreur : inscription, disponibilité et position GPS, commandes proposées, livraison avec code client, gains |
| `src/lib/dispatch.ts` | Envoi de chaque commande payée au livreur disponible le plus proche (voir ci-dessous) |
| `src/components/MapView.tsx` | Carte OpenStreetMap (Leaflet) : domicile du client et camion du livreur |
| `src/app/admin/` | Administration : commandes, validation des livreurs, tarifs et commission, reversements, SMS |
| `src/lib/payments/` | Paiement. Chaque prestataire implémente `PaymentProvider` : `mock` (simulation) et `mypayga` |
| `src/app/api/paiement/webhook/[provider]` | Réception des notifications de paiement des prestataires |

## Comment une commande trouve son livreur

1. Le client place son domicile sur la carte avant de payer.
2. Le livreur appuie sur « Je suis disponible » ; tant que sa page est ouverte, son téléphone envoie sa position toutes les 20 secondes.
3. Une fois la commande payée, elle est proposée au livreur disponible le plus proche (position de moins de 15 minutes, citerne assez grande, commune desservie, pas déjà en livraison).
4. Il a 2 minutes pour accepter (réglable dans « Tarifs »). S'il refuse ou ne répond pas, la commande passe au suivant.
5. S'il n'y a plus personne, la commande est ouverte à tous les livreurs de la commune, comme avant, et l'administrateur peut l'attribuer.

Il n'y a pas de tâche planifiée : les délais sont vérifiés à chaque affichage des pages de suivi, livreur et administration, qui se rafraîchissent toutes seules.

## Comptes clients

Le client se connecte avec son numéro et un code à 6 chiffres reçu par SMS (valable 10 minutes, 5 essais, 3 codes au plus par quart d'heure). Son historique reprend aussi les commandes passées sans compte avec ce numéro, et le formulaire de commande est prérempli avec sa dernière adresse. Commander sans compte reste possible.

Tant que la variable `SMS_PROVIDER` ne vaut pas `twilio`, aucun SMS ne part vraiment : le code est affiché à l'écran pour pouvoir tester.

## Envoyer de vrais SMS (Twilio)

Twilio exige un profil d'entreprise validé (KYC, dans Trust Hub) avant tout envoi : sans lui, chaque SMS est refusé avec l'erreur 20003.

Dans Vercel > Settings > Environment Variables, ajoutez :

| Variable | Valeur |
| :--- | :--- |
| `SMS_PROVIDER` | `twilio` |
| `TWILIO_ACCOUNT_SID` | Account SID, sur la page d'accueil de la console Twilio |
| `TWILIO_AUTH_TOKEN` | Auth Token, au même endroit |
| `TWILIO_FROM` | le nom d'expéditeur validé (`MaCuve`) ou un numéro Twilio |

Puis redéployez. Chaque SMS apparaît dans Admin > SMS avec « envoyé » ou « non envoyé ».

## Paiement mobile money avec MyPayGa

Le site sait encaisser par [MyPayGa](https://mypayga.com/docs) (Airtel Money ; Moov Money est prévu par l'API). Le code est dans `src/lib/payments/mypayga.ts`.

1. Ouvrir un compte marchand MyPayGa (contact@mypayga.com) au nom de Montransfert et récupérer la **clé API** (`stest_…` pour les tests, `sprod_…` pour le réel) et la **clé secrète** qui signe les notifications.
2. Dans l'espace marchand MyPayGa, déclarer les numéros Airtel de test (avec une clé `stest_`, seuls ces numéros sont débités).
3. Dans Vercel, ajouter les variables `PAYMENT_PROVIDER=mypayga`, `MYPAYGA_API_KEY`, `MYPAYGA_SECRET_KEY` et `APP_URL` (voir le tableau plus bas), puis redéployer.
4. Le site donne lui-même à MyPayGa, à chaque paiement, l'adresse de notification `https://<domaine>/api/paiement/webhook/mypayga`. Elle doit être joignable depuis Internet.

Fonctionnement : le client reçoit l'invite de paiement sur son téléphone et la valide avec son code PIN. MyPayGa prévient le site par une notification signée (HMAC-SHA512 avec la clé secrète, vérifiée par le site). En secours, la page de paiement interroge MyPayGa toutes les 4 secondes. Les remboursements et les reversements aux livreurs passent par un transfert MyPayGa (B2C) vers le numéro Airtel concerné.

Pour revenir au mode simulation (aucun appel à MyPayGa), remettre `PAYMENT_PROVIDER=mock`.

Pour brancher un autre prestataire : créer `src/lib/payments/<prestataire>.ts` qui implémente `PaymentProvider`, l'ajouter dans `src/lib/payments/index.ts` et mettre `PAYMENT_PROVIDER="<prestataire>"`.

## Mise en ligne de test sur Vercel

1. Sur [vercel.com](https://vercel.com), créer un compte avec « Continue with GitHub », puis importer le dépôt `macuve`.
2. Dans le projet Vercel, onglet **Storage**, ajouter une base **Neon** (Postgres, offre gratuite). Vercel crée lui-même `DATABASE_URL` et `DATABASE_URL_UNPOOLED`.
3. Dans **Settings > Environment Variables**, ajouter :

| Variable | Valeur |
| --- | --- |
| `SESSION_SECRET` | une longue phrase aléatoire (au moins 32 caractères) |
| `ADMIN_PASSWORD` | le mot de passe de l'administrateur |
| `ADMIN_PHONE` | le numéro de connexion de l'administrateur (facultatif, 077000000 par défaut) |
| `PAYMENT_PROVIDER` | `mock` (simulation sur le site) ou `mypayga` (vrais appels à MyPayGa) |
| `MYPAYGA_API_KEY` | avec `mypayga` : clé API MyPayGa, `stest_…` (test) ou `sprod_…` (réel) |
| `MYPAYGA_SECRET_KEY` | avec `mypayga` : clé secrète MyPayGa, qui vérifie les notifications |
| `APP_URL` | avec `mypayga` : adresse publique du site, ex. `https://macuve.vercel.app` (sans `/` final) |
| `MYPAYGA_CONTACT_EMAIL` | facultatif : e-mail transmis à MyPayGa avec chaque paiement |
| `SEED_DEMO` | `1` pour créer le livreur de démonstration (facultatif) |

4. Relancer le déploiement (**Deployments > Redeploy**). Le script `vercel-build` applique les migrations, crée les données de départ, puis compile le site. Les aperçus de PR (Preview) sont seulement compilés : ils ne touchent jamais à la base de production.
