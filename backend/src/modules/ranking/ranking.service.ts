import {
  Application,
  ApplicationStatus,
  RankingCategory,
  UserRole,
} from "../../shared/types";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors";
import { AuditLogger } from "../../shared/audit";
import { IAsyncApplicationRepository } from "../../shared/repositories";

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_GPA = 2.5;
const VALID_SEMESTERS = [3, 5];
const MIN_YKS_YEAR = 2022;
const YEDEK_PERCENTAGE = 0.2; // 20% of quota for reserve candidates

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export interface RankingExecutionInput {
  departmentId: string;
  periodId: string;
  quota: number;
  actorUserId: string;
}

export interface RankingResultDto {
  rank: number;
  applicationId: string;
  studentTckn: string;
  studentFullName: string;
  gpa: number;
  yksScore: number | null;
  transferScore: number;
  category: RankingCategory;
}

export interface TieGroup {
  boundaryRank: number;
  applicationIds: string[];
}

export interface RankingSummaryDto {
  departmentId: string;
  periodId: string;
  quota: number;
  totalEvaluated: number;
  eligible: number;
  ineligible: number;
  asilCount: number;
  yedekCount: number;
  redCount: number;
  rankings: RankingResultDto[];
  hasTies: boolean;
  ties: TieGroup[];
}

export interface DepartmentRankingOverviewDto {
  departmentId: string;
  periodId: string;
  quota: number;
  totalApplications: number;
  pendingRanking: number;
  ranked: number;
  asilList: string[];
  yedekList: string[];
  redList: string[];
}

// ─── Service Dependencies ─────────────────────────────────────────────────────

export interface RankingServiceDeps {
  applications: IAsyncApplicationRepository;
  audit: AuditLogger;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class RankingService {
  constructor(private readonly deps: RankingServiceDeps) {}

  /**
   * Calculate transfer score using the official formula:
   * Score = (YKS / 500 * 0.90) + (GPA * 0.10)
   */
  calculateTransferScore(gpa: number, yksScore: number): number {
    const yksComponent = (yksScore / 500) * 0.9;
    const gpaComponent = gpa * 0.1;
    return yksComponent + gpaComponent;
  }

  /**
   * Evaluate if an application meets academic eligibility criteria
   */
  evaluateEligibility(application: any): EligibilityResult {
    // Check GPA requirement
    if (application.submittedGpa < MIN_GPA) {
      return {
        eligible: false,
        reason: `Minimum GPA requirement not met (${application.submittedGpa.toFixed(2)} < ${MIN_GPA})`,
      };
    }

    // Check semester requirement
    if (
      application.finishedSemester &&
      !VALID_SEMESTERS.includes(application.finishedSemester)
    ) {
      return {
        eligible: false,
        reason: `Invalid semester for transfer (${application.finishedSemester}). Only 3rd or 5th semester students eligible.`,
      };
    }

    // Check YKS score existence and validity
    if (!application.submittedYksScore) {
      return {
        eligible: false,
        reason: "YKS score is required for ranking",
      };
    }

    if (application.yksExamYear && application.yksExamYear < MIN_YKS_YEAR) {
      return {
        eligible: false,
        reason: `YKS exam year too old (${application.yksExamYear}). Scores from ${MIN_YKS_YEAR} onwards accepted.`,
      };
    }

    return { eligible: true };
  }

  /**
   * Get YGK queue - applications ready for review
   * Returns applications with status INTAKE_VERIFIED or IN_REVIEW_YGK
   */
  async getYgkQueue() {
    const applications = (await this.deps.applications.findAll())
      .filter(
        (app: Application) =>
          app.currentStatus === ApplicationStatus.IntakeVerified ||
          app.currentStatus === ApplicationStatus.InReviewYgk
      )
      .sort((a: Application, b: Application) => {
        // Sort by submittedAt ascending (oldest first)
        return (
          new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
        );
      });

    return applications.map((app: Application) => ({
      applicationId: app.applicationId,
      studentFullName: app.studentFullName,
      studentTckn: app.studentTckn,
      targetDepartmentId: app.targetDepartmentId,
      targetSemester: app.targetSemester,
      submittedGpa: app.submittedGpa,
      submittedYksScore: app.submittedYksScore,
      currentStatus: app.currentStatus,
      submittedAt: app.submittedAt,
      ydyoExempt: app.ydyoExempt,
      preScreening: app.preScreening,
    }));
  }

  /**
   * Start individual review of an application
   * Transitions from INTAKE_VERIFIED to IN_REVIEW_YGK
   * Idempotent: if already IN_REVIEW_YGK, returns silently
   */
  async startApplicationReview(
    applicationId: string,
    actorUserId: string
  ): Promise<void> {
    const app = await this.deps.applications.findById(applicationId);

    if (!app) {
      throw new NotFoundError(`Application ${applicationId} not found`);
    }

    // Idempotent: already in review, nothing to do
    if (app.currentStatus === ApplicationStatus.InReviewYgk) {
      return;
    }

    if (app.currentStatus !== ApplicationStatus.IntakeVerified) {
      throw new ValidationError(
        `Application must be in INTAKE_VERIFIED status. Current: ${app.currentStatus}`
      );
    }

    app.currentStatus = ApplicationStatus.InReviewYgk;
    await this.deps.applications.save(app);

    this.deps.audit.write({
      actorUserId,
      actorRole: UserRole.YgkMember,
      actionType: "YGK_REVIEW_STARTED",
      affectedEntityId: applicationId,
      affectedEntityType: "Application",
      previousValue: JSON.stringify({ status: ApplicationStatus.IntakeVerified }),
      newValue: JSON.stringify({ status: ApplicationStatus.InReviewYgk }),
    });
  }

  /**
   * Get academic eligibility data for an application
   */
  async getEligibilityData(applicationId: string) {
    const app = await this.deps.applications.findById(applicationId);

    if (!app) {
      throw new NotFoundError(`Application ${applicationId} not found`);
    }

    if (app.currentStatus !== ApplicationStatus.InReviewYgk) {
      throw new ValidationError(
        `Application must be in IN_REVIEW_YGK status. Current: ${app.currentStatus}`
      );
    }

    const eligibility = this.evaluateEligibility(app);
    const warnings: string[] = [];

    if (!eligibility.eligible && eligibility.reason) {
      warnings.push(eligibility.reason);
    }

    // Build per-field warning map for inline display
    const fieldWarnings: Record<string, string> = {};
    if (!eligibility.eligible && eligibility.reason) {
      const reason = eligibility.reason;
      if (reason.includes("semester") || reason.includes("Semester")) {
        fieldWarnings.semester = "Dönem gereksinimi karşılanmıyor. Sadece 3. veya 5. dönem öğrencileri uygun.";
      }
      if (reason.includes("GPA") || reason.includes("gpa")) {
        fieldWarnings.gpa = `Minimum GPA gereksinimi karşılanmıyor (${app.submittedGpa.toFixed(2)} < 2.50).`;
      }
      if (reason.includes("YKS") || reason.includes("yks")) {
        fieldWarnings.yks = "YKS puanı gerekli veya geçersiz.";
      }
    }

    return {
      applicationId: app.applicationId,
      studentFullName: app.studentFullName,
      studentTckn: app.studentTckn,
      currentInstitution: app.currentInstitution,
      currentDepartment: app.currentDepartment,
      targetDepartmentId: app.targetDepartmentId,
      gpa: app.submittedGpa,
      yksScore: app.submittedYksScore,
      activeSemester: app.finishedSemester,
      targetSemester: app.targetSemester,
      preScreening: app.preScreening,
      ydyoDecision: app.ydyoDecision ?? (app.ydyoExempt ? "EXEMPT" : "PENDING"),
      language: app.language,
      eligible: eligibility.eligible,
      warnings,
      fieldWarnings,
    };
  }

  /**
   * Save eligibility decision for an application
   */
  async saveEligibilityDecision(
    applicationId: string,
    decision: {
      eligible: boolean;
      note?: string;
      actorUserId: string;
    }
  ): Promise<void> {
    const app = await this.deps.applications.findById(applicationId);

    if (!app) {
      throw new NotFoundError(`Application ${applicationId} not found`);
    }

    if (app.currentStatus !== ApplicationStatus.InReviewYgk) {
      throw new ValidationError(
        `Application must be in IN_REVIEW_YGK status. Current: ${app.currentStatus}`
      );
    }

    if (!decision.eligible) {
      // If not eligible, require a note
      if (!decision.note || decision.note.trim().length === 0) {
        throw new ValidationError(
          "A note is required when marking an application as not eligible"
        );
      }

      // Mark as ineligible and close the application
      app.currentStatus = ApplicationStatus.RankedRed;
      app.rankingCategory = RankingCategory.Red;
      app.rejectionReason = decision.note;
      app.transferScore = 0;
      await this.deps.applications.save(app);

      this.deps.audit.write({
        actorUserId: decision.actorUserId,
        actorRole: UserRole.YgkMember,
        actionType: "ELIGIBILITY_FAILED",
        affectedEntityId: applicationId,
        affectedEntityType: "Application",
        previousValue: JSON.stringify({ status: ApplicationStatus.InReviewYgk }),
        newValue: JSON.stringify({
          status: ApplicationStatus.RankedRed,
          reason: decision.note,
        }),
      });
    } else {
      // Mark as eligible, continue to next step
      this.deps.audit.write({
        actorUserId: decision.actorUserId,
        actorRole: UserRole.YgkMember,
        actionType: "ELIGIBILITY_PASSED",
        affectedEntityId: applicationId,
        affectedEntityType: "Application",
        newValue: JSON.stringify({ eligible: true }),
      });
    }
  }

  /**
   * Get department conditions for an application
   */
  async getDepartmentConditions(applicationId: string) {
    const app = await this.deps.applications.findById(applicationId);

    if (!app) {
      throw new NotFoundError(`Application ${applicationId} not found`);
    }

    if (app.currentStatus !== ApplicationStatus.InReviewYgk) {
      throw new ValidationError(
        `Application must be in IN_REVIEW_YGK status. Current: ${app.currentStatus}`
      );
    }

    // Use conditionChecks from preScreening if present (set by seed/intake)
    const conditionChecks = app.preScreening.conditionChecks ?? [];
    const hasConditions = conditionChecks.length > 0;
    const allMet = conditionChecks.every((c) => c.met);

    return {
      applicationId: app.applicationId,
      departmentId: app.targetDepartmentId,
      hasConditions,
      conditions: conditionChecks,
      autoPass: !hasConditions,
      allConditionsMet: allMet,
      message: !hasConditions
        ? "Bölüm koşulu yok — devam ediliyor."
        : "",
    };
  }

  /**
   * Save department conditions decision
   */
  async saveConditionsDecision(
    applicationId: string,
    decision: {
      conditionsMet: boolean;
      note?: string;
      actorUserId: string;
    }
  ): Promise<void> {
    const app = await this.deps.applications.findById(applicationId);

    if (!app) {
      throw new NotFoundError(`Application ${applicationId} not found`);
    }

    if (app.currentStatus !== ApplicationStatus.InReviewYgk) {
      throw new ValidationError(
        `Application must be in IN_REVIEW_YGK status. Current: ${app.currentStatus}`
      );
    }

    if (!decision.conditionsMet) {
      // If conditions not met, require a note
      if (!decision.note || decision.note.trim().length === 0) {
        throw new ValidationError(
          "A note is required when marking conditions as not met"
        );
      }

      // Flag application
      app.currentStatus = ApplicationStatus.RankedRed;
      app.rankingCategory = RankingCategory.Red;
      app.rejectionReason = decision.note;
      app.transferScore = 0;
      await this.deps.applications.save(app);

      this.deps.audit.write({
        actorUserId: decision.actorUserId,
        actorRole: UserRole.YgkMember,
        actionType: "DEPT_CONDITIONS_FAILED",
        affectedEntityId: applicationId,
        affectedEntityType: "Application",
        previousValue: JSON.stringify({ status: ApplicationStatus.InReviewYgk }),
        newValue: JSON.stringify({
          status: ApplicationStatus.RankedRed,
          reason: decision.note,
        }),
      });
    } else {
      // Conditions met, continue to score calculation
      this.deps.audit.write({
        actorUserId: decision.actorUserId,
        actorRole: UserRole.YgkMember,
        actionType: "DEPT_CONDITIONS_PASSED",
        affectedEntityId: applicationId,
        affectedEntityType: "Application",
        newValue: JSON.stringify({ conditionsMet: true }),
      });
    }
  }

  /**
   * Calculate and display score for review (not yet confirmed)
   */
  async calculateScoreForReview(applicationId: string) {
    const app = await this.deps.applications.findById(applicationId);

    if (!app) {
      throw new NotFoundError(`Application ${applicationId} not found`);
    }

    if (app.currentStatus !== ApplicationStatus.InReviewYgk) {
      throw new ValidationError(
        `Application must be in IN_REVIEW_YGK status. Current: ${app.currentStatus}`
      );
    }

    if (!app.submittedYksScore) {
      // 5H: YKS eksik → ÖİDB'ye iade et
      app.currentStatus = ApplicationStatus.IntakeVerified;
      await this.deps.applications.save(app);
      throw new ValidationError(
        "Score could not be calculated. (431-CALC) - YKS score is missing. Application returned to OIDB queue."
      );
    }

    const score = this.calculateTransferScore(
      app.submittedGpa,
      app.submittedYksScore
    );

    return {
      applicationId: app.applicationId,
      yksScore: app.submittedYksScore,
      gpa: app.submittedGpa,
      calculatedScore: score,
      formula: "Puan = (YKS / 500 × 0.9) + (GPA × 0.1)",
    };
  }

  /**
   * Confirm and save score (makes it permanent)
   */
  async confirmScore(
    applicationId: string,
    actorUserId: string
  ): Promise<void> {
    const app = await this.deps.applications.findById(applicationId);

    if (!app) {
      throw new NotFoundError(`Application ${applicationId} not found`);
    }

    if (app.currentStatus !== ApplicationStatus.InReviewYgk) {
      throw new ValidationError(
        `Application must be in IN_REVIEW_YGK status. Current: ${app.currentStatus}`
      );
    }

    if (!app.submittedYksScore) {
      throw new ValidationError(
        "Cannot confirm score - YKS score is missing"
      );
    }

    const score = this.calculateTransferScore(
      app.submittedGpa,
      app.submittedYksScore
    );

    app.transferScore = score;
    await this.deps.applications.save(app);

    this.deps.audit.write({
      actorUserId,
      actorRole: UserRole.YgkMember,
      actionType: "SCORE_CONFIRMED",
      affectedEntityId: applicationId,
      affectedEntityType: "Application",
      newValue: JSON.stringify({
        score: score.toFixed(5),
        yksScore: app.submittedYksScore,
        gpa: app.submittedGpa,
      }),
    });
  }

  /**
   * Invalidate score (Go Back functionality)
   */
  async invalidateScore(
    applicationId: string,
    actorUserId: string
  ): Promise<void> {
    const app = await this.deps.applications.findById(applicationId);

    if (!app) {
      throw new NotFoundError(`Application ${applicationId} not found`);
    }

    if (app.currentStatus !== ApplicationStatus.InReviewYgk) {
      throw new ValidationError(
        `Application must be in IN_REVIEW_YGK status. Current: ${app.currentStatus}`
      );
    }

    app.transferScore = undefined;
    await this.deps.applications.save(app);

    this.deps.audit.write({
      actorUserId,
      actorRole: UserRole.YgkMember,
      actionType: "SCORE_INVALIDATED",
      affectedEntityId: applicationId,
      affectedEntityType: "Application",
      newValue: JSON.stringify({
        scoreInvalidated: true,
        message: "User requested to go back and correct data",
      }),
    });
  }

  /**
   * Execute ranking for a specific department and period
   */
  async executeRanking(
    input: RankingExecutionInput
  ): Promise<RankingSummaryDto> {
    const { departmentId, periodId, quota, actorUserId } = input;

    if (quota <= 0) {
      throw new ValidationError("Quota must be a positive number");
    }

    // Fetch all applications ready for ranking
    // Applications must be IN_REVIEW_YGK (with or without confirmed scores)
    // Those without scores will be evaluated and may be ineligible
    const applications = (
      await this.deps.applications.findByDepartmentAndPeriod(
        departmentId,
        periodId
      )
    ).filter((app) => app.currentStatus === ApplicationStatus.InReviewYgk);

    if (applications.length === 0) {
      throw new NotFoundError(
        `No applications found with status IN_REVIEW_YGK for department ${departmentId}, period ${periodId}`
      );
    }

    // Evaluate eligibility and calculate scores
    const evaluated = applications.map((app) => {
      const eligibility = this.evaluateEligibility(app);
      let transferScore = 0;

      if (eligibility.eligible && app.submittedYksScore) {
        transferScore = this.calculateTransferScore(
          app.submittedGpa,
          app.submittedYksScore
        );
      }

      return {
        application: app,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        transferScore,
      };
    });

    // Separate eligible and ineligible
    const eligible = evaluated.filter((e) => e.eligible);
    const ineligible = evaluated.filter((e) => !e.eligible);

    // Sort eligible by transfer score (descending), then by submittedAt (ascending) for tie-breaking
    eligible.sort((a, b) => {
      if (Math.abs(a.transferScore - b.transferScore) < 0.0001) {
        // Tie-breaking: earlier submission wins
        return (
          new Date(a.application.submittedAt).getTime() -
          new Date(b.application.submittedAt).getTime()
        );
      }
      return b.transferScore - a.transferScore; // Higher score first
    });

    // Assign categories
    const asilCount = Math.min(eligible.length, quota);
    const yedekCount = Math.min(
      eligible.length - asilCount,
      Math.ceil(quota * YEDEK_PERCENTAGE)
    );

    const categorized = eligible.map((item, index) => {
      let category: RankingCategory;
      let status: ApplicationStatus;

      if (index < asilCount) {
        category = RankingCategory.Asil;
        status = ApplicationStatus.RankedAsil;
      } else if (index < asilCount + yedekCount) {
        category = RankingCategory.Yedek;
        status = ApplicationStatus.RankedYedek;
      } else {
        category = RankingCategory.Red;
        status = ApplicationStatus.RankedRed;
      }

      return {
        ...item,
        category,
        status,
        rank: index + 1,
      };
    });

    // Mark all ineligible as RED
    const ineligibleCategorized = ineligible.map((item) => ({
      ...item,
      category: RankingCategory.Red,
      status: ApplicationStatus.RankedRed,
      rank: 0, // No rank for ineligible
    }));

    // Update applications
    // Update eligible and ranked
    for (const item of categorized) {
      const app = item.application;
      app.transferScore = item.transferScore;
      app.rankingCategory = item.category;
      app.currentStatus = item.status;
      await this.deps.applications.save(app);

      this.deps.audit.write({
        actorUserId,
        actorRole: UserRole.YgkChair,
        actionType: "RANKING_ASSIGNED",
        affectedEntityId: item.application.applicationId,
        affectedEntityType: "Application",
        previousValue: JSON.stringify({
          status: ApplicationStatus.IntakeVerified,
        }),
        newValue: JSON.stringify({
          category: item.category,
          status: item.status,
          rank: item.rank,
          score: item.transferScore.toFixed(5),
        }),
      });
    }

    // Update ineligible
    for (const item of ineligibleCategorized) {
      const app = item.application;
      app.transferScore = 0;
      app.rankingCategory = RankingCategory.Red;
      app.currentStatus = ApplicationStatus.RankedRed;
      app.rejectionReason = item.reason;
      await this.deps.applications.save(app);

      this.deps.audit.write({
        actorUserId,
        actorRole: UserRole.YgkChair,
        actionType: "RANKING_INELIGIBLE",
        affectedEntityId: item.application.applicationId,
        affectedEntityType: "Application",
        previousValue: JSON.stringify({
          status: ApplicationStatus.IntakeVerified,
        }),
        newValue: JSON.stringify({
          category: RankingCategory.Red,
          reason: item.reason,
        }),
      });
    }

    // Build result DTOs
    const rankings: RankingResultDto[] = categorized.map((item) => ({
      rank: item.rank,
      applicationId: item.application.applicationId,
      studentTckn: item.application.studentTckn,
      studentFullName: item.application.studentFullName,
      gpa: item.application.submittedGpa,
      yksScore: item.application.submittedYksScore ?? null,
      transferScore: item.transferScore,
      category: item.category,
    }));

    // ── Tie detection at the Asil/Yedek boundary ──────────────────────────
    const ties: TieGroup[] = [];
    if (asilCount > 0 && asilCount < eligible.length) {
      const lastAsilScore = eligible[asilCount - 1].transferScore;
      const firstNonAsilScore = eligible[asilCount].transferScore;
      if (Math.abs(lastAsilScore - firstNonAsilScore) < 0.000001) {
        const tiedApps = eligible.filter(
          (e) => Math.abs(e.transferScore - lastAsilScore) < 0.000001
        );
        if (tiedApps.length > 1) {
          ties.push({
            boundaryRank: asilCount,
            applicationIds: tiedApps.map((e) => e.application.applicationId),
          });
        }
      }
    }

    return {
      departmentId,
      periodId,
      quota,
      totalEvaluated: applications.length,
      eligible: eligible.length,
      ineligible: ineligible.length,
      asilCount,
      yedekCount,
      redCount: eligible.length - asilCount - yedekCount + ineligible.length,
      rankings,
      hasTies: ties.length > 0,
      ties,
    };
  }

  /**
   * Get ranking results for a department/period
   */
  async getRankingResults(
    departmentId: string,
    periodId: string
  ): Promise<RankingResultDto[]> {
    const applications = (
      await this.deps.applications.findByDepartmentAndPeriod(
        departmentId,
        periodId
      )
    )
      .filter((app) =>
        [
          ApplicationStatus.RankedAsil,
          ApplicationStatus.RankedYedek,
          ApplicationStatus.RankedRed,
        ].includes(app.currentStatus)
      )
      .sort((a, b) => {
        // Sort by transfer score descending, then by submittedAt ascending
        const scoreDiff = (b.transferScore ?? 0) - (a.transferScore ?? 0);
        if (Math.abs(scoreDiff) > 0.0001) return scoreDiff;
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      });

    let rank = 1;
    return applications
      .filter((app) => app.rankingCategory !== RankingCategory.Red || app.transferScore! > 0)
      .map((app) => ({
        rank: rank++,
        applicationId: app.applicationId,
        studentTckn: app.studentTckn,
        studentFullName: app.studentFullName,
        gpa: app.submittedGpa,
        yksScore: app.submittedYksScore ?? null,
        transferScore: app.transferScore ?? 0,
        category: app.rankingCategory as RankingCategory,
      }));
  }

  /**
   * Get department ranking overview (for YGK dashboard)
   */
  async getDepartmentOverview(
    departmentId: string,
    periodId: string
  ): Promise<DepartmentRankingOverviewDto> {
    const allApplications = await this.deps.applications.findByDepartmentAndPeriod(
      departmentId,
      periodId
    );

    const pendingRanking = allApplications.filter(
      (app) => app.currentStatus === ApplicationStatus.IntakeVerified
    );

    const ranked = allApplications.filter((app) =>
      [
        ApplicationStatus.RankedAsil,
        ApplicationStatus.RankedYedek,
        ApplicationStatus.RankedRed,
      ].includes(app.currentStatus as ApplicationStatus)
    );

    const asilList = ranked
      .filter((app) => app.rankingCategory === RankingCategory.Asil)
      .map((app) => app.applicationId);

    const yedekList = ranked
      .filter((app) => app.rankingCategory === RankingCategory.Yedek)
      .map((app) => app.applicationId);

    const redList = ranked
      .filter((app) => app.rankingCategory === RankingCategory.Red)
      .map((app) => app.applicationId);

    // Get quota from department info (mock for now)
    const quota = 8; // TODO: fetch from DepartmentApplicationInformation table

    return {
      departmentId,
      periodId,
      quota,
      totalApplications: allApplications.length,
      pendingRanking: pendingRanking.length,
      ranked: ranked.length,
      asilList,
      yedekList,
      redList,
    };
  }
}
