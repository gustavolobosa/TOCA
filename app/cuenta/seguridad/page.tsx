import { notFound, redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { MfaForm } from "@/components/mfa-form";

export default async function SecurityPage() {
  const { supabase, isAdmin, profile } = await requireAccount();
  if (!isAdmin) notFound();
  if (profile.must_change_password) redirect("/cuenta/clave");
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error("No pudimos consultar el segundo factor.");
  return <main className="form-page"><div className="form-heading">
    <h1>Protege tu acceso administrador</h1>
    <p className="muted">El segundo factor es obligatorio antes de gestionar usuarios y NFC.</p>
  </div><section className="editor-card"><MfaForm factorId={data.totp[0]?.id} /></section></main>;
}
