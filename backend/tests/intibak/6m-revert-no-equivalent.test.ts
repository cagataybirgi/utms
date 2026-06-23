import { buildTestKit, TEST_USERS } from "../test-helpers";
import { MappingStatus } from "../../src/shared/types";

interface MappingDto {
  sourceCourseCodes: string[];
  targetCourseCode: string | null;
  status: string;
}

const hasNoEquiv = (mappings: MappingDto[], code: string) =>
  mappings.some(
    (m) => m.targetCourseCode === code && m.status === MappingStatus.NoPreviousEquivalent,
  );

describe("Test Case 6M: Revert an 'Eşdeğeri Yok' (NoPreviousEquivalent) decision", () => {
  it("Mert Koc: marking CMPE112 as NoPreviousEquivalent and then reverting clears the decision", async () => {
    const kit = buildTestKit();
    const ygk = kit.asUser(TEST_USERS.ygkMember);
    const appId = "app-asil-mert-koc";

    const prep = await ygk.post(`/api/ygk/intibak/${appId}/prepare`).send();
    expect(prep.status).toBe(200);
    expect(hasNoEquiv(prep.body.mappings, "CMPE112")).toBe(false);

    // Mark "Eşdeğeri Yok" → target becomes covered.
    const marked = await ygk.patch(`/api/ygk/intibak/${appId}/mappings`).send({
      mutations: [
        {
          sourceCourseCodes: [],
          targetCourseCode: "CMPE112",
          status: MappingStatus.NoPreviousEquivalent,
        },
      ],
    });
    expect(marked.status).toBe(200);
    expect(hasNoEquiv(marked.body.mappings, "CMPE112")).toBe(true);

    // Revert it → target goes back to undecided.
    const reverted = await ygk.patch(`/api/ygk/intibak/${appId}/mappings`).send({
      mutations: [
        {
          sourceCourseCodes: [],
          targetCourseCode: "CMPE112",
          status: MappingStatus.NoPreviousEquivalent,
          remove: true,
        },
      ],
    });
    expect(reverted.status).toBe(200);
    expect(hasNoEquiv(reverted.body.mappings, "CMPE112")).toBe(false);

    // Save must now be blocked again because CMPE112 is undecided.
    const blocked = await ygk.post(`/api/ygk/intibak/${appId}/save`).send();
    expect(blocked.status).toBe(400);
    expect(blocked.body.details.incompleteTargets).toContain("CMPE112");
  });

  it("Reverting a target that was never marked is a safe no-op", async () => {
    const kit = buildTestKit();
    const ygk = kit.asUser(TEST_USERS.ygkMember);
    const appId = "app-asil-mert-koc";

    await ygk.post(`/api/ygk/intibak/${appId}/prepare`).send();

    const reverted = await ygk.patch(`/api/ygk/intibak/${appId}/mappings`).send({
      mutations: [
        {
          sourceCourseCodes: [],
          targetCourseCode: "CMPE112",
          status: MappingStatus.NoPreviousEquivalent,
          remove: true,
        },
      ],
    });
    expect(reverted.status).toBe(200);
    expect(hasNoEquiv(reverted.body.mappings, "CMPE112")).toBe(false);
  });
});
