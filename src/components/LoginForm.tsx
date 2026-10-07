"use client";

import { useActionState } from "react";
import { login } from "@/app/auth/actions";
import { Alert, inputClass, labelClass } from "./ui";
import { SubmitButton } from "./SubmitButton";

export function LoginForm({ role }: { role: "ADMIN" | "SUPPLIER" }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="role" value={role} />
      <div>
        <label className={labelClass} htmlFor="phone">
          Numéro de téléphone
        </label>
        <input id="phone" name="phone" type="tel" className={inputClass} placeholder="077 12 34 56" required />
      </div>
      <div>
        <label className={labelClass} htmlFor="password">
          Mot de passe
        </label>
        <input id="password" name="password" type="password" className={inputClass} required />
      </div>
      <SubmitButton>Se connecter</SubmitButton>
    </form>
  );
}
