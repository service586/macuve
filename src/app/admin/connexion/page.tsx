import { Card, PageTitle } from "@/components/ui";
import { LoginForm } from "@/components/LoginForm";

export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle>Administration</PageTitle>
      <Card>
        <LoginForm role="ADMIN" />
      </Card>
    </div>
  );
}
