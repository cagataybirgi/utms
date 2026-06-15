import { Application, DepartmentQuota, EvaluationPackage } from "../types";
import { BoardReviewState } from "../../modules/board/board.types";

// Async repository contracts used by the ranking module so its data source can
// be Neon (Prisma) at runtime and the in-memory store under test — without the
// service caring which. Mirrors the sync IApplicationRepository, promisified.

export interface IAsyncApplicationRepository {
  findById(applicationId: string): Promise<Application | undefined>;
  findAll(): Promise<Application[]>;
  findByDepartmentAndPeriod(
    departmentId: string,
    periodId: string
  ): Promise<Application[]>;
  save(application: Application): Promise<Application>;
}

export interface IAsyncQuotaRepository {
  find(
    departmentId: string,
    periodId: string
  ): Promise<DepartmentQuota | undefined>;
}

// Scenarios 6/7 — EvaluationPackage + BoardReviewState persisted to Neon so
// the Faculty Board queue survives backend restarts.

export interface IAsyncPackageRepository {
  findById(packageId: string): Promise<EvaluationPackage | undefined>;
  findByDepartmentAndPeriod(
    departmentId: string,
    periodId: string
  ): Promise<EvaluationPackage | undefined>;
  findAll(): Promise<EvaluationPackage[]>;
  save(pkg: EvaluationPackage): Promise<EvaluationPackage>;
}

export interface IAsyncBoardReviewStateRepository {
  findById(packageId: string): Promise<BoardReviewState | undefined>;
  findAll(): Promise<BoardReviewState[]>;
  save(state: BoardReviewState): Promise<BoardReviewState>;
  put(state: BoardReviewState): Promise<void>;
}
