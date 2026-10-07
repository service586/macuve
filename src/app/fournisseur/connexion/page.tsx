import Link from "next/link";
import { Card, PageTitle } from "@/components/ui";
import { LoginForm } from "@/components/LoginForm";

export default function SupplierLoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle subtitle="Accédez aux commandes de votre zone.">Espace livreur</PageTitle>
      <Card className="space-y-4">
        <LoginForm role="SUPPLIER" />
        <p className="text-sm text-slate-600">
          Pas encore partenaire ?{" "}
          <Link href="/fournisseur/inscription" className="font-semibold text-sky-700 underline">
            Inscrivez votre citerne
          </Link>
        </p>
      </Card>
    </div>
  );
}
