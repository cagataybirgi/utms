import {
  BoardReviewState,
  IBoardReviewStateRepository,
} from "./board.types";

/**
 * In-memory implementation of IBoardReviewStateRepository.
 *
 * Mirrors the structure of InMemoryApplicationRepository etc. in this
 * codebase — primary key is packageId.  Drop-in replaceable with a database
 * adapter that exposes the same interface.
 */
export class InMemoryBoardReviewStateRepository
  implements IBoardReviewStateRepository
{
  private readonly store = new Map<string, BoardReviewState>();

  clear(): void {
    this.store.clear();
  }

  findById(packageId: string): BoardReviewState | undefined {
    return this.store.get(packageId);
  }

  findAll(): BoardReviewState[] {
    return Array.from(this.store.values());
  }

  save(state: BoardReviewState): BoardReviewState {
    state.lastModifiedAt = new Date().toISOString();
    this.store.set(state.packageId, state);
    return state;
  }

  put(state: BoardReviewState): void {
    this.store.set(state.packageId, state);
  }
}
