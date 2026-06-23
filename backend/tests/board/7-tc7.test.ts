import { buildTestKit, TestKit, TEST_USERS } from "../test-helpers";
import {
  ApplicationStatus,
  MappingStatus,
  PackageStatus,
} from "../../src/shared/types";
import { SEED_IDS } from "../../src/mocks/seed-data";

const ADMIN = "user-admin";

interface MappingRow {
  entryId: string;
  sourceCourseCodes: string[];
  targetCourseCode: string | null;
  status: string;
}

interface TargetRow {
  code: string;
}

async function prepAndSendCmpePackage(kit: TestKit): Promise<{ packageId: string; asilAppIds: string[] }> {
  const ygk = kit.asUser(TEST_USERS.ygkMember);
  const chair = kit.asUser(TEST_USERS.ygkChair);

  const cmpeAsilApps = kit.container.applications
    .findAll()
    .filter(
      (a) =>
        a.targetDepartmentId === SEED_IDS.DEPT_CMPE &&
        a.currentStatus === ApplicationStatus.RankedAsil,
    )
    .map((a) => a.applicationId);

  for (const appId of cmpeAsilApps) {
    const prep = await ygk.post(`/api/ygk/intibak/${appId}/prepare`).send();
    const approveAll = (prep.body.mappings as MappingRow[])
      .filter((m) => m.status === MappingStatus.SuggestedMatch)
      .map((m) => ({
        entryId: m.entryId,
        sourceCourseCodes: m.sourceCourseCodes,
        targetCourseCode: m.targetCourseCode,
        status: MappingStatus.Approved,
      }));
    const targetsCovered = new Set(approveAll.map((m) => m.targetCourseCode));
    const fillNoEq = (prep.body.targetCurriculum as TargetRow[])
      .filter((t) => !targetsCovered.has(t.code))
      .map((t) => ({
        sourceCourseCodes: [] as string[],
        targetCourseCode: t.code,
        status: MappingStatus.NoPreviousEquivalent,
      }));
    const pendingRows = (prep.body.mappings as MappingRow[])
      .filter((m) => m.status === MappingStatus.PendingReview)
      .map((m) => ({
        entryId: m.entryId,
        sourceCourseCodes: m.sourceCourseCodes,
        targetCourseCode: null,
        status: MappingStatus.NotExempt,
      }));
    await ygk
      .patch(`/api/ygk/intibak/${appId}/mappings`)
      .send({ mutations: [...approveAll, ...fillNoEq, ...pendingRows] });
    await ygk.post(`/api/ygk/intibak/${appId}/save`).send();
  }

  const send = await chair.post("/api/ygk/package/send").send({
    signaturePassword: "ygk-chair-signature",
    departmentId: SEED_IDS.DEPT_CMPE,
    periodId: SEED_IDS.PERIOD_ID,
  });
  expect(send.status).toBe(200);
  return { packageId: send.body.package.packageId, asilAppIds: cmpeAsilApps };
}

async function deanSign(kit: TestKit, packageId: string) {
  const dean = kit.asUser(TEST_USERS.deans);
  const issue = await dean.post("/api/board/signatures/issue").send({
    signatoryId: TEST_USERS.deans,
  });
  expect(issue.status).toBe(200);
  return await dean.post(`/api/board/packages/${packageId}/verify-signature`).send({
    token: issue.body.token,
    signatoryId: TEST_USERS.deans,
  });
}

describe("Scenario 7 — Faculty Board Review", () => {
  describe("TC-7A: Full Approval & Publication (Main Flow)", () => {
    it("YGK send → Dean sign → Board approve → confirm-for-publication → publish", async () => {
      const kit = buildTestKit();
      const { packageId, asilAppIds } = await prepAndSendCmpePackage(kit);

      // BoardReviewState is created at YGK send time.
      const initialState = kit.container.boardStates.findById(packageId);
      expect(initialState?.lifecycle).toBe("PENDING_BOARD_REVIEW");

      // Dean signs the package — moves to FORWARDED_TO_BOARD.
      const signed = await deanSign(kit, packageId);
      expect(signed.status).toBe(200);
      expect(signed.body.state).toBe("valid");
      expect(kit.container.boardStates.findById(packageId)?.lifecycle).toBe(
        "FORWARDED_TO_BOARD",
      );

      // Faculty Board approves — moves to APPROVED_BY_BOARD.
      const admin = kit.asUser(ADMIN);
      const decide = await admin
        .post(`/api/board/packages/${packageId}/board-decision`)
        .send({
          resolutionText: "Oy birliği ile onaylandı.",
          approved: true,
        });
      expect(decide.status).toBe(200);
      expect(decide.body.newLifecycle).toBe("APPROVED_BY_BOARD");

      // Board confirms for publication — moves to READY_FOR_PUBLICATION
      // and applications transition to ReadyForPublication.
      const confirm = await admin
        .post(`/api/board/packages/${packageId}/confirm-for-publication`)
        .send({});
      expect(confirm.status).toBe(200);
      expect(confirm.body.newLifecycle).toBe("READY_FOR_PUBLICATION");
      for (const appId of asilAppIds) {
        expect(kit.container.applications.findById(appId)?.currentStatus).toBe(
          ApplicationStatus.ReadyForPublication,
        );
      }

      // ÖİDB publishes — moves to PUBLISHED.
      const oidb = kit.asUser(TEST_USERS.oidb);
      const publish = await oidb
        .post(`/api/board/packages/${packageId}/publish`)
        .send({});
      expect(publish.status).toBe(200);
      expect(publish.body.published).toBe(true);
      expect(publish.body.hasNotifyErrors).toBe(false);
      for (const appId of asilAppIds) {
        expect(kit.container.applications.findById(appId)?.currentStatus).toBe(
          ApplicationStatus.ResultsPublished,
        );
      }
    });

    it("publish before confirm-for-publication fails with INVALID_LIFECYCLE", async () => {
      const kit = buildTestKit();
      const { packageId } = await prepAndSendCmpePackage(kit);
      await deanSign(kit, packageId);
      const admin = kit.asUser(ADMIN);
      await admin
        .post(`/api/board/packages/${packageId}/board-decision`)
        .send({ resolutionText: "Onaylandı.", approved: true });

      const oidb = kit.asUser(TEST_USERS.oidb);
      const publish = await oidb
        .post(`/api/board/packages/${packageId}/publish`)
        .send({});
      expect(publish.status).toBe(409);
      expect(publish.body.error).toBe("INVALID_LIFECYCLE");
    });
  });

  describe("TC-7B: Missing Intibak Table Check", () => {
    it("Dean signature is blocked with INTIBAK_GATE when an intibak is unlocked", async () => {
      const kit = buildTestKit();
      const { packageId, asilAppIds } = await prepAndSendCmpePackage(kit);

      // Tamper: unlock one intibak so completeness check fails.
      const victimAppId = asilAppIds[0];
      const victim = kit.container.applications.findById(victimAppId)!;
      const table = kit.container.intibakTables.findByApplicationId(victimAppId)!;
      table.isLocked = false;
      kit.container.intibakTables.save(table);

      const signed = await deanSign(kit, packageId);
      expect(signed.status).toBe(409);
      expect(signed.body.error).toBe("INTIBAK_GATE");
      expect(signed.body.message).toContain(victim.studentFullName);

      // Board state remains PENDING_BOARD_REVIEW.
      expect(kit.container.boardStates.findById(packageId)?.lifecycle).toBe(
        "PENDING_BOARD_REVIEW",
      );
    });

    it("Dean returns to YGK with clarification note", async () => {
      const kit = buildTestKit();
      const { packageId } = await prepAndSendCmpePackage(kit);

      const dean = kit.asUser(TEST_USERS.deans);
      const note = "Aday intibak detaylarını eksik bırakmış. Lütfen tamamlayın.";
      const returned = await dean
        .post(`/api/board/packages/${packageId}/return-to-ygk`)
        .send({ note });
      expect(returned.status).toBe(200);
      expect(returned.body.newLifecycle).toBe("WAITING_FOR_CLARIFICATION_YGK");
      expect(returned.body.note).toBe(note);

      const state = kit.container.boardStates.findById(packageId);
      expect(state?.lifecycle).toBe("WAITING_FOR_CLARIFICATION_YGK");
      expect(state?.clarificationNote).toBe(note);

      // Package is back to Draft so YGK can re-send after fixing intibak.
      const pkg = kit.container.packages.findById(packageId);
      expect(pkg?.status).toBe(PackageStatus.Draft);
    });

    it("return-to-ygk rejects an empty note", async () => {
      const kit = buildTestKit();
      const { packageId } = await prepAndSendCmpePackage(kit);

      const dean = kit.asUser(TEST_USERS.deans);
      const returned = await dean
        .post(`/api/board/packages/${packageId}/return-to-ygk`)
        .send({ note: "  " });
      expect(returned.status).toBe(400);
    });
  });

  describe("TC-7D: Internal Integrity Check Fail (Final Safety Gate)", () => {
    it("Board approval is blocked when an intibak is unlocked after Dean signature", async () => {
      const kit = buildTestKit();
      const { packageId, asilAppIds } = await prepAndSendCmpePackage(kit);

      // Dean signs successfully.
      const signed = await deanSign(kit, packageId);
      expect(signed.status).toBe(200);

      // Tamper: unlock one intibak between sign and approve.
      const victimAppId = asilAppIds[0];
      const victim = kit.container.applications.findById(victimAppId)!;
      const table = kit.container.intibakTables.findByApplicationId(victimAppId)!;
      table.isLocked = false;
      kit.container.intibakTables.save(table);

      const admin = kit.asUser(ADMIN);
      const decide = await admin
        .post(`/api/board/packages/${packageId}/board-decision`)
        .send({ resolutionText: "Onayla.", approved: true });
      expect(decide.status).toBe(409);
      expect(decide.body.error).toBe("INTIBAK_GATE");
      expect(decide.body.message).toContain("Son Güvenlik Kontrolü");
      expect(decide.body.message).toContain(victim.studentFullName);

      // Lifecycle stays at FORWARDED_TO_BOARD — no approval recorded.
      expect(kit.container.boardStates.findById(packageId)?.lifecycle).toBe(
        "FORWARDED_TO_BOARD",
      );
    });
  });

  describe("TC-7F: Notification Service Fail (decoupled publish)", () => {
    it("publish succeeds and returns 571-NOTIFY when notifications are offline", async () => {
      const kit = buildTestKit();
      const { packageId } = await prepAndSendCmpePackage(kit);
      await deanSign(kit, packageId);
      const admin = kit.asUser(ADMIN);
      await admin
        .post(`/api/board/packages/${packageId}/board-decision`)
        .send({ resolutionText: "Onaylandı.", approved: true });
      await admin
        .post(`/api/board/packages/${packageId}/confirm-for-publication`)
        .send({});

      kit.container.notifications.setAvailable(false);

      const oidb = kit.asUser(TEST_USERS.oidb);
      const publish = await oidb
        .post(`/api/board/packages/${packageId}/publish`)
        .send({});
      expect(publish.status).toBe(200);
      expect(publish.body.published).toBe(true);
      expect(publish.body.hasNotifyErrors).toBe(true);
      expect(publish.body.notifyErrorCode).toBe("571-NOTIFY");
    });
  });

  describe("TC-7G: Package Modification After Signing (702-HASH)", () => {
    it("Board approval is blocked when the package was modified after Dean signature", async () => {
      const kit = buildTestKit();
      const { packageId } = await prepAndSendCmpePackage(kit);
      await deanSign(kit, packageId);

      // Tamper: remove one Asil ID from the package so the hash diverges.
      const pkg = kit.container.packages.findById(packageId)!;
      pkg.asilApplicationIds = pkg.asilApplicationIds.slice(1);
      kit.container.packages.save(pkg);

      const admin = kit.asUser(ADMIN);
      const decide = await admin
        .post(`/api/board/packages/${packageId}/board-decision`)
        .send({ resolutionText: "Onaylandı.", approved: true });
      expect(decide.status).toBe(409);
      expect(decide.body.error).toBe("702-HASH");

      const state = kit.container.boardStates.findById(packageId);
      expect(state?.hashLocked).toBe(true);
      expect(state?.lifecycle).toBe("LOCKED_HASH_VIOLATION");
    });
  });
});
