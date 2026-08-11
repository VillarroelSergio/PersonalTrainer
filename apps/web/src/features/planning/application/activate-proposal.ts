export type ActivationRepository = {
  findProposal(input: { ownerId: string; proposalId: string }): Promise<{ id: string; ownerId: string; proposalJson: string } | undefined>;
  archiveActivePlans(ownerId: string): Promise<number>;
  createActivePlan(input: { ownerId: string; proposalId: string; contentJson: string }): Promise<{ id: string; ownerId: string; proposalId: string; contentJson: string }>;
  markProposalActivated(proposalId: string): Promise<void>;
};

export async function activateProposal(input: { ownerId: string; proposalId: string }, repository: ActivationRepository) {
  const proposal = await repository.findProposal(input);
  if (!proposal) throw Object.assign(new Error("Plan proposal not found."), { code: "NOT_FOUND" });
  await repository.archiveActivePlans(input.ownerId);
  const plan = await repository.createActivePlan({ ownerId: input.ownerId, proposalId: proposal.id, contentJson: proposal.proposalJson });
  await repository.markProposalActivated(proposal.id);
  return plan;
}
