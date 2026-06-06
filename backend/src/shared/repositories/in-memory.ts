import {
  Application,
  AuditLogEntry,
  DepartmentCurriculum,
  DepartmentQuota,
  Document,
  EvaluationPackage,
  IntibakTable,
  NotificationRecord,
  User,
} from "../types";
import {
  IApplicationRepository,
  IAuditRepository,
  ICurriculumRepository,
  IDocumentRepository,
  IIntibakRepository,
  INotificationRepository,
  IPackageRepository,
  IUserRepository,
} from "./interfaces";

// DEV-ONLY: clear() methods used by /api/dev/reset — remove before submission
export class InMemoryUserRepository implements IUserRepository {
  constructor(private readonly store: Map<string, User> = new Map()) {}
  clear(): void { this.store.clear(); }

  put(user: User): void {
    this.store.set(user.userId, user);
  }

  findById(userId: string): User | undefined {
    return this.store.get(userId);
  }

  findByTckn(tckn: string): User | undefined {
    for (const user of this.store.values()) {
      if (user.tckn === tckn) return user;
    }
    return undefined;
  }
}

export class InMemoryApplicationRepository implements IApplicationRepository {
  constructor(private readonly store: Map<string, Application> = new Map()) {}
  clear(): void { this.store.clear(); }

  put(app: Application): void {
    this.store.set(app.applicationId, app);
  }

  findById(applicationId: string): Application | undefined {
    return this.store.get(applicationId);
  }

  findAll(): Application[] {
    return Array.from(this.store.values());
  }

  findByStatus(...statuses: string[]): Application[] {
    const set = new Set(statuses);
    return Array.from(this.store.values()).filter((a) => set.has(a.currentStatus));
  }

  findByDepartmentAndPeriod(departmentId: string, periodId: string): Application[] {
    return Array.from(this.store.values()).filter(
      (a) => a.targetDepartmentId === departmentId && a.periodId === periodId,
    );
  }

  save(application: Application): Application {
    application.lastModifiedAt = new Date().toISOString();
    this.store.set(application.applicationId, application);
    return application;
  }
}

export class InMemoryDocumentRepository implements IDocumentRepository {
  private storeReachable = true;

  constructor(private readonly store: Map<string, Document> = new Map()) {}
  clear(): void { this.store.clear(); }

  put(doc: Document): void {
    this.store.set(doc.documentId, doc);
  }

  findByApplicationId(applicationId: string): Document[] {
    return Array.from(this.store.values()).filter((d) => d.applicationId === applicationId);
  }

  findById(documentId: string): Document | undefined {
    return this.store.get(documentId);
  }

  isStoreReachable(): boolean {
    return this.storeReachable;
  }

  setStoreReachable(reachable: boolean): void {
    this.storeReachable = reachable;
  }
}

export class InMemoryIntibakRepository implements IIntibakRepository {
  constructor(private readonly store: Map<string, IntibakTable> = new Map()) {}
  clear(): void { this.store.clear(); }

  findById(intibakTableId: string): IntibakTable | undefined {
    return this.store.get(intibakTableId);
  }

  findByApplicationId(applicationId: string): IntibakTable | undefined {
    for (const t of this.store.values()) {
      if (t.applicationId === applicationId) return t;
    }
    return undefined;
  }

  save(table: IntibakTable): IntibakTable {
    this.store.set(table.intibakTableId, table);
    return table;
  }
}

export class InMemoryCurriculumRepository implements ICurriculumRepository {
  constructor(private readonly store: Map<string, DepartmentCurriculum> = new Map()) {}
  clear(): void { this.store.clear(); }

  put(curriculum: DepartmentCurriculum): void {
    this.store.set(curriculum.departmentId, curriculum);
  }

  findByDepartmentId(departmentId: string): DepartmentCurriculum | undefined {
    return this.store.get(departmentId);
  }
}

export class InMemoryPackageRepository implements IPackageRepository {
  constructor(private readonly store: Map<string, EvaluationPackage> = new Map()) {}
  clear(): void { this.store.clear(); }

  findById(packageId: string): EvaluationPackage | undefined {
    return this.store.get(packageId);
  }

  findByDepartmentAndPeriod(
    departmentId: string,
    periodId: string,
  ): EvaluationPackage | undefined {
    for (const p of this.store.values()) {
      if (p.departmentId === departmentId && p.periodId === periodId) return p;
    }
    return undefined;
  }

  findAll(): EvaluationPackage[] {
    return Array.from(this.store.values());
  }

  save(pkg: EvaluationPackage): EvaluationPackage {
    this.store.set(pkg.packageId, pkg);
    return pkg;
  }
}

export class InMemoryAuditRepository implements IAuditRepository {
  private entries: AuditLogEntry[] = [];
  clear(): void { this.entries = []; }

  append(entry: AuditLogEntry): AuditLogEntry {
    this.entries.push(entry);
    return entry;
  }

  findAll(): AuditLogEntry[] {
    return [...this.entries];
  }

  findByEntity(entityType: string, entityId: string): AuditLogEntry[] {
    return this.entries.filter(
      (e) => e.affectedEntityType === entityType && e.affectedEntityId === entityId,
    );
  }
}

export class InMemoryQuotaRepository {
  private readonly store: Map<string, DepartmentQuota> = new Map();

  private key(departmentId: string, periodId: string): string {
    return `${departmentId}::${periodId}`;
  }

  put(quota: DepartmentQuota): void {
    this.store.set(this.key(quota.departmentId, quota.periodId), quota);
  }

  find(departmentId: string, periodId: string): DepartmentQuota | undefined {
    return this.store.get(this.key(departmentId, periodId));
  }

  clear(): void { this.store.clear(); }
}

// Scenario 1 (Login) — holds password-reset tokens, reset-request rate-limit
// counters and a simulated e-mail gateway availability flag. In-memory demo only.
export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: number; // epoch ms
  used: boolean;
}

export class InMemoryAuthTokenRepository {
  private readonly tokens = new Map<string, PasswordResetToken>();
  private readonly resetRequests = new Map<string, number[]>(); // key -> request timestamps (ms)
  private emailServiceAvailable = true;

  clear(): void {
    this.tokens.clear();
    this.resetRequests.clear();
    this.emailServiceAvailable = true;
  }

  setEmailServiceAvailable(available: boolean): void {
    this.emailServiceAvailable = available;
  }

  isEmailServiceAvailable(): boolean {
    return this.emailServiceAvailable;
  }

  saveToken(token: PasswordResetToken): PasswordResetToken {
    this.tokens.set(token.token, token);
    return token;
  }

  findToken(token: string): PasswordResetToken | undefined {
    return this.tokens.get(token);
  }

  markTokenUsed(token: string): void {
    const t = this.tokens.get(token);
    if (t) t.used = true;
  }

  /** Records a reset request and returns how many were made within the window. */
  recordResetRequest(key: string, windowMs: number, now: number = Date.now()): number {
    const recent = (this.resetRequests.get(key) ?? []).filter((ts) => now - ts < windowMs);
    recent.push(now);
    this.resetRequests.set(key, recent);
    return recent.length;
  }

  countResetRequests(key: string, windowMs: number, now: number = Date.now()): number {
    return (this.resetRequests.get(key) ?? []).filter((ts) => now - ts < windowMs).length;
  }
}

export class InMemoryNotificationRepository implements INotificationRepository {
  private entries: NotificationRecord[] = [];
  clear(): void { this.entries = []; }
  private serviceAvailable = true;

  setAvailable(available: boolean): void {
    this.serviceAvailable = available;
  }

  isAvailable(): boolean {
    return this.serviceAvailable;
  }

  append(record: NotificationRecord): NotificationRecord {
    if (!this.serviceAvailable) {
      record.isDelivered = false;
      record.failureReason = "Notification service offline";
    } else {
      record.isDelivered = true;
    }
    this.entries.push(record);
    return record;
  }

  findAll(): NotificationRecord[] {
    return [...this.entries];
  }

  findByRecipient(userId: string): NotificationRecord[] {
    return this.entries.filter((e) => e.recipientUserId === userId);
  }
}
