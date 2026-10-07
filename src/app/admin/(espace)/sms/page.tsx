import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { Alert, Card, PageTitle } from "@/components/ui";

export default async function AdminSmsPage() {
  await requireRole("ADMIN");
  const messages = await db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="space-y-4">
      <PageTitle>SMS</PageTitle>
      <Alert kind="info">Aucun fournisseur SMS n&apos;est encore branché : les messages sont enregistrés ici sans être envoyés.</Alert>
      {messages.length === 0 && <p className="text-slate-500">Aucun message.</p>}
      {messages.map((m) => (
        <Card key={m.id} className="!p-3 text-sm">
          <div className="text-xs text-slate-500">
            {formatDate(m.createdAt)} · à {displayPhone(m.to)}
          </div>
          <div>{m.message}</div>
        </Card>
      ))}
    </div>
  );
}
