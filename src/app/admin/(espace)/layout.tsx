import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { secondaryButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { logout } from "../../auth/actions";

const LINKS = [
  { href: "/admin", label: "Commandes" },
  { href: "/admin/fournisseurs", label: "Livreurs" },
  { href: "/admin/tarifs", label: "Tarifs" },
  { href: "/admin/reversements", label: "Reversements" },
  { href: "/admin/sms", label: "SMS" },
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireRole("ADMIN");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            {l.label}
          </Link>
        ))}
        <form action={logout} className="ml-auto">
          <SubmitButton className={`${secondaryButtonClass} !py-1.5 text-sm`}>Se déconnecter</SubmitButton>
        </form>
      </div>
      {children}
    </div>
  );
}
