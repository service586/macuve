"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Vérifie le statut toutes les 4 secondes pendant 90 secondes, au cas où
// l'appel de retour du prestataire arrive en retard.
export function PaymentWatcher({ orderRef }: { orderRef: string }) {
  const router = useRouter();

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - started > 90_000) {
        clearInterval(timer);
        router.refresh();
        return;
      }
      try {
        const res = await fetch(`/api/commandes/${orderRef}/statut`, { cache: "no-store" });
        const data = (await res.json()) as { status: string; paymentStatus?: string };
        if (data.status !== "PENDING_PAYMENT" || data.paymentStatus === "FAILED") {
          clearInterval(timer);
          router.refresh();
        }
      } catch {
        // réseau instable : on réessaie au prochain tour
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [orderRef, router]);

  return (
    <div className="flex items-center justify-center gap-3 text-slate-600">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
      En attente de votre validation…
    </div>
  );
}
