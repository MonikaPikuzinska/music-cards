import { GameState, IGame } from "../api/interface";

/** True when a games row actually contains the fields we just tried to write. */
export function gameReflectsUpdates(
  game: IGame | null | undefined,
  updates: Partial<IGame>,
): boolean {
  if (!game) return false;

  if (updates.state != null && game.state !== updates.state) return false;

  if (
    updates.master_id != null &&
    String(game.master_id) !== String(updates.master_id)
  ) {
    return false;
  }

  if (
    updates.game_number != null &&
    Number(game.game_number) !== Number(updates.game_number)
  ) {
    return false;
  }

  const hasCoreWrite =
    updates.state != null ||
    updates.master_id != null ||
    updates.game_number != null;

  // A leftover countdown must not hide a successful Master / phase write.
  if (
    !hasCoreWrite &&
    Object.prototype.hasOwnProperty.call(updates, "timer_started_at") &&
    updates.timer_started_at == null &&
    Boolean(game.timer_started_at)
  ) {
    return false;
  }

  if (
    !hasCoreWrite &&
    updates.scores_applied != null &&
    game.scores_applied != null &&
    Boolean(game.scores_applied) !== Boolean(updates.scores_applied)
  ) {
    return false;
  }

  return true;
}

export function isNextRoundApplied(
  game: IGame | null | undefined,
  payload: Partial<IGame>,
): boolean {
  if (!game || game.state !== GameState.MASTER_SELECTS) return false;
  return gameReflectsUpdates(game, {
    state: GameState.MASTER_SELECTS,
    master_id: payload.master_id,
    game_number: payload.game_number,
  });
}
