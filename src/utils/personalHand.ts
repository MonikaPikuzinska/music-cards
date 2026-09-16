/** Personal 6-song list is visible from the start of the round, including while the Master picks. */
export function shouldShowPersonalHand(params: {
  isUserCreated: boolean;
  isMasterSelectState: boolean;
  isUsersSelectState: boolean;
  isCurrentMaster: boolean;
  masterHasPickedThisRound?: boolean;
}): boolean {
  if (!params.isUserCreated) return false;
  if (params.isMasterSelectState) return true;
  if (!params.isUsersSelectState) return false;
  if (!params.isCurrentMaster) return true;
  return params.masterHasPickedThisRound === false;
}
