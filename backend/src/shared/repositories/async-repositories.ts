import { prisma } from "../prisma-client";
import { Application, DepartmentQuota, EvaluationPackage } from "../types";
import { BoardReviewState } from "../../modules/board/board.types";
import {
  toDomain,
  toPrismaCreate,
  toPrismaUpdate,
} from "../mappers/application-mapper";
import {
  packageToDomain,
  packageToPrismaUpsert,
} from "../mappers/package-mapper";
import {
  boardStateToDomain,
  boardStateToPrismaUpsert,
} from "../mappers/board-state-mapper";
import {
  IAsyncApplicationRepository,
  IAsyncBoardReviewStateRepository,
  IAsyncPackageRepository,
  IAsyncQuotaRepository,
} from "./async-interfaces";
import {
  InMemoryApplicationRepository,
  InMemoryPackageRepository,
  InMemoryQuotaRepository,
} from "./in-memory";
import { InMemoryBoardReviewStateRepository } from "../../modules/board/in-memory-board-state";

// ─── Prisma (Neon) implementations — used at runtime ───────────────────────────

export class PrismaApplicationRepository implements IAsyncApplicationRepository {
  async findById(applicationId: string): Promise<Application | undefined> {
    const row = await prisma.application.findUnique({ where: { applicationId } });
    return row ? toDomain(row) : undefined;
  }

  async findAll(): Promise<Application[]> {
    const rows = await prisma.application.findMany();
    return rows.map(toDomain);
  }

  async findByDepartmentAndPeriod(
    departmentId: string,
    periodId: string
  ): Promise<Application[]> {
    const rows = await prisma.application.findMany({
      where: { targetDepartmentId: departmentId, periodId },
    });
    return rows.map(toDomain);
  }

  async save(application: Application): Promise<Application> {
    const row = await prisma.application.upsert({
      where: { applicationId: application.applicationId },
      create: toPrismaCreate(application),
      update: toPrismaUpdate(application),
    });
    return toDomain(row);
  }
}

export class PrismaQuotaRepository implements IAsyncQuotaRepository {
  async find(
    departmentId: string,
    periodId: string
  ): Promise<DepartmentQuota | undefined> {
    const row = await prisma.departmentApplicationInformation.findUnique({
      where: { departmentId_periodId: { departmentId, periodId } },
    });
    if (!row) return undefined;
    return {
      departmentId: row.departmentId,
      periodId: row.periodId,
      asilQuota: row.asilQuota ?? 0,
      yedekQuota: row.yedekQuota ?? 0,
    };
  }
}

// ─── In-memory adapters — promisified wrappers used under test ──────────────────

export class InMemoryAsyncApplicationRepository
  implements IAsyncApplicationRepository
{
  constructor(private readonly inner: InMemoryApplicationRepository) {}

  async findById(applicationId: string): Promise<Application | undefined> {
    return this.inner.findById(applicationId);
  }

  async findAll(): Promise<Application[]> {
    return this.inner.findAll();
  }

  async findByDepartmentAndPeriod(
    departmentId: string,
    periodId: string
  ): Promise<Application[]> {
    return this.inner.findByDepartmentAndPeriod(departmentId, periodId);
  }

  async save(application: Application): Promise<Application> {
    return this.inner.save(application);
  }
}

export class InMemoryAsyncQuotaRepository implements IAsyncQuotaRepository {
  constructor(private readonly inner: InMemoryQuotaRepository) {}

  async find(
    departmentId: string,
    periodId: string
  ): Promise<DepartmentQuota | undefined> {
    return this.inner.find(departmentId, periodId);
  }
}

// ─── Package & Board review state (Scenarios 6/7) ─────────────────────────────

export class PrismaPackageRepository implements IAsyncPackageRepository {
  async findById(packageId: string): Promise<EvaluationPackage | undefined> {
    const row = await prisma.evaluationPackage.findUnique({ where: { packageId } });
    return row ? packageToDomain(row) : undefined;
  }

  async findByDepartmentAndPeriod(
    departmentId: string,
    periodId: string,
  ): Promise<EvaluationPackage | undefined> {
    const row = await prisma.evaluationPackage.findUnique({
      where: { departmentId_periodId: { departmentId, periodId } },
    });
    return row ? packageToDomain(row) : undefined;
  }

  async findAll(): Promise<EvaluationPackage[]> {
    const rows = await prisma.evaluationPackage.findMany();
    return rows.map(packageToDomain);
  }

  async save(pkg: EvaluationPackage): Promise<EvaluationPackage> {
    const data = packageToPrismaUpsert(pkg);
    const row = await prisma.evaluationPackage.upsert({
      where: { packageId: pkg.packageId },
      create: data,
      update: data,
    });
    return packageToDomain(row);
  }
}

export class InMemoryAsyncPackageRepository implements IAsyncPackageRepository {
  constructor(private readonly inner: InMemoryPackageRepository) {}
  async findById(packageId: string) { return this.inner.findById(packageId); }
  async findByDepartmentAndPeriod(d: string, p: string) {
    return this.inner.findByDepartmentAndPeriod(d, p);
  }
  async findAll() { return this.inner.findAll(); }
  async save(pkg: EvaluationPackage) { return this.inner.save(pkg); }
}

export class PrismaBoardReviewStateRepository
  implements IAsyncBoardReviewStateRepository
{
  async findById(packageId: string): Promise<BoardReviewState | undefined> {
    const row = await prisma.boardReviewState.findUnique({ where: { packageId } });
    return row ? boardStateToDomain(row) : undefined;
  }

  async findAll(): Promise<BoardReviewState[]> {
    const rows = await prisma.boardReviewState.findMany();
    return rows.map(boardStateToDomain);
  }

  async save(state: BoardReviewState): Promise<BoardReviewState> {
    const data = boardStateToPrismaUpsert(state);
    const row = await prisma.boardReviewState.upsert({
      where: { packageId: state.packageId },
      create: data,
      update: data,
    });
    return boardStateToDomain(row);
  }

  async put(state: BoardReviewState): Promise<void> {
    await this.save(state);
  }
}

export class InMemoryAsyncBoardReviewStateRepository
  implements IAsyncBoardReviewStateRepository
{
  constructor(private readonly inner: InMemoryBoardReviewStateRepository) {}
  async findById(packageId: string) { return this.inner.findById(packageId); }
  async findAll() { return this.inner.findAll(); }
  async save(state: BoardReviewState) { return this.inner.save(state); }
  async put(state: BoardReviewState) { this.inner.put(state); }
}
