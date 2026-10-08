import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const ZONES = [
  { name: "Libreville", neighborhoods: ["Centre-ville", "Louis", "Glass", "Nombakélé", "Akébé", "Nzeng-Ayong", "Lalala", "Belle-Vue", "Charbonnages", "PK5 à PK12"] },
  { name: "Akanda", neighborhoods: ["Angondjé", "Okala", "Cap Estérias", "Malibé", "Avorbam"] },
  { name: "Owendo", neighborhoods: ["Owendo centre", "Alénakiri", "Akournam", "Awoungou"] },
  { name: "Ntoum", neighborhoods: ["Ntoum centre", "Nkoltang", "Bikélé"] },
];

// Communes ouvertes aux commandes pendant le pilote. Les autres s'activent dans « Tarifs ».
const PILOT_ZONES = ["Libreville", "Akanda"];

const TIERS = [1000, 3000, 5000, 10000];

// PRIX DE TEST, fictifs : à remplacer par l'administrateur dans « Tarifs ».
const TEST_PRICES: Record<string, number[]> = {
  Libreville: [15000, 35000, 50000, 90000],
  Akanda: [17000, 38000, 55000, 98000],
  Owendo: [17000, 38000, 55000, 98000],
  Ntoum: [20000, 42000, 60000, 105000],
};

async function main() {
  const zones = [];
  for (const [i, zone] of ZONES.entries()) {
    zones.push(
      await db.zone.upsert({
        where: { name: zone.name },
        create: { ...zone, sortOrder: i, active: PILOT_ZONES.includes(zone.name) },
        update: {},
      }),
    );
  }

  const tiers = [];
  for (const liters of TIERS) {
    tiers.push(await db.volumeTier.upsert({ where: { liters }, create: { liters }, update: {} }));
  }

  for (const zone of zones) {
    for (const [i, tier] of tiers.entries()) {
      await db.price.upsert({
        where: { zoneId_tierId: { zoneId: zone.id, tierId: tier.id } },
        create: { zoneId: zone.id, tierId: tier.id, amountXaf: TEST_PRICES[zone.name][i] },
        update: {},
      });
    }
  }

  await db.setting.upsert({
    where: { key: "commissionPercent" },
    create: { key: "commissionPercent", value: "10" },
    update: {},
  });

  // En ligne, le mot de passe administrateur doit venir des réglages, jamais de la valeur par défaut.
  const online = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  if (online && !process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD doit être défini pour la mise en ligne");
  const adminPhone = process.env.ADMIN_PHONE ?? "077000000";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin1234";
  await db.user.upsert({
    where: { phone: adminPhone },
    create: { name: "Administrateur", phone: adminPhone, role: "ADMIN", passwordHash: await bcrypt.hash(adminPassword, 10) },
    update: {},
  });
  console.log(online ? `Administrateur : ${adminPhone}` : `Administrateur : ${adminPhone} / ${adminPassword}`);

  // Le livreur de démonstration n'est créé en ligne que si SEED_DEMO=1.
  if (online ? process.env.SEED_DEMO === "1" : process.env.SEED_DEMO !== "0") {
    const phone = "074000001";
    const user = await db.user.upsert({
      where: { phone },
      create: { name: "Jean Test", phone, role: "SUPPLIER", passwordHash: await bcrypt.hash("fournisseur1", 10) },
      update: {},
    });
    await db.supplier.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        businessName: "Citerne Test",
        airtelNumber: phone,
        tankCapacityL: 10000,
        waterSource: "FORAGE",
        status: "APPROVED",
        zones: { create: zones.slice(0, 2).map((z) => ({ zoneId: z.id })) },
      },
      update: {},
    });
    console.log(`Fournisseur de démonstration : ${phone} / fournisseur1`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
