import { Prisma } from "@prisma/client";
import {
  BoardDecision,
  BoardLifecycleStatus,
  BoardNotificationStub,
  BoardReviewState,
  DeanSignature,
} from "../../modules/board/board.types";

export type PrismaBoardReviewStateRow = Prisma.BoardReviewStateGetPayload<
  Record<string, never>
>;

/**
 * Map a Neon `board_review_states` row onto the domain `BoardReviewState`.
 * Nested objects (deanSignature, boardDecision, notifications) live in JSONB
 * columns and round-trip as plain JSON.
 */
export function boardStateToDomain(row: PrismaBoardReviewStateRow): BoardReviewState {
  return {
    packageId: row.packageId,
    lifecycle: row.lifecycle as BoardLifecycleStatus,
    deanSignature: (row.deanSignature as unknown as DeanSignature | null) ?? null,
    boardDecision: (row.boardDecision as unknown as BoardDecision | null) ?? null,
    hashLocked: row.hashLocked,
    hashLockedAt: row.hashLockedAt ? row.hashLockedAt.toISOString() : null,
    hashLockReason: row.hashLockReason ?? null,
    clarificationNote: row.clarificationNote ?? null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    notifications: (row.notifications as unknown as BoardNotificationStub[]) ?? [],
    createdAt: row.createdAt.toISOString(),
    lastModifiedAt: row.lastModifiedAt.toISOString(),
  };
}

/**
 * Full column set for upserting a BoardReviewState. `lastModifiedAt` is owned
 * by Prisma (@updatedAt), so we omit it from create input.
 */
export function boardStateToPrismaUpsert(
  state: BoardReviewState,
): Prisma.BoardReviewStateUncheckedCreateInput {
  return {
    packageId: state.packageId,
    lifecycle: state.lifecycle,
    deanSignature: state.deanSignature
      ? (state.deanSignature as unknown as Prisma.InputJsonValue)
      : Prisma.DbNull,
    boardDecision: state.boardDecision
      ? (state.boardDecision as unknown as Prisma.InputJsonValue)
      : Prisma.DbNull,
    hashLocked: state.hashLocked,
    hashLockedAt: state.hashLockedAt ? new Date(state.hashLockedAt) : null,
    hashLockReason: state.hashLockReason ?? null,
    clarificationNote: state.clarificationNote ?? null,
    publishedAt: state.publishedAt ? new Date(state.publishedAt) : null,
    notifications: state.notifications as unknown as Prisma.InputJsonValue,
    createdAt: new Date(state.createdAt),
  };
}
