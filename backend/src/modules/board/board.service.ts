import { randomUUID } from "node:crypto";
import {
  ApplicationStatus,
  EvaluationPackage,
  PackageStatus,
  UserRole,
} from "../../shared/types";
import {
  IAsyncApplicationRepository,
  IIntibakRepository,
  IPackageRepository,
} from "../../shared/repositories";
import { AuditLogger, NotificationService } from "../../shared/audit";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors";
import { computePackageHash } from "./hash";
import {
  BoardDecisionInput,
  BoardDecisionResult,
  BoardNotificationStub,
  BoardReviewState,
  ConfirmForPublicationInput,
  ConfirmForPublicationResult,
  DeanSignature,
  HashCheckResult,
  IBoardReviewStateRepository,
  IntibakCompletenessResult,
  LoopbackTarget,
  PublishInput,
  PublishResult,
  ReturnForClarificationInput,
  ReturnForClarificationResult,
  SignatureIssueResult,
  SignatureVerifyInput,
  SignatureVerifyResult,
  StatePropagationEvent,
} from "./board.types";

export interface BoardServiceDeps {
  applications: IAsyncApplicationRepository;
  intibakTables: IIntibakRepository;
  packages: IPackageRepository;
  boardStates: IBoardReviewStateRepository;
  audit: AuditLogger;
  notifications: NotificationService;
}

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * BoardService — owns the high-stakes transitions between Dean → Faculty
 * Board → Publication.  Five safety protocols live in this single service so
 * that the gate, integrity, signature, approval and notification flows share
 * one consistent state machine.
 *
 *   TC-7B   → checkIntibakCompleteness (called by IntibakService.sendPackage too)
 *   702-HASH→ checkHashIntegrity / clearHashLock
 *   TC-7C   → issueDeanSignatureToken / verifyDeanSignature
 *   TC-7A   → boardDecide (approval path)
 *   TC-7E   → boardDecide (rejection path)
 *   571-NTF → publish
 */
export class BoardService {
  /** Issued-but-unconsumed signature tokens.  In production: persist to DB. */
  private readonly tokenRegistry = new Map<
    string,
    { signatoryId: string; issuedAt: Date }
  >();

  constructor(private readonly deps: BoardServiceDeps) {}

  // ─────────────────────────────────────────────────────────────────────────
  //   List / detail
  // ─────────────────────────────────────────────────────────────────────────

  listBoardQueue(): Array<{ pkg: EvaluationPackage; state: BoardReviewState }> {
    return this.deps.boardStates
      .findAll()
      .map((state) => {
        const pkg = this.deps.packages.findById(state.packageId);
        return pkg ? { pkg, state } : null;
      })
      .filter((x): x is { pkg: EvaluationPackage; state: BoardReviewState } => x !== null);
  }

  getBoardPackage(packageId: string): {
    pkg: EvaluationPackage;
    state: BoardReviewState;
    hashCheck: HashCheckResult;
  } {
    const pkg = this.requirePackage(packageId);
    const state = this.requireBoardState(packageId);
    const hashCheck = this.checkHashIntegrity(packageId);
    return { pkg, state, hashCheck };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //   TC-7B  —  Intibak Completeness Gate
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Pure read — never mutates.  Confirms every asil application has a
   * finalized (saved + locked) intibak table.  Called by IntibakService just
   * before sending the package to the Dean, and re-checked on the Board side
   * before approval.
   */
  async checkIntibakCompleteness(packageId: string): Promise<IntibakCompletenessResult> {
    const pkg = this.deps.packages.findById(packageId);
    if (!pkg) {
      return {
        packageId,
        totalAsil: 0,
        missingApplicationIds: [],
        missingStudentNames: [],
        isComplete: false,
        blockedBy: "INTIBAK_GATE",
      };
    }

    const missingIds: string[] = [];
    const missingNames: string[] = [];
    for (const applicationId of pkg.asilApplicationIds) {
      const app = await this.deps.applications.findById(applicationId);
      if (!app || !app.intibakTableId) {
        missingIds.push(applicationId);
        missingNames.push(app?.studentFullName ?? applicationId);
        continue;
      }
      const table = this.deps.intibakTables.findById(app.intibakTableId);
      if (!table || !table.isLocked || !table.savedAt) {
        missingIds.push(applicationId);
        missingNames.push(app.studentFullName);
      }
    }

    return {
      packageId,
      totalAsil: pkg.asilApplicationIds.length,
      missingApplicationIds: missingIds,
      missingStudentNames: missingNames,
      isComplete: missingIds.length === 0,
      blockedBy: missingIds.length > 0 ? "INTIBAK_GATE" : null,
    };
  }

  /**
   * Shared gate used by TC-7B (Dean signature) and TC-7D (Board approval) to
   * block the workflow when any Asil applicant's intibak table is incomplete.
   * Includes student names in the error message so the actor can identify the
   * affected record without an extra round-trip.
   */
  private async assertIntibakComplete(
    packageId: string,
    context: "DEAN_SIGNATURE" | "BOARD_APPROVAL",
  ): Promise<void> {
    const completeness = await this.checkIntibakCompleteness(packageId);
    if (completeness.isComplete) return;

    const names = completeness.missingStudentNames.join(", ");
    const message =
      context === "DEAN_SIGNATURE"
        ? `Fakülte Kuruluna yönlendirme yapılamaz: ${names} için intibak verisi eksik. Açıklama notu ile Değerlendirme Komisyonuna iade edin.`
        : `Son Güvenlik Kontrolü Hatası: ${names} için tutarsız veri tespit edildi. Lütfen imzalamadan önce listeyi yenileyin.`;
    throw new ConflictError("INTIBAK_GATE", message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //   702-HASH  —  Post-signature integrity check
  // ─────────────────────────────────────────────────────────────────────────

  checkHashIntegrity(packageId: string): HashCheckResult {
    const pkg = this.requirePackage(packageId);
    const state = this.requireBoardState(packageId);

    // No dean signature yet → no integrity baseline to check against.
    if (!state.deanSignature) {
      return {
        packageId,
        hashAtSignature: "",
        currentHash: computePackageHash(this.canonicalInput(pkg)),
        isMatch: true,
        errorCode: null,
        locked: false,
      };
    }

    const currentHash = computePackageHash(this.canonicalInput(pkg));
    const signedHash = state.deanSignature.documentHashAtSignature;
    const isMatch = currentHash === signedHash;

    if (!isMatch && !state.hashLocked) {
      // First detection — lock the board state and write an audit entry.
      state.hashLocked = true;
      state.hashLockedAt = new Date().toISOString();
      state.hashLockReason = `702-HASH mismatch. Signed: ${signedHash}. Current: ${currentHash}.`;
      state.lifecycle = "LOCKED_HASH_VIOLATION";
      this.deps.boardStates.save(state);
      this.deps.audit.write({
        actorUserId: "SYSTEM",
        actorRole: UserRole.SystemAdmin,
        actionType: "HASH_INTEGRITY_VIOLATION",
        affectedEntityId: packageId,
        affectedEntityType: "BoardReviewState",
        previousValue: { hashLocked: false },
        newValue: { hashLocked: true, signedHash, currentHash },
      });
    }

    return {
      packageId,
      hashAtSignature: signedHash,
      currentHash,
      isMatch,
      errorCode: isMatch ? null : "702-HASH",
      locked: !isMatch,
    };
  }

  /**
   * Clears the 702-HASH lock by accepting a fresh dean signature on the
   * current document state.  Use this after a sysadmin corrects the tampered
   * data and the Dean re-signs.
   */
  clearHashLock(packageId: string, newToken: string, signatoryId: string): void {
    const pkg = this.requirePackage(packageId);
    const state = this.requireBoardState(packageId);

    if (!state.hashLocked) {
      throw new ConflictError(
        "NOT_LOCKED",
        "Paket 702-HASH kilitli durumda değil.",
      );
    }

    const currentHash = computePackageHash(this.canonicalInput(pkg));
    state.deanSignature = this.buildSignature(newToken, signatoryId, currentHash);
    state.hashLocked = false;
    state.hashLockedAt = null;
    state.hashLockReason = null;
    state.lifecycle = "PENDING_BOARD_REVIEW";
    this.deps.boardStates.save(state);

    this.deps.audit.write({
      actorUserId: signatoryId,
      actorRole: UserRole.DeansOfficeStaff,
      actionType: "HASH_LOCK_CLEARED",
      affectedEntityId: packageId,
      affectedEntityType: "BoardReviewState",
      previousValue: { hashLocked: true },
      newValue: { hashLocked: false, newHash: currentHash },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //   TC-7C  —  Digital Signature Flow
  // ─────────────────────────────────────────────────────────────────────────

  issueDeanSignatureToken(signatoryId: string): SignatureIssueResult {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
    const initials = signatoryId
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 3)
      .padEnd(3, "X");
    const seq = randomUUID().slice(0, 4).toUpperCase();
    const token = `SIG-${initials}-${datePart}-${seq}`;
    this.tokenRegistry.set(token, { signatoryId, issuedAt: now });

    return {
      token,
      validForHours: 24,
      signatoryId,
      issuedAt: now.toISOString(),
    };
  }

  async verifyDeanSignature(input: SignatureVerifyInput): Promise<SignatureVerifyResult> {
    const pkg = this.deps.packages.findById(input.packageId);
    if (!pkg) {
      return this.signatureFailure(
        input.packageId,
        input.token,
        "7C-INVALID",
        "Paket bulunamadı.",
      );
    }

    const entry = this.tokenRegistry.get(input.token);
    if (!entry) {
      return this.signatureFailure(
        input.packageId,
        input.token,
        "7C-INVALID",
        "Token tanınmadı.",
      );
    }
    if (entry.signatoryId !== input.signatoryId) {
      return this.signatureFailure(
        input.packageId,
        input.token,
        "7C-INVALID",
        `Token ${entry.signatoryId} kullanıcısına verildi — ${input.signatoryId} tarafından gönderildi.`,
      );
    }
    const ageMs = Date.now() - entry.issuedAt.getTime();
    if (ageMs > TOKEN_TTL_MS) {
      return this.signatureFailure(
        input.packageId,
        input.token,
        "7C-EXPIRED",
        `Token ${Math.floor(ageMs / 3600000)} saat önce süresi doldu — yeniden alınması gerekir.`,
      );
    }

    // ── Valid: write the signature and the document hash snapshot ──────────
    const state = this.requireBoardState(input.packageId);
    if (state.hashLocked) {
      throw new ConflictError(
        "HASH_LOCKED",
        "702-HASH ile kilitli bir pakete imza uygulanamaz.",
      );
    }

    // TC-7B — Dean cannot forward an incomplete package.  Token stays valid
    // so the Dean can retry after YGK fixes the intibak table.
    await this.assertIntibakComplete(input.packageId, "DEAN_SIGNATURE");

    const documentHash = computePackageHash(this.canonicalInput(pkg));
    state.deanSignature = this.buildSignature(
      input.token,
      input.signatoryId,
      documentHash,
    );
    state.lifecycle = "FORWARDED_TO_BOARD";
    this.deps.boardStates.save(state);

    this.tokenRegistry.delete(input.token); // single-use

    this.deps.audit.write({
      actorUserId: input.signatoryId,
      actorRole: UserRole.DeansOfficeStaff,
      actionType: "DEAN_SIGNATURE_VERIFIED",
      affectedEntityId: input.packageId,
      affectedEntityType: "BoardReviewState",
      previousValue: { lifecycle: "PENDING_BOARD_REVIEW" },
      newValue: { lifecycle: "FORWARDED_TO_BOARD", documentHash },
    });

    return {
      packageId: input.packageId,
      token: input.token,
      state: "valid",
      errorCode: null,
      message: "İmza doğrulandı. Paket Fakülte Kurulu incelemesine açıldı.",
      clearedAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //   TC-7A & TC-7E  —  Board Decision
  // ─────────────────────────────────────────────────────────────────────────

  async boardDecide(input: BoardDecisionInput): Promise<BoardDecisionResult> {
    const pkg = this.requirePackage(input.packageId);
    const state = this.requireBoardState(input.packageId);

    // ── Guard: hash integrity must hold ───────────────────────────────────
    const hashCheck = this.checkHashIntegrity(input.packageId);
    if (!hashCheck.isMatch) {
      throw new ConflictError(
        "702-HASH",
        "Karar 702-HASH bütünlük ihlali nedeniyle engellendi. Veriyi düzelttikten sonra yeniden imzalayın.",
      );
    }

    // ── Guard: valid signature must be present ─────────────────────────────
    if (!state.deanSignature || state.deanSignature.state !== "valid") {
      throw new ConflictError(
        "SIGNATURE_REQUIRED",
        "Dekan imzası eksik veya geçersiz (Hata 7C). Karar verilemez.",
      );
    }

    // ── Guard: only from FORWARDED_TO_BOARD or PENDING_BOARD_REVIEW ────────
    if (
      state.lifecycle !== "FORWARDED_TO_BOARD" &&
      state.lifecycle !== "PENDING_BOARD_REVIEW"
    ) {
      throw new ConflictError(
        "INVALID_LIFECYCLE",
        `'${state.lifecycle}' durumundaki bir paket için karar verilemez.`,
      );
    }

    // TC-7D — Final Safety Gate: re-check intibak completeness right before
    // the approval is committed.  Tampering with an intibak row between Dean
    // signature and Board approval is caught here.
    if (input.approved) {
      await this.assertIntibakComplete(input.packageId, "BOARD_APPROVAL");
    }

    return input.approved
      ? this.approvePath(pkg, state, input)
      : this.rejectPath(pkg, state, input);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //   TC-7A Step 4  —  Confirm for Publication  (ÖİDB handoff)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Faculty Board flips an APPROVED_BY_BOARD package into READY_FOR_PUBLICATION,
   * staging it for the ÖİDB officer to publish.  Application statuses move to
   * ReadyForPublication so the student dashboards reflect the imminent
   * announcement.  See TC-7A Step 4.
   */
  async confirmForPublication(input: ConfirmForPublicationInput): Promise<ConfirmForPublicationResult> {
    const pkg = this.requirePackage(input.packageId);
    const state = this.requireBoardState(input.packageId);

    if (state.lifecycle !== "APPROVED_BY_BOARD") {
      throw new ConflictError(
        "INVALID_LIFECYCLE",
        `Yayın onayı için paketin 'APPROVED_BY_BOARD' durumunda olması gerekir. Mevcut durum: '${state.lifecycle}'.`,
      );
    }

    const now = new Date().toISOString();
    state.lifecycle = "READY_FOR_PUBLICATION";
    this.deps.boardStates.save(state);

    for (const appId of [...pkg.asilApplicationIds, ...pkg.yedekApplicationIds]) {
      const app = await this.deps.applications.findById(appId);
      if (!app) continue;
      app.currentStatus = ApplicationStatus.ReadyForPublication;
      app.lastModifiedAt = now;
      await this.deps.applications.save(app);
    }

    this.deps.audit.write({
      actorUserId: input.confirmedBy,
      actorRole: UserRole.FacultyBoardMember,
      actionType: "CONFIRM_FOR_PUBLICATION",
      affectedEntityId: pkg.packageId,
      affectedEntityType: "EvaluationPackage",
      previousValue: { lifecycle: "APPROVED_BY_BOARD" },
      newValue: { lifecycle: "READY_FOR_PUBLICATION", forwardedToOidbAt: now },
    });

    return {
      packageId: pkg.packageId,
      newLifecycle: "READY_FOR_PUBLICATION",
      confirmedAt: now,
      message: "Sonuçlar nihai yayın için ÖİDB'ye iletildi.",
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //   TC-7B  —  Return to YGK with clarification note
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Dean's office returns the package to YGK when an intibak table is missing
   * (TC-7B Step 3).  Resets the package to Draft so YGK can re-send after the
   * fix, stores the clarification note on the board state for UI display, and
   * decouples the YGK Chair notification (same pattern as 571-NOTIFY).
   */
  returnToYgkForClarification(input: ReturnForClarificationInput): ReturnForClarificationResult {
    const pkg = this.requirePackage(input.packageId);
    const state = this.requireBoardState(input.packageId);

    if (!input.note?.trim()) {
      throw new ValidationError(
        "Değerlendirme Komisyonuna iade ederken açıklama notu zorunludur.",
      );
    }
    if (state.lifecycle !== "PENDING_BOARD_REVIEW") {
      throw new ConflictError(
        "INVALID_LIFECYCLE",
        `YGK'ya iade işlemi yalnızca Dekan imzasından önce (PENDING_BOARD_REVIEW durumunda) yapılabilir. Mevcut durum: '${state.lifecycle}'.`,
      );
    }

    const note = input.note.trim();
    const returnedAt = new Date().toISOString();

    state.lifecycle = "WAITING_FOR_CLARIFICATION_YGK";
    state.clarificationNote = note;
    this.deps.boardStates.save(state);

    // Allow YGK to re-send after fixing.
    pkg.status = PackageStatus.Draft;
    this.deps.packages.save(pkg);

    const ygkNotif = this.dispatchDecoupled(state, {
      recipientUserId: "YGK_CHAIR",
      eventType: "PACKAGE_RETURNED_FOR_CLARIFICATION",
      channel: "EMAIL",
      subject: `Paket açıklama için iade edildi — ${pkg.packageId}`,
      body: note,
    });

    this.deps.audit.write({
      actorUserId: input.requestedBy,
      actorRole: UserRole.DeansOfficeStaff,
      actionType: "RETURN_TO_YGK_FOR_CLARIFICATION",
      affectedEntityId: pkg.packageId,
      affectedEntityType: "BoardReviewState",
      previousValue: { lifecycle: "PENDING_BOARD_REVIEW" },
      newValue: { lifecycle: "WAITING_FOR_CLARIFICATION_YGK", note },
    });

    return {
      packageId: pkg.packageId,
      newLifecycle: "WAITING_FOR_CLARIFICATION_YGK",
      note,
      returnedAt,
      notifications: [ygkNotif],
    };
  }

  // TC-7A — approval path
  private async approvePath(
    pkg: EvaluationPackage,
    state: BoardReviewState,
    input: BoardDecisionInput,
  ): Promise<BoardDecisionResult> {
    const now = new Date().toISOString();

    // Record the board decision.
    state.boardDecision = {
      decidedBy: input.decidedBy,
      decidedAt: now,
      approved: true,
      resolutionText: input.resolutionText,
      rejectionReason: null,
      loopbackTarget: null,
    };
    state.lifecycle = "APPROVED_BY_BOARD";
    this.deps.boardStates.save(state);

    // Propagate to EvaluationPackage status.
    pkg.status = PackageStatus.ApprovedFacultyBoard;
    this.deps.packages.save(pkg);

    // Propagate to each underlying application.
    const propagation: StatePropagationEvent[] = [
      {
        target: "BoardDashboard",
        previousValue: "PENDING_BOARD_REVIEW",
        newValue: "APPROVED_BY_BOARD",
        propagatedAt: now,
      },
    ];

    for (const appId of [...pkg.asilApplicationIds, ...pkg.yedekApplicationIds]) {
      const app = await this.deps.applications.findById(appId);
      if (!app) continue;
      const previous = app.currentStatus;
      app.currentStatus = ApplicationStatus.ApprovedFacultyBoard;
      app.lastModifiedAt = now;
      await this.deps.applications.save(app);
      propagation.push({
        target: `FinalResult:${appId}`,
        previousValue: previous,
        newValue: app.currentStatus,
        propagatedAt: now,
      });
    }

    this.deps.audit.write({
      actorUserId: input.decidedBy,
      actorRole: UserRole.FacultyBoardMember,
      actionType: "BOARD_APPROVE",
      affectedEntityId: pkg.packageId,
      affectedEntityType: "EvaluationPackage",
      previousValue: { lifecycle: "FORWARDED_TO_BOARD" },
      newValue: { lifecycle: "APPROVED_BY_BOARD", resolution: input.resolutionText },
    });

    return {
      packageId: pkg.packageId,
      approved: true,
      newLifecycle: "APPROVED_BY_BOARD",
      statePropagation: propagation,
      notifications: [],
      rejectionDispatch: null,
    };
  }

  // TC-7E — rejection path
  private async rejectPath(
    pkg: EvaluationPackage,
    state: BoardReviewState,
    input: BoardDecisionInput,
  ): Promise<BoardDecisionResult> {
    if (!input.rejectionReason?.trim()) {
      throw new ValidationError(
        "Reddedildiğinde (approved: false) red gerekçesi zorunludur.",
      );
    }

    const target: LoopbackTarget = input.loopbackTarget ?? "ygk";
    const now = new Date().toISOString();

    // Record the rejection.
    state.boardDecision = {
      decidedBy: input.decidedBy,
      decidedAt: now,
      approved: false,
      resolutionText: input.resolutionText,
      rejectionReason: input.rejectionReason,
      loopbackTarget: target,
    };
    state.lifecycle = "REJECTED_BY_BOARD";
    this.deps.boardStates.save(state);

    // Return the package to the YGK side.
    pkg.status = PackageStatus.Returned;
    this.deps.packages.save(pkg);

    // Loop applications back to the appropriate review status.
    const appBackStatus = loopbackToApplicationStatus(target);
    for (const appId of [
      ...pkg.asilApplicationIds,
      ...pkg.yedekApplicationIds,
      ...pkg.redApplicationIds,
    ]) {
      const app = await this.deps.applications.findById(appId);
      if (!app) continue;
      app.currentStatus = appBackStatus;
      app.lastModifiedAt = now;
      await this.deps.applications.save(app);
    }

    // Dean notification — decoupled (same pattern as 571-NOTIFY).
    const deanNotif = this.dispatchDecoupled(state, {
      recipientUserId: "DEAN_OFFICE",
      eventType: "BOARD_REJECTION",
      channel: "EMAIL",
      subject: `Fakülte Kurulu Reddi — ${pkg.packageId} ${target.toUpperCase()} birimine iade edildi`,
      body: input.rejectionReason,
    });

    const propagation: StatePropagationEvent[] = [
      {
        target: "BoardDashboard",
        previousValue: "FORWARDED_TO_BOARD",
        newValue: "REJECTED_BY_BOARD",
        propagatedAt: now,
      },
      {
        target: `${target.toUpperCase()}_Queue`,
        previousValue: "idle",
        newValue: "revision_required",
        propagatedAt: now,
      },
      {
        target: "DeanOffice_Notification",
        previousValue: "idle",
        newValue: "board_rejection_alert",
        propagatedAt: now,
      },
    ];

    this.deps.audit.write({
      actorUserId: input.decidedBy,
      actorRole: UserRole.FacultyBoardMember,
      actionType: "BOARD_REJECT",
      affectedEntityId: pkg.packageId,
      affectedEntityType: "EvaluationPackage",
      previousValue: { lifecycle: "FORWARDED_TO_BOARD" },
      newValue: {
        lifecycle: "REJECTED_BY_BOARD",
        loopbackTarget: target,
        rejectionReason: input.rejectionReason,
      },
    });

    return {
      packageId: pkg.packageId,
      approved: false,
      newLifecycle: "REJECTED_BY_BOARD",
      statePropagation: propagation,
      notifications: [deanNotif],
      rejectionDispatch: {
        loopbackTarget: target,
        deanNotified: true,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //   TC-571-NOTIFY  —  Publish with decoupled notifications
  // ─────────────────────────────────────────────────────────────────────────

  async publish(input: PublishInput): Promise<PublishResult> {
    const pkg = this.requirePackage(input.packageId);
    const state = this.requireBoardState(input.packageId);

    if (state.lifecycle !== "READY_FOR_PUBLICATION") {
      throw new ConflictError(
        "INVALID_LIFECYCLE",
        `Yayınlama için paketin 'READY_FOR_PUBLICATION' durumunda olması gerekir. Mevcut durum: '${state.lifecycle}'.`,
      );
    }

    // ── COMMIT FIRST — database write is the source of truth. ─────────────
    const publishedAt = new Date().toISOString();
    state.publishedAt = publishedAt;
    state.lifecycle = "PUBLISHED";
    this.deps.boardStates.save(state);

    for (const appId of [...pkg.asilApplicationIds, ...pkg.yedekApplicationIds]) {
      const app = await this.deps.applications.findById(appId);
      if (!app) continue;
      app.currentStatus = ApplicationStatus.ResultsPublished;
      app.lastModifiedAt = publishedAt;
      await this.deps.applications.save(app);
    }

    this.deps.audit.write({
      actorUserId: input.publishedBy,
      actorRole: UserRole.OidbOfficer,
      actionType: "PUBLISH",
      affectedEntityId: pkg.packageId,
      affectedEntityType: "EvaluationPackage",
      previousValue: { lifecycle: "READY_FOR_PUBLICATION" },
      newValue: { lifecycle: "PUBLISHED", publishedAt },
    });

    // ── NOW dispatch notifications — failure cannot roll back the publish ─
    const stubs: BoardNotificationStub[] = [];
    let anyFailed = false;

    for (const appId of pkg.asilApplicationIds) {
      const stub = this.dispatchDecoupled(state, {
        recipientUserId: appId,
        eventType: "RESULT_ADMITTED",
        channel: "EMAIL",
        subject: "Yatay Geçiş Kabulü",
        body: "Yatay geçiş başvurunuz Fakülte Kurulu tarafından onaylanmıştır.",
      });
      stubs.push(stub);
      if (stub.status === "failed") anyFailed = true;
    }
    for (const appId of pkg.yedekApplicationIds) {
      const stub = this.dispatchDecoupled(state, {
        recipientUserId: appId,
        eventType: "RESULT_WAITLISTED",
        channel: "EMAIL",
        subject: "Yedek Listesi Bildirimi",
        body: "Yatay geçiş için yedek listesindesiniz.",
      });
      stubs.push(stub);
      if (stub.status === "failed") anyFailed = true;
    }

    this.deps.boardStates.save(state); // persist notification stubs

    return {
      packageId: pkg.packageId,
      published: true,
      publishedAt,
      notifications: stubs,
      hasNotifyErrors: anyFailed,
      notifyErrorCode: anyFailed ? "571-NOTIFY" : null,
      message: anyFailed
        ? "Sonuçlar yayınlandı. Bazı bildirimler gönderilemedi (571-NOTIFY) — yayın etkilenmedi."
        : "Sonuçlar başarıyla yayınlandı. Tüm bildirimler iletildi.",
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //   Internal helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Dispatches a single notification via the shared NotificationService.
   * The notification call is wrapped in try/catch so that a failure NEVER
   * propagates out of the calling action (publish / reject).  This is the
   * core contract of 571-NOTIFY decoupling.
   */
  private dispatchDecoupled(
    state: BoardReviewState,
    params: {
      recipientUserId: string;
      eventType: string;
      channel: "EMAIL" | "DASHBOARD_ALERT";
      subject: string;
      body: string;
    },
  ): BoardNotificationStub {
    const now = new Date().toISOString();
    try {
      const record = this.deps.notifications.send(params);
      const stub: BoardNotificationStub = {
        notificationId: record.notificationId,
        recipientUserId: record.recipientUserId,
        subject: record.subject,
        channel: params.channel,
        status: record.isDelivered ? "delivered" : "failed",
        errorCode: record.isDelivered ? null : "571-NOTIFY",
        decoupled: true,
        createdAt: record.createdAt,
      };
      state.notifications.push(stub);
      return stub;
    } catch {
      // Notification service threw — still record a stub, never block caller.
      const stub: BoardNotificationStub = {
        notificationId: randomUUID(),
        recipientUserId: params.recipientUserId,
        subject: params.subject,
        channel: params.channel,
        status: "failed",
        errorCode: "571-NOTIFY",
        decoupled: true,
        createdAt: now,
      };
      state.notifications.push(stub);
      return stub;
    }
  }

  private buildSignature(
    token: string,
    signatoryId: string,
    documentHash: string,
  ): DeanSignature {
    const now = new Date();
    return {
      token,
      signedBy: signatoryId,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
      documentHashAtSignature: documentHash,
      state: "valid",
    };
  }

  private signatureFailure(
    packageId: string,
    token: string,
    errorCode: "7C-EXPIRED" | "7C-INVALID",
    message: string,
  ): SignatureVerifyResult {
    return {
      packageId,
      token,
      state: errorCode === "7C-EXPIRED" ? "expired" : "invalid",
      errorCode,
      message,
      clearedAt: null,
    };
  }

  private canonicalInput(pkg: EvaluationPackage) {
    return {
      packageId: pkg.packageId,
      departmentId: pkg.departmentId,
      periodId: pkg.periodId,
      asilApplicationIds: pkg.asilApplicationIds,
      yedekApplicationIds: pkg.yedekApplicationIds,
      redApplicationIds: pkg.redApplicationIds,
      intibakTableIds: pkg.intibakTableIds,
    };
  }

  private requirePackage(packageId: string): EvaluationPackage {
    const pkg = this.deps.packages.findById(packageId);
    if (!pkg) throw new NotFoundError(`Paket bulunamadı: ${packageId}`);
    return pkg;
  }

  private requireBoardState(packageId: string): BoardReviewState {
    const state = this.deps.boardStates.findById(packageId);
    if (!state) {
      throw new NotFoundError(
        `Paket için Kurul inceleme kaydı bulunamadı: ${packageId}. ` +
          `Paket Kurula iletildi mi?`,
      );
    }
    return state;
  }
}

// ─── Module-level helpers ────────────────────────────────────────────────────

function loopbackToApplicationStatus(target: LoopbackTarget): ApplicationStatus {
  switch (target) {
    case "oidb": return ApplicationStatus.PendingOidbVerification;
    case "ydyo": return ApplicationStatus.InReviewYdyo;
    case "dean": return ApplicationStatus.PendingDeansOfficeReview;
    case "ygk":
    default:     return ApplicationStatus.InReviewYgk;
  }
}
