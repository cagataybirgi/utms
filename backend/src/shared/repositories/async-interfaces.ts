import { Application, DepartmentQuota, Document, EvaluationPackage } from "../types";
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

// Documents read by the OIDB review (Scenario 4) and YDYO language review
// (Scenario 3.1). Backed by Neon at runtime so a live student's uploaded
// documents appear in the officer's detail view. isStoreReachable is kept
// synchronous to preserve the DocumentStore-unreachable test path.
export interface IAsyncDocumentRepository {
  findByApplicationId(applicationId: string): Promise<Document[]>;
  isStoreReachable(): boolean;
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
