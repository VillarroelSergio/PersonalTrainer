import type { PlanProposal } from "@/contracts/onboarding";

export function replaceProposalExerciseVariant(
  proposal: PlanProposal,
  sessionIndex: number,
  exerciseIndex: number,
  variantId: string
): PlanProposal {
  const session = proposal.week.sessions[sessionIndex];
  if (!session?.exercises?.[exerciseIndex]) return proposal;

  return {
    ...proposal,
    week: {
      ...proposal.week,
      sessions: proposal.week.sessions.map((currentSession, currentSessionIndex) => {
        if (currentSessionIndex !== sessionIndex || !currentSession.exercises) return currentSession;
        return {
          ...currentSession,
          exercises: currentSession.exercises.map((exercise, currentExerciseIndex) => (
            currentExerciseIndex === exerciseIndex ? { ...exercise, variantId } : exercise
          ))
        };
      })
    }
  };
}
