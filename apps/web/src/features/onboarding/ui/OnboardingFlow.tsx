"use client";

import { useEffect, useReducer, useState } from "react";
import type { PlanProposal } from "@/contracts/onboarding";
import { CtaBar } from "@/components/CtaBar";
import { ProgressHeader } from "@/components/ProgressHeader";
import { RingTransition } from "@/components/RingTransition";
import shell from "@/components/OnboardingShell.module.css";
import tokens from "@/styles/tokens.module.css";
import { RealOnboardingDataSource, type OnboardingDataSource } from "../presentation/data-source";
import { canAdvance, createInitialState, formToDraft, onboardingReducer } from "../presentation/state";
import { STEP_LABELS, visibleStepOrder } from "../presentation/types";
import { EnduranceScreen, StrengthAvailabilityScreen } from "./screens/ActivityScreen";
import { ModeScreen, GoalsScreen, ExperienceScreen } from "./screens/BasicSelectionScreens";
import { DurationScreen, EnvironmentScreen } from "./screens/DurationEnvironmentScreen";
import { EquipmentScreen } from "./screens/EquipmentScreen";
import { DiscomfortScreen, FocusScreen } from "./screens/FocusDiscomfortScreen";
import { BirthDateScreen, HeightScreen, WeightScreen } from "./screens/PhysicalScreens";
import { ProposalScreen } from "./screens/ProposalScreen";
import { TemplateCatalogScreen } from "./screens/TemplateCatalogScreen";
import { SessionAddOnsScreen } from "./screens/SessionAddOnsScreen";

type OnboardingFlowProps = {
  dataSource?: OnboardingDataSource;
  /** Punto de integración pedido por Codex: activar el borrador ya persistido por su id. Tiene prioridad sobre dataSource.activate. */
  onActivate?: (proposal: PlanProposal) => Promise<void> | void;
};

const defaultDataSource = new RealOnboardingDataSource();

export function OnboardingFlow({ dataSource = defaultDataSource, onActivate }: OnboardingFlowProps) {
  const [state, dispatch] = useReducer(onboardingReducer, undefined, createInitialState);
  const [submitting, setSubmitting] = useState(false);
  const { form } = state;
  const steps = visibleStepOrder(form.creationMode);
  const step = steps[state.stepIndex] ?? steps[steps.length - 1];

  useEffect(() => {
    if (state.phase !== "transition" || submitting) return;
    setSubmitting(true);
    // El último paso (focus_discomfort) dispara START_TRANSITION directo, sin
    // pasar por goNext(): hay que persistirlo aquí para que el borrador
    // guardado incluya también foco/molestia antes de generar la propuesta.
    Promise.resolve(dataSource.saveStep?.(form, "discomfort"))
      .catch(() => undefined)
      .then(() => dataSource.submit(formToDraft(form)))
      .then((proposal) => dispatch({ type: "PROPOSAL_READY", proposal }))
      .catch((error: unknown) => dispatch({ type: "SUBMIT_ERROR", message: error instanceof Error ? error.message : "Error inesperado." }))
      .finally(() => setSubmitting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Hidratación de datos persistidos: opcional y en segundo plano. Si falla o
  // no está implementada (fixture), el formulario simplemente arranca vacío.
  useEffect(() => {
    dataSource
      .loadInitialDraft?.()
      .then((partial) => partial && dispatch({ type: "HYDRATE", form: partial }))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goNext() {
    dataSource
      .saveStep?.(form, step)
      .then(() => dispatch({ type: "STEP_SAVE_ERROR", message: null }))
      .catch((error: unknown) => dispatch({ type: "STEP_SAVE_ERROR", message: error instanceof Error ? error.message : "Error inesperado." }));
    dispatch({ type: "GO_NEXT" });
  }

  function activate(proposal: PlanProposal) {
    dispatch({ type: "ACTIVATE_START" });
    const task = onActivate ? Promise.resolve(onActivate(proposal)) : Promise.resolve(dataSource.activate?.(proposal));
    task
      .then(() => dispatch({ type: "ACTIVATE_SUCCESS" }))
      .catch((error: unknown) => dispatch({ type: "ACTIVATE_ERROR", message: error instanceof Error ? error.message : "Error inesperado." }));
  }

  if (state.phase === "transition") {
    return (
      <div className={`${tokens.root} ${shell.shell}`}>
        <RingTransition onFinished={() => dispatch({ type: "RING_FINISHED" })} />
      </div>
    );
  }

  if (state.phase === "proposal" && state.proposal) {
    return (
      <div className={`${tokens.root} ${shell.shell}`}>
        <ProposalScreen
          proposal={state.proposal}
          environment={form.environments[0]}
          onActivate={activate}
          onRestart={() => dispatch({ type: "RESTART_FROM_FORM" })}
          activating={state.activating}
          activationError={state.activationError}
          activated={state.activated}
        />
      </div>
    );
  }

  return (
    <div className={`${tokens.root} ${shell.shell}`}>
      <ProgressHeader currentIndex={state.stepIndex} totalSteps={form.creationMode === null ? null : steps.length} stepLabel={STEP_LABELS[step]} />

      {state.submitError && (
        <p role="alert" style={{ margin: "0 20px", color: "var(--warn)" }}>
          No pudimos preparar tu plan: {state.submitError}.{" "}
          <button
            type="button"
            onClick={() => dispatch({ type: "START_TRANSITION" })}
            style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", textDecoration: "underline", font: "inherit", cursor: "pointer" }}
          >
            Reintentar
          </button>
        </p>
      )}
      {state.stepSaveError && (
        <p role="alert" style={{ margin: "0 20px", color: "var(--warn)" }}>
          No pudimos guardar este paso: {state.stepSaveError}. Tus respuestas siguen aquí; puedes continuar y lo reintentaremos en el siguiente paso.
        </p>
      )}

      {step === "mode" && <ModeScreen value={form.creationMode} onChange={(mode) => dispatch({ type: "SET_MODE", mode })} />}
      {step === "goals" && <GoalsScreen goals={form.goals} onToggle={(goal) => dispatch({ type: "TOGGLE_GOAL", goal })} />}
      {step === "experience" && (
        <ExperienceScreen value={form.experience} onChange={(experience) => dispatch({ type: "SET_EXPERIENCE", experience })} />
      )}
      {step === "birth_date" && (
        <BirthDateScreen
          day={form.birthDay}
          month={form.birthMonth}
          year={form.birthYear}
          onDayChange={(day) => dispatch({ type: "SET_BIRTH_DAY", day })}
          onMonthChange={(month) => dispatch({ type: "SET_BIRTH_MONTH", month })}
          onYearChange={(year) => dispatch({ type: "SET_BIRTH_YEAR", year })}
        />
      )}
      {step === "height" && <HeightScreen heightCm={form.heightCm} onChange={(heightCm) => dispatch({ type: "SET_HEIGHT", heightCm })} />}
      {step === "weight" && (
        <WeightScreen
          whole={form.weightWholeKg}
          decimal={form.weightDecimalKg}
          onWholeChange={(whole) => dispatch({ type: "SET_WEIGHT_WHOLE", whole })}
          onDecimalChange={(decimal) => dispatch({ type: "SET_WEIGHT_DECIMAL", decimal })}
        />
      )}
      {step === "strength_availability" && (
        <StrengthAvailabilityScreen
          strengthAvailability={form.strengthAvailability}
          onToggleStrengthDay={(day) => dispatch({ type: "TOGGLE_STRENGTH_DAY", day })}
        />
      )}
      {step === "endurance" && (
        <EnduranceScreen
          enduranceActivities={form.enduranceActivities}
          onUpsertEndurance={(activity) => dispatch({ type: "UPSERT_ENDURANCE_ACTIVITY", activity })}
          onRemoveEndurance={(kind) => dispatch({ type: "REMOVE_ENDURANCE_ACTIVITY", kind })}
        />
      )}
      {step === "duration" && (
        <DurationScreen
          sessionDurationMinutes={form.sessionDurationMinutes}
          onDurationChange={(minutes) => dispatch({ type: "SET_DURATION", minutes })}
        />
      )}
      {step === "environment" && (
        <EnvironmentScreen
          selectedEnvironments={form.environments.map((env) => env.kind)}
          onToggleEnvironment={(kind) => dispatch({ type: "TOGGLE_ENVIRONMENT", kind })}
        />
      )}
      {step === "equipment" && (
        <EquipmentScreen
          environments={form.environments}
          onToggleEquipment={(kind, equipment) => dispatch({ type: "TOGGLE_EQUIPMENT", kind, equipment })}
        />
      )}
      {step === "session_addons" && (
        <SessionAddOnsScreen
          value={form.sessionAddOns}
          environment={form.environments[0]?.kind}
          onChange={(addOns) => dispatch({ type: "SET_SESSION_ADD_ONS", addOns })}
        />
      )}
      {step === "template" && (
        <TemplateCatalogScreen
          creationMode={form.creationMode}
          environment={form.environments[0]}
          strengthDays={form.strengthAvailability.length}
          selectedTemplateId={form.selectedTemplateId}
          onSelect={(templateId) => dispatch({ type: "SELECT_TEMPLATE", templateId })}
          onUseGuided={() => dispatch({ type: "SET_MODE", mode: "guided" })}
        />
      )}
      {step === "focus" && (
        <FocusScreen
          optionalMuscleFocus={form.optionalMuscleFocus}
          onToggleFocus={(focus) => dispatch({ type: "TOGGLE_MUSCLE_FOCUS", focus })}
        />
      )}
      {step === "discomfort" && (
        <DiscomfortScreen
          discomfort={form.discomfort}
          onDiscomfortChange={(discomfort) => dispatch({ type: "SET_DISCOMFORT", discomfort })}
        />
      )}

      <CtaBar
        onBack={state.stepIndex > 0 ? () => dispatch({ type: "GO_BACK" }) : undefined}
        continueLabel={state.stepIndex === steps.length - 1 ? "Confirmar" : "Continuar"}
        continueDisabled={!canAdvance(state)}
        onContinue={() => {
          if (state.stepIndex === steps.length - 1) dispatch({ type: "START_TRANSITION" });
          else goNext();
        }}
      />
    </div>
  );
}
