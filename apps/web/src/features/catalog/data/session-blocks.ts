import type { OnboardingDraft } from "@/contracts/onboarding";
import { MOBILITY_ROUTINES, exercisesForMobilityRoutine, type MobilityRoutine } from "./mobility-catalog";
import { FOUNDATION_BLOCKS } from "./foundation-blocks";
import type { TrainingBlock } from "@/features/catalog/domain/training-block";
import type { EnvironmentKind } from "@/features/catalog/data/exercise-catalog";

export type SessionBlockKind = Exclude<TrainingBlock["kind"], "strength">;

export const DEFAULT_WARMUP_ROUTINE_ID = "mobility-full-body-18";
export const DEFAULT_COOLDOWN_ROUTINE_ID = "stretch-recovery-20";

function routineSupportsEnvironment(routine: MobilityRoutine, environment: EnvironmentKind): boolean {
  return exercisesForMobilityRoutine(routine).every((exercise) => exercise.environments.includes(environment));
}

export function availableMobilityRoutines(environment: EnvironmentKind, kind: "warmup" | "cooldown"): MobilityRoutine[] {
  // Cualquier secuencia puede preparar o cerrar una sesión. El contexto cambia
  // la etiqueta del bloque, no debe ocultar rutinas útiles por su prefijo.
  void kind;
  return MOBILITY_ROUTINES.filter((routine) => routineSupportsEnvironment(routine, environment));
}

function routineFor(environment: EnvironmentKind, kind: "warmup" | "cooldown", requestedId?: string): MobilityRoutine | undefined {
  const candidates = availableMobilityRoutines(environment, kind);
  return candidates.find((routine) => routine.id === requestedId) ?? candidates[0];
}

export function routineBlock(routine: MobilityRoutine, kind: "warmup" | "cooldown"): TrainingBlock {
  return {
    id: `${kind}-${routine.id}`,
    kind,
    estimatedMinutes: routine.durationMinutes,
    instructions: `${routine.name}: ${routine.purpose}.`,
    variantIds: routine.exerciseIds
  };
}

export function blocksForSessionAddOns(
  addOns: OnboardingDraft["sessionAddOns"],
  environment: OnboardingDraft["environments"][number]
): TrainingBlock[] {
  const blocks: TrainingBlock[] = [];
  if (addOns?.warmup) {
    const routine = routineFor(environment.kind, "warmup", addOns.warmupRoutineId);
    if (routine) blocks.push(routineBlock(routine, "warmup"));
  }
  if (addOns?.cooldown) {
    const routine = routineFor(environment.kind, "cooldown", addOns.cooldownRoutineId);
    if (routine) blocks.push(routineBlock(routine, "cooldown"));
  }
  return blocks;
}

export function allEditableSessionBlocks(): TrainingBlock[] {
  const foundation = FOUNDATION_BLOCKS.map(({ requirements: _requirements, ...block }) => block);
  const routines = MOBILITY_ROUTINES.flatMap((routine) => [routineBlock(routine, "warmup"), routineBlock(routine, "cooldown")]);
  return [...foundation, ...routines];
}

export function findSessionBlock(id: string): TrainingBlock | undefined {
  return allEditableSessionBlocks().find((block) => block.id === id);
}

export function sessionBlockLabel(block: TrainingBlock): string {
  const routineId = block.id.replace(/^(warmup|cooldown)-/, "");
  const routine = MOBILITY_ROUTINES.find((candidate) => candidate.id === routineId);
  if (routine) return routine.name;
  if (block.id === "warmup-general-mobility") return "Movilidad articular general";
  if (block.id === "warmup-breathing-activation") return "Respiración y activación";
  if (block.id === "cooldown-general-mobility") return "Vuelta a la calma";
  if (block.id === "mobility-foam-roll") return "Rodillo de espuma";
  return block.kind === "warmup" ? "Calentamiento" : block.kind === "cooldown" ? "Movilidad y estiramientos" : "Movilidad";
}
