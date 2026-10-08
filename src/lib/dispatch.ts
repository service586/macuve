import { Prisma } from "@prisma/client";
import { db } from "./db";
import { formatLiters, formatXaf } from "./format";
import { distanceMeters, formatDistance } from "./geo";
import { sendSms } from "./notify";
import { getOfferSeconds } from "./settings";

// Au-delà, la position d'un livreur est trop ancienne pour lui proposer une commande.
const LOCATION_FRESH_MINUTES = 15;

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

// Pas de tâche planifiée : chaque visite d'une page de suivi, du tableau de bord
// livreur ou de l'administration fait avancer la recherche de livreur.
export async function advanceDispatch() {
  await db.orderOffer.updateMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED", respondedAt: new Date() },
  });
  const waiting = await db.order.findMany({
    where: { status: "PAID", supplierId: null, openedToAllAt: null, offers: { none: { status: "PENDING" } } },
    select: { id: true },
    orderBy: { paidAt: "asc" },
  });
  for (const order of waiting) await offerToNearest(order.id);
}

// Propose la commande au livreur libre le plus proche qui ne l'a pas encore refusée.
// S'il n'y en a plus, la commande est ouverte à tous les livreurs de la commune.
export async function offerToNearest(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { offers: { select: { supplierId: true } } } });
  if (!order || order.status !== "PAID" || order.supplierId || order.openedToAllAt) return;

  const home = order.lat !== null && order.lng !== null ? { lat: order.lat, lng: order.lng } : null;
  const candidates = home
    ? await db.supplier.findMany({
        where: {
          status: "APPROVED",
          available: true,
          locatedAt: { gte: minutesAgo(LOCATION_FRESH_MINUTES) },
          lat: { not: null },
          lng: { not: null },
          tankCapacityL: { gte: order.liters },
          zones: { some: { zoneId: order.zoneId } },
          id: { notIn: order.offers.map((o) => o.supplierId) },
          offers: { none: { status: "PENDING" } },
          orders: { none: { status: { in: ["ACCEPTED", "EN_ROUTE"] } } },
        },
        include: { user: true },
      })
    : [];

  const nearest = candidates
    .map((s) => ({ supplier: s, distanceM: distanceMeters(home!, { lat: s.lat!, lng: s.lng! }) }))
    .sort((a, b) => a.distanceM - b.distanceM)[0];

  if (!nearest) {
    await openToAll(order.id);
    return;
  }

  try {
    await db.orderOffer.create({
      data: {
        orderId: order.id,
        supplierId: nearest.supplier.id,
        distanceM: nearest.distanceM,
        expiresAt: new Date(Date.now() + (await getOfferSeconds()) * 1000),
      },
    });
  } catch (e) {
    // Une autre requête a proposé la commande au même moment : rien à faire.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }
  await sendSms(
    nearest.supplier.user.phone,
    `MaCuve : commande ${formatLiters(order.liters)} à ${formatDistance(nearest.distanceM)} de vous ` +
      `(${formatXaf(order.amountXaf - order.commissionXaf)} pour vous). Ouvrez MaCuve vite pour l'accepter.`,
  );
}

async function openToAll(orderId: string) {
  const updated = await db.order.updateMany({
    where: { id: orderId, status: "PAID", supplierId: null, openedToAllAt: null },
    data: { openedToAllAt: new Date() },
  });
  if (updated.count === 0) return;
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const suppliers = await db.supplier.findMany({
    where: { status: "APPROVED", zones: { some: { zoneId: order.zoneId } } },
    include: { user: true },
  });
  for (const supplier of suppliers) {
    await sendSms(
      supplier.user.phone,
      `MaCuve : nouvelle commande ${formatLiters(order.liters)} à ${order.neighborhood}. Connectez-vous pour l'accepter.`,
    );
  }
}

// Le livreur accepte la proposition qui lui a été faite. Renvoie l'id de la commande si c'est bon.
export async function acceptOffer(offerId: string, supplierId: string): Promise<string | null> {
  const now = new Date();
  return db.$transaction(async (tx) => {
    const offer = await tx.orderOffer.findFirst({ where: { id: offerId, supplierId, status: "PENDING", expiresAt: { gt: now } } });
    if (!offer) return null;
    const taken = await tx.order.updateMany({
      where: { id: offer.orderId, status: "PAID", supplierId: null },
      data: { status: "ACCEPTED", supplierId, acceptedAt: now },
    });
    await tx.orderOffer.update({
      where: { id: offer.id },
      data: { status: taken.count > 0 ? "ACCEPTED" : "EXPIRED", respondedAt: now },
    });
    return taken.count > 0 ? offer.orderId : null;
  });
}

export async function declineOffer(offerId: string, supplierId: string) {
  const offer = await db.orderOffer.findFirst({ where: { id: offerId, supplierId, status: "PENDING" } });
  if (!offer) return;
  await db.orderOffer.update({ where: { id: offer.id }, data: { status: "DECLINED", respondedAt: new Date() } });
  await offerToNearest(offer.orderId);
}

// À appeler quand la commande a trouvé un livreur par un autre chemin, ou a été remboursée.
export async function closeOffers(orderId: string) {
  await db.orderOffer.updateMany({
    where: { orderId, status: "PENDING" },
    data: { status: "EXPIRED", respondedAt: new Date() },
  });
}
