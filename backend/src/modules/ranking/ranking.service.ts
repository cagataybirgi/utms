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
import { IApplicationRepository } from "../../shared/repositories";

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
  applications: IApplicationRepository;
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
   * Execute ranking for a specific department and period
   */
  executeRanking(input: RankingExecutionInput): RankingSummaryDto {
    const { departmentId, periodId, quota, actorUserId } = input;

    if (quota <= 0) {
      throw new ValidationError("Quota must be a positive number");
    }

    // Fetch all applications ready for ranking
    const applications = this.deps.applications
      .findByDepartmentAndPeriod(departmentId, periodId)
      .filter((app) => app.currentStatus === ApplicationStatus.IntakeVerified);

    if (applications.length === 0) {
      throw new NotFoundError(
        `No applications found with status INTAKE_VERIFIED for department ${departmentId}, period ${periodId}`
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
      this.deps.applications.save(app);

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
      this.deps.applications.save(app);

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
    };
  }

  /**
   * Get ranking results for a department/period
   */
  getRankingResults(
    departmentId: string,
    periodId: string
  ): RankingResultDto[] {
    const applications = this.deps.applications
      .findByDepartmentAndPeriod(departmentId, periodId)
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
  getDepartmentOverview(
    departmentId: string,
    periodId: string
  ): DepartmentRankingOverviewDto {
    const allApplications = this.deps.applications.findByDepartmentAndPeriod(
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
