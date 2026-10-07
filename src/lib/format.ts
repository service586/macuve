import type { OrderStatus } from "@prisma/client";

export function formatXaf(amount: number): string {
  return `${amount.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ")} FCFA`;
}

export function formatLiters(liters: number): string {
  return `${liters.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ")} L`;
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleString("fr-FR", {
    timeZone: "Africa/Libreville",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "En attente de paiement",
  PAID: "Payée, recherche d'un livreur",
  ACCEPTED: "Acceptée par un livreur",
  EN_ROUTE: "Livreur en route",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-900",
  PAID: "bg-sky-100 text-sky-900",
  ACCEPTED: "bg-indigo-100 text-indigo-900",
  EN_ROUTE: "bg-violet-100 text-violet-900",
  DELIVERED: "bg-emerald-100 text-emerald-900",
  CANCELLED: "bg-slate-200 text-slate-700",
  REFUNDED: "bg-slate-200 text-slate-700",
};

export function minutesSince(date: Date | null | undefined): number {
  return date ? Math.round((Date.now() - date.getTime()) / 60000) : 0;
}

export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3600 * 1000);
}
