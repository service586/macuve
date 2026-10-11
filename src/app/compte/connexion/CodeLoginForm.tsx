"use client";

import { useActionState } from "react";
import { customerLogin, type CodeState } from "../actions";
import { Alert, inputClass, labelClass, secondaryButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { displayPhone } from "@/lib/phone";

export function CodeLoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<CodeState, FormData>(customerLogin, { step: "phone" });

  if (state.step === "phone") {
    return (
      <form action={action} className="space-y-4">
        {state.error && <Alert>{state.error}</Alert>}
        <div>
          <label className={labelClass} htmlFor="phone">
            Votre numéro de téléphone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={inputClass}
            placeholder="077 12 34 56"
            required
          />
        </div>
        <SubmitButton pendingText="Envoi…">Recevoir un code par SMS</SubmitButton>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        {state.error && <Alert>{state.error}</Alert>}
        {state.testCode && (
          <Alert kind="info">
            Mode test, aucun SMS n&apos;est envoyé : votre code est <strong className="font-mono">{state.testCode}</strong>
          </Alert>
        )}
        <p className="text-sm text-slate-600">Code envoyé par SMS au {displayPhone(state.phone)}.</p>
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <label className={labelClass} htmlFor="code">
            Code à 6 chiffres
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            className={`${inputClass} font-mono text-xl tracking-[0.4em]`}
            required
            autoFocus
          />
        </div>
        <SubmitButton pendingText="Vérification…">Se connecter</SubmitButton>
      </form>
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="intent" value="resend" />
          <SubmitButton className={`${secondaryButtonClass} text-sm`}>Renvoyer le code</SubmitButton>
        </form>
        <form action={action}>
          <input type="hidden" name="intent" value="restart" />
          <SubmitButton className={`${secondaryButtonClass} text-sm`}>Changer de numéro</SubmitButton>
        </form>
      </div>
    </div>
  );
}
