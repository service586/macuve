import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PageTitle } from "@/components/ui";
import { getCurrentCustomer } from "@/lib/auth";
import { CodeLoginForm } from "./CodeLoginForm";

export default async function CustomerLoginPage({ searchParams }: PageProps<"/compte/connexion">) {
  if (await getCurrentCustomer()) redirect("/compte");
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <PageTitle subtitle="Retrouvez vos commandes et votre adresse. Pas de mot de passe : un code vous est envoyé par SMS.">
        Mon compte
      </PageTitle>
      <Card>
        <CodeLoginForm next={typeof next === "string" ? next : undefined} />
      </Card>
      <p className="mt-4 text-center text-sm text-slate-600">
        Vous avez commandé sans compte ?{" "}
        <Link href="/suivi" className="text-sky-700 underline">
          Suivre une commande avec son numéro
        </Link>
      </p>
    </div>
  );
}
