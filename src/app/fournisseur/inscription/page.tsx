import { connection } from "next/server";
import { db } from "@/lib/db";
import { Card, PageTitle } from "@/components/ui";
import { RegisterForm } from "./RegisterForm";

export default async function SupplierRegisterPage() {
  await connection();
  const zones = await db.zone.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle subtitle="Recevez des commandes payées d'avance dans votre zone. Votre compte est activé après vérification.">
        Devenir livreur partenaire
      </PageTitle>
      <Card>
        <RegisterForm zones={zones.map((z) => ({ id: z.id, name: z.name }))} />
      </Card>
    </div>
  );
}
