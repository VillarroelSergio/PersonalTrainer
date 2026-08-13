import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { loadOwnedDraft, saveOwnedDraft } from "@/features/onboarding/domain/onboarding-draft-repository";
import { GOAL_OPTIONS, DURATION_OPTIONS, ENVIRONMENT_OPTIONS, EQUIPMENT_OPTIONS } from "@/features/onboarding/presentation/constants";
import { profileFormDataToPatch } from "@/features/profile/domain/profile-patch";
import { AppShell } from "@/components/AppShell";
import { SignOutButton } from "@/features/profile/ui/SignOutButton";
import { InstallStatus } from "@/features/profile/ui/InstallStatus";
import { AccountDeletionControl } from "@/features/account/ui/AccountDeletionControl";
import Image from "next/image";
import { EQUIPMENT_IMAGE } from "@/features/onboarding/presentation/constants";

function optionLabel<T extends string | number>(options: Array<{ value: T; label: string }>, value: T): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

function computeAge(day?: number, month?: number, year?: number): number | null {
  if (!day || !month || !year) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  const hasHadBirthdayThisYear = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

async function saveProfileSection(formData: FormData) {
  "use server";
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  await saveOwnedDraft(getDb(), session.user.id, profileFormDataToPatch(formData));
  revalidatePath("/perfil");
}

export default async function PerfilPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const draft = await loadOwnedDraft(getDb(), session.user.id);
  const age = computeAge(draft?.birthDay, draft?.birthMonth, draft?.birthYear);
  const weightKg = draft?.weightWholeKg !== undefined ? draft.weightWholeKg + (draft.weightDecimalKg ?? 0) / 10 : null;

  return (
    <AppShell title="Perfil" backHref="/hoy">
      <div className="view-profile">
        <h1 className="view-title">Perfil</h1>
        <p className="lede small">
          {session.user.email}
          {draft?.goals?.length ? ` · ${draft.goals.map((goal) => optionLabel(GOAL_OPTIONS, goal)).join(", ")}` : " · Sin objetivo definido"}
        </p>

        <h2 className="section-title">Preferencias</h2>
        <div className="refblock">
          <p className="field__label">Objetivos</p>
          <div className="chiprow">
            {draft?.goals?.length ? (
              draft.goals.map((goal) => <span key={goal} className="chip chip--compact">{optionLabel(GOAL_OPTIONS, goal)}</span>)
            ) : (
              <span className="chip chip--compact" aria-disabled="true">Sin definir</span>
            )}
          </div>
          <p className="field__label">Duración y unidades</p>
          <div className="chiprow">
            <span className="chip chip--compact">{draft?.sessionDurationMinutes ? optionLabel(DURATION_OPTIONS, draft.sessionDurationMinutes) : "Sin definir"}</span>
            <span className="chip chip--compact">kg · cm</span>
          </div>
        </div>

        <details className="profile-edit">
          <summary><span className="profile-edit__value">Editar preferencias</span><span className="profile-edit__action">Abrir</span></summary>
          <form action={saveProfileSection} className="profile-edit__form">
            <div className="chiprow">
              {GOAL_OPTIONS.map((goal) => (
                <label key={goal.value} className="chip chip--compact profile-chip">
                  <input className="sr-only" type="checkbox" name="goals" value={goal.value} defaultChecked={draft?.goals?.includes(goal.value)} />
                  <span>{goal.label}</span>
                </label>
              ))}
            </div>
            <label className="field__label" htmlFor="sessionDurationMinutes">Duración habitual</label>
            <select id="sessionDurationMinutes" name="sessionDurationMinutes" className="picker picker--compact" defaultValue={draft?.sessionDurationMinutes ?? 60}>
              {DURATION_OPTIONS.map((duration) => <option key={duration.value} value={duration.value}>{duration.label}</option>)}
            </select>
            <button className="btn btn--primary btn--block btn--compact" type="submit">Guardar preferencias</button>
          </form>
        </details>

        <h2 className="section-title">Físico y equipamiento</h2>
        <div className="figures">
          <div className="figure">
            <p className="figure__num">{age ?? "–"}</p>
            <p className="figure__label">Edad</p>
          </div>
          <div className="figure">
            <p className="figure__num">{draft?.heightCm ?? "–"}<span className="figure__unit">cm</span></p>
            <p className="figure__label">Altura</p>
          </div>
          <div className="figure">
            <p className="figure__num">{weightKg ?? "–"}<span className="figure__unit">kg</span></p>
            <p className="figure__label">Peso</p>
          </div>
        </div>
        <div className="refblock">
          {draft?.environments?.length ? (
            draft.environments.map((environment) => (
              <div key={environment.kind}>
                <p className="field__label">{optionLabel(ENVIRONMENT_OPTIONS, environment.kind)}</p>
                <div className="profile-equipment" aria-label={`Equipamiento en ${optionLabel(ENVIRONMENT_OPTIONS, environment.kind)}`}>
                  {environment.equipment.length ? (
                    environment.equipment.map((item) => (
                      <span key={item} className="profile-equipment__item">
                        <Image src={EQUIPMENT_IMAGE[item]} alt="" width={44} height={32} />
                        <span>{optionLabel(EQUIPMENT_OPTIONS, item)}</span>
                      </span>
                    ))
                  ) : (
                    <span className="chip chip--compact" aria-disabled="true">Sin equipamiento</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="small">Sin entornos declarados.</p>
          )}
        </div>

        <details className="profile-edit">
          <summary><span className="profile-edit__value">Editar físico y equipo</span><span className="profile-edit__action">Abrir</span></summary>
          <form action={saveProfileSection} className="profile-edit__form">
            <div className="reffields">
              <label className="field"><span className="field__label">Altura</span><input name="heightCm" inputMode="numeric" defaultValue={draft?.heightCm ?? ""} placeholder="170" /></label>
              <label className="field"><span className="field__label">Peso</span><input name="weightKg" inputMode="decimal" defaultValue={weightKg ?? ""} placeholder="70" /></label>
            </div>
            <div className="reffields">
              <label className="field"><span className="field__label">Día</span><input name="birthDay" inputMode="numeric" defaultValue={draft?.birthDay ?? ""} placeholder="12" /></label>
              <label className="field"><span className="field__label">Mes</span><input name="birthMonth" inputMode="numeric" defaultValue={draft?.birthMonth ?? ""} placeholder="8" /></label>
              <label className="field"><span className="field__label">Año</span><input name="birthYear" inputMode="numeric" defaultValue={draft?.birthYear ?? ""} placeholder="1996" /></label>
            </div>
            <label className="field__label" htmlFor="environmentKind">Entorno</label>
            <select id="environmentKind" name="environmentKind" className="picker picker--compact" defaultValue={draft?.environments?.[0]?.kind ?? "full_gym"}>
              {ENVIRONMENT_OPTIONS.map((environment) => <option key={environment.value} value={environment.value}>{environment.label}</option>)}
            </select>
            <div className="chiprow">
              {EQUIPMENT_OPTIONS.map((item) => (
                <label key={item.value} className="chip chip--compact profile-chip">
                  <input className="sr-only" type="checkbox" name="equipment" value={item.value} defaultChecked={draft?.environments?.[0]?.equipment?.includes(item.value)} />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <button className="btn btn--primary btn--block btn--compact" type="submit">Guardar cambios</button>
          </form>
        </details>

        <h2 className="section-title">Cuenta</h2>
        <div className="refblock">
          <p className="small">Acceso con correo y contraseña.</p>
          <p className="small"><InstallStatus /></p>
          <details className="profile-detail">
            <summary className="small">Qué guardamos</summary>
            <p className="lede small">Tu perfil, tu plan activo, tus sesiones registradas y tu estado de check-in se guardan en tu cuenta. No se comparten con terceros ni se usan con fines distintos a mostrarte tu propio entrenamiento.</p>
          </details>
          <SignOutButton />
        </div>

        <div className="danger-zone">
          <AccountDeletionControl />
        </div>
      </div>
    </AppShell>
  );
}
