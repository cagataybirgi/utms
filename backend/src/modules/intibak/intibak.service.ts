import { randomUUID } from "node:crypto";
import {
  Application,
  ApplicationStatus,
  DocumentType,
  EvaluationPackage,
  IntibakTable,
  MappingEntry,
  MappingStatus,
  PackageStatus,
  PreviousCourse,
  RankingCategory,
  TargetCourse,
  UserRole,
} from "../../shared/types";
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "../../shared/errors";
import {
  IAsyncApplicationRepository,
  ICurriculumRepository,
  IDocumentRepository,
  IIntibakRepository,
  IPackageRepository,
} from "../../shared/repositories";
import { OcrParserMockClient } from "../../shared/external/ocr-parser-client";
import { AuditLogger } from "../../shared/audit";
import { SuggestionEngine } from "./suggestion-engine";
import {
  BoardReviewState,
  IBoardReviewStateRepository,
} from "../board/board.types";

export interface IntibakServiceDeps {
  applications: IAsyncApplicationRepository;
  documents: IDocumentRepository;
  intibakTables: IIntibakRepository;
  curriculum: ICurriculumRepository;
  packages: IPackageRepository;
  boardStates: IBoardReviewStateRepository;
  ocr: OcrParserMockClient;
  audit: AuditLogger;
  suggestions?: SuggestionEngine;
}

export interface IntibakInterfaceDto {
  applicationId: string;
  previousCourses: PreviousCourse[];
  targetCurriculum: TargetCourse[];
  mappings: MappingEntry[];
  manualEntryRequired: boolean;
  noSuggestionsFound: boolean;
}

export interface ManualCourseInput {
  code: string;
  name: string;
  letterGrade: string;
  ects: number;
}

export interface MappingMutation {
  entryId?: string;
  sourceCourseCodes: string[];
  targetCourseCode: string | null;
  status: MappingStatus;
}

export interface DepartmentOverviewDto {
  departmentId: string;
  periodId: string;
  asil: string[];
  yedek: string[];
  red: string[];
  pendingIntibak: string[];
  ready: boolean;
}

export interface IntibakCandidateDto {
  applicationId: string;
  studentFullName: string;
  studentTckn: string;
  rankingCategory: RankingCategory | null;
  currentStatus: ApplicationStatus;
  intibakStarted: boolean;
  intibakCompleted: boolean;
}

export interface IntibakCandidatesDto {
  departmentId: string;
  periodId: string;
  candidates: IntibakCandidateDto[];
  asilTotal: number;
  asilCompleted: number;
  ready: boolean;
}

export interface SendPackageInput {
  signaturePassword: string;
  departmentId: string;
  periodId: string;
}

const VALID_SIGNATURE_PASSWORD = "ygk-chair-signature";

export class IntibakService {
  private readonly suggestions: SuggestionEngine;

  constructor(private readonly deps: IntibakServiceDeps) {
    this.suggestions = deps.suggestions ?? new SuggestionEngine();
  }

  async prepare(applicationId: string, actorUserId: string): Promise<IntibakInterfaceDto> {
    const application = await this.requireApp(applicationId);
    if (application.rankingCategory !== RankingCategory.Asil) {
      throw new ConflictError(
        "NOT_ASIL",
        `Intibak preparation is only allowed for Asil applicants (current: ${application.rankingCategory ?? "none"}).`,
      );
    }

    const curriculum = this.deps.curriculum.findByDepartmentId(application.targetDepartmentId);
    if (!curriculum || !curriculum.isDefined) {
      throw new ConflictError(
        "CURRICULUM_NOT_DEFINED",
        `Curriculum for department ${application.targetDepartmentId} is not defined. Please contact Student Affairs before continuing.`,
      );
    }

    const docs = this.deps.documents.findByApplicationId(applicationId);
    const transcript = docs.find((d) => d.documentType === DocumentType.Transcript);
    if (!transcript) {
      throw new NotFoundError("Transcript not uploaded for this application.");
    }

    const parsed = this.deps.ocr.parse(transcript.documentId);

    let existing = this.deps.intibakTables.findByApplicationId(applicationId);
    if (existing) {
      return this.toDto(existing, curriculum.courses);
    }

    const previousCourses = parsed.ok ? parsed.courses : [];
    const manualEntryRequired = !parsed.ok;
    const suggestions = manualEntryRequired
      ? []
      : this.suggestions.generate(previousCourses, curriculum.courses);
    const mappings = this.buildMappingsFromSuggestions(previousCourses, suggestions);

    const table: IntibakTable = {
      intibakTableId: randomUUID(),
      applicationId,
      previousCourses,
      targetCurriculum: curriculum.courses,
      mappings,
      manualEntryUsed: manualEntryRequired,
      noSuggestionsFound: !manualEntryRequired && suggestions.length === 0,
      isLocked: false,
      createdBy: actorUserId,
      createdAt: new Date().toISOString(),
    };
    this.deps.intibakTables.save(table);
    application.intibakTableId = table.intibakTableId;
    await this.deps.applications.save(application);

    this.deps.audit.write({
      actorUserId,
      actorRole: UserRole.YgkMember,
      actionType: "INTIBAK_PREPARE",
      affectedEntityId: applicationId,
      affectedEntityType: "Application",
      previousValue: null,
      newValue: { intibakTableId: table.intibakTableId, manualEntryRequired },
    });

    return this.toDto(table, curriculum.courses);
  }

  addManualCourse(applicationId: string, course: ManualCourseInput): IntibakInterfaceDto {
    const table = this.requireTable(applicationId);
    if (table.isLocked) {
      throw new ConflictError("INTIBAK_LOCKED", "Cannot edit a saved intibak table.");
    }
    table.previousCourses.push({ ...course });
    if (table.noSuggestionsFound === false && table.manualEntryUsed === false) {
      throw new ConflictError(
        "MANUAL_ENTRY_NOT_ENABLED",
        "Manual course entry is only available when transcript could not be parsed.",
      );
    }
    this.deps.intibakTables.save(table);
    return this.toDto(table, table.targetCurriculum);
  }

  generateSuggestionsForManual(applicationId: string): IntibakInterfaceDto {
    const table = this.requireTable(applicationId);
    if (!table.manualEntryUsed) {
      throw new ConflictError(
        "MANUAL_ENTRY_NOT_ENABLED",
        "Suggestions can only be regenerated for manual-entry tables.",
      );
    }
    const suggestions = this.suggestions.generate(table.previousCourses, table.targetCurriculum);
    table.mappings = this.buildMappingsFromSuggestions(table.previousCourses, suggestions);
    this.deps.intibakTables.save(table);
    return this.toDto(table, table.targetCurriculum);
  }

  updateMappings(
    applicationId: string,
    actorUserId: string,
    mutations: MappingMutation[],
  ): IntibakInterfaceDto {
    const table = this.requireTable(applicationId);
    if (table.isLocked) {
      throw new ConflictError("INTIBAK_LOCKED", "Cannot edit a saved intibak table.");
    }
    for (const m of mutations) {
      if (!m.sourceCourseCodes || m.sourceCourseCodes.length === 0) {
        if (m.status !== MappingStatus.NoPreviousEquivalent) {
          throw new ValidationError(
            "Each mapping mutation must reference at least one source course unless its status is NO_PREVIOUS_EQUIVALENT.",
          );
        }
      }
      this.applyMutation(table, m);
    }
    this.deps.intibakTables.save(table);
    this.deps.audit.write({
      actorUserId,
      actorRole: UserRole.YgkMember,
      actionType: "INTIBAK_UPDATE_MAPPINGS",
      affectedEntityId: applicationId,
      affectedEntityType: "Application",
      previousValue: null,
      newValue: { mutationCount: mutations.length },
    });
    return this.toDto(table, table.targetCurriculum);
  }

  async save(applicationId: string, actorUserId: string): Promise<{ table: IntibakTable; message: string }> {
    const table = this.requireTable(applicationId);
    if (table.isLocked) {
      throw new ConflictError("INTIBAK_LOCKED", "Intibak table is already saved and locked.");
    }
    const incompleteTargets = this.findUndecidedTargets(table);
    if (incompleteTargets.length > 0) {
      throw new ValidationError(
        "You must make a decision for every target course before saving.",
        { incompleteTargets },
      );
    }
    table.isLocked = true;
    table.savedAt = new Date().toISOString();
    this.deps.intibakTables.save(table);
    const application = await this.requireApp(applicationId);
    application.currentStatus = ApplicationStatus.IntibakCompleted;
    await this.deps.applications.save(application);

    this.deps.audit.write({
      actorUserId,
      actorRole: UserRole.YgkMember,
      actionType: "INTIBAK_SAVE",
      affectedEntityId: applicationId,
      affectedEntityType: "Application",
      previousValue: ApplicationStatus.RankedAsil,
      newValue: ApplicationStatus.IntibakCompleted,
    });
    return { table, message: "Intibak table saved." };
  }

  markNotExempt(applicationId: string, sourceCourseCodes: string[], actorUserId: string): IntibakInterfaceDto {
    return this.updateMappings(applicationId, actorUserId, [
      {
        sourceCourseCodes,
        targetCourseCode: null,
        status: MappingStatus.NotExempt,
      },
    ]);
  }

  async departmentOverview(departmentId: string, periodId: string): Promise<DepartmentOverviewDto> {
    const apps = await this.deps.applications.findByDepartmentAndPeriod(departmentId, periodId);
    const asil: string[] = [];
    const yedek: string[] = [];
    const red: string[] = [];
    const pendingIntibak: string[] = [];
    for (const a of apps) {
      switch (a.rankingCategory) {
        case RankingCategory.Asil:
          asil.push(a.applicationId);
          if (a.currentStatus !== ApplicationStatus.IntibakCompleted) {
            pendingIntibak.push(a.applicationId);
          }
          break;
        case RankingCategory.Yedek:
          yedek.push(a.applicationId);
          break;
        case RankingCategory.Red:
          red.push(a.applicationId);
          break;
        default:
          break;
      }
    }
    return {
      departmentId,
      periodId,
      asil,
      yedek,
      red,
      pendingIntibak,
      ready: pendingIntibak.length === 0 && asil.length > 0,
    };
  }

  async listCandidates(departmentId: string, periodId: string): Promise<IntibakCandidatesDto> {
    const apps = await this.deps.applications.findByDepartmentAndPeriod(departmentId, periodId);
    const ranked = apps.filter((a) => a.rankingCategory);
    const candidates: IntibakCandidateDto[] = ranked
      .map((a) => ({
        applicationId: a.applicationId,
        studentFullName: a.studentFullName,
        studentTckn: a.studentTckn,
        rankingCategory: a.rankingCategory ?? null,
        currentStatus: a.currentStatus,
        intibakStarted: !!this.deps.intibakTables.findByApplicationId(a.applicationId),
        intibakCompleted: a.currentStatus === ApplicationStatus.IntibakCompleted,
      }))
      .sort((x, y) => x.studentFullName.localeCompare(y.studentFullName));

    const asil = candidates.filter((c) => c.rankingCategory === RankingCategory.Asil);
    const asilCompleted = asil.filter((c) => c.intibakCompleted).length;
    return {
      departmentId,
      periodId,
      candidates,
      asilTotal: asil.length,
      asilCompleted,
      ready: asil.length > 0 && asilCompleted === asil.length,
    };
  }

  async sendPackage(actorUserId: string, input: SendPackageInput): Promise<EvaluationPackage> {
    if (input.signaturePassword !== VALID_SIGNATURE_PASSWORD) {
      throw new ValidationError("Invalid digital signature password.");
    }
    const overview = await this.departmentOverview(input.departmentId, input.periodId);
    if (!overview.ready) {
      throw new ConflictError(
        "PACKAGE_INCOMPLETE",
        `Package cannot be sent until all applications are finalised. Pending: ${overview.pendingIntibak.join(
          ", ",
        )}`,
      );
    }
    const existing = this.deps.packages.findByDepartmentAndPeriod(input.departmentId, input.periodId);
    if (existing && existing.status !== PackageStatus.Draft) {
      throw new ConflictError("PACKAGE_ALREADY_SENT", "Package has already been forwarded.");
    }

    const intibakTableIds: string[] = [];
    for (const appId of overview.asil) {
      const t = this.deps.intibakTables.findByApplicationId(appId);
      if (t && t.isLocked) intibakTableIds.push(t.intibakTableId);
    }

    const pkg: EvaluationPackage = {
      packageId: existing?.packageId ?? randomUUID(),
      departmentId: input.departmentId,
      periodId: input.periodId,
      status: PackageStatus.Sent,
      asilApplicationIds: overview.asil,
      yedekApplicationIds: overview.yedek,
      redApplicationIds: overview.red,
      intibakTableIds,
      digitalSignatureBy: actorUserId,
      digitalSignatureAt: new Date().toISOString(),
      sentBy: actorUserId,
      sentAt: new Date().toISOString(),
    };
    this.deps.packages.save(pkg);

    for (const appId of [...overview.asil, ...overview.yedek, ...overview.red]) {
      const a = await this.deps.applications.findById(appId);
      if (!a) continue;
      a.currentStatus = ApplicationStatus.PendingDeansOfficeReview;
      await this.deps.applications.save(a);
    }

    // Open the Faculty Board's review surface for this package. From this
    // point the Dean's office can issue/verify signatures (TC-7C) and the
    // Board can run the integrity / approval / publish flow (702-HASH, 7A/E,
    // 571-NOTIFY). See BoardService for those state machines.
    const now = new Date().toISOString();
    const boardState: BoardReviewState = {
      packageId: pkg.packageId,
      lifecycle: "PENDING_BOARD_REVIEW",
      deanSignature: null,
      boardDecision: null,
      hashLocked: false,
      hashLockedAt: null,
      hashLockReason: null,
      clarificationNote: null,
      publishedAt: null,
      notifications: [],
      createdAt: now,
      lastModifiedAt: now,
    };
    this.deps.boardStates.put(boardState);

    this.deps.audit.write({
      actorUserId,
      actorRole: UserRole.YgkChair,
      actionType: "PACKAGE_SEND",
      affectedEntityId: pkg.packageId,
      affectedEntityType: "EvaluationPackage",
      previousValue: null,
      newValue: { departmentId: input.departmentId, periodId: input.periodId },
    });
    return pkg;
  }

  private async requireApp(applicationId: string): Promise<Application> {
    const a = await this.deps.applications.findById(applicationId);
    if (!a) throw new NotFoundError(`Application not found: ${applicationId}`);
    return a;
  }

  private requireTable(applicationId: string): IntibakTable {
    const t = this.deps.intibakTables.findByApplicationId(applicationId);
    if (!t) throw new NotFoundError("Intibak table not prepared yet.");
    return t;
  }

  private toDto(table: IntibakTable, curriculum: TargetCourse[]): IntibakInterfaceDto {
    return {
      applicationId: table.applicationId,
      previousCourses: table.previousCourses,
      targetCurriculum: curriculum,
      mappings: table.mappings,
      manualEntryRequired: table.manualEntryUsed,
      noSuggestionsFound: table.noSuggestionsFound,
    };
  }

  private buildMappingsFromSuggestions(
    previous: PreviousCourse[],
    suggestions: { source: PreviousCourse; candidate: TargetCourse; similarityScore: number }[],
  ): MappingEntry[] {
    const byCode = new Map<string, MappingEntry>();
    for (const s of suggestions) {
      byCode.set(s.source.code, {
        entryId: randomUUID(),
        sourceCourseCodes: [s.source.code],
        targetCourseCode: s.candidate.code,
        status: MappingStatus.SuggestedMatch,
        similarityScore: s.similarityScore,
      });
    }
    const out: MappingEntry[] = [];
    for (const p of previous) {
      const existing = byCode.get(p.code);
      if (existing) {
        out.push(existing);
      } else {
        out.push({
          entryId: randomUUID(),
          sourceCourseCodes: [p.code],
          targetCourseCode: null,
          status: MappingStatus.PendingReview,
        });
      }
    }
    return out;
  }

  private applyMutation(table: IntibakTable, m: MappingMutation): void {
    const targetIndex = table.mappings.findIndex(
      (existing) =>
        (m.entryId && existing.entryId === m.entryId) ||
        existing.sourceCourseCodes.join(",") === m.sourceCourseCodes.join(","),
    );
    if (m.status === MappingStatus.NoPreviousEquivalent) {
      const existingTargetForCode = table.mappings.findIndex(
        (e) => e.targetCourseCode === m.targetCourseCode && e.status === MappingStatus.NoPreviousEquivalent,
      );
      if (existingTargetForCode === -1) {
        table.mappings.push({
          entryId: randomUUID(),
          sourceCourseCodes: [],
          targetCourseCode: m.targetCourseCode,
          status: MappingStatus.NoPreviousEquivalent,
        });
      }
      return;
    }
    if (targetIndex >= 0) {
      const removed = table.mappings.splice(targetIndex, 1)[0];
      table.mappings.push({
        entryId: removed.entryId,
        sourceCourseCodes: m.sourceCourseCodes,
        targetCourseCode: m.targetCourseCode,
        status: m.status,
      });
    } else {
      table.mappings.push({
        entryId: randomUUID(),
        sourceCourseCodes: m.sourceCourseCodes,
        targetCourseCode: m.targetCourseCode,
        status: m.status,
      });
    }
  }

  private findUndecidedTargets(table: IntibakTable): string[] {
    const decidedTargets = new Set<string>();
    const decidedStatuses: MappingStatus[] = [
      MappingStatus.Approved,
      MappingStatus.SuggestedMatch,
      MappingStatus.ManualOverride,
      MappingStatus.NoPreviousEquivalent,
    ];
    for (const m of table.mappings) {
      if (decidedStatuses.includes(m.status) && m.targetCourseCode) {
        decidedTargets.add(m.targetCourseCode);
      }
    }
    const undecidedTargets: string[] = [];
    for (const t of table.targetCurriculum) {
      if (!decidedTargets.has(t.code)) undecidedTargets.push(t.code);
    }
    const sourceUndecided = table.mappings.some((m) => m.status === MappingStatus.PendingReview);
    if (sourceUndecided) {
      return ["UNDECIDED_SOURCE_ROW"];
    }
    return undecidedTargets;
  }
}
