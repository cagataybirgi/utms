import { buildTestKit, TEST_USERS } from "../test-helpers";
import { ApplicationStatus, MappingStatus } from "../../src/shared/types";

describe("Test Case 6L: Smart Suggestion Similarity Threshold Verification", () => {
  it("Cem Polat: suggestions honour code + name + ECTS rules", async () => {
    const kit = buildTestKit();
    const ygk = kit.asUser(TEST_USERS.ygkMember);
    const appId = "app-asil-cem-polat";

    const prep = await ygk.post(`/api/ygk/intibak/${appId}/prepare`).send();
    expect(prep.status).toBe(200);
    expect(prep.body.manualEntryRequired).toBe(false);

    // One mapping row per parsed source course.
    const bySource: Record<string, { status: string; targetCourseCode: string | null }> = {};
    for (const m of prep.body.mappings) {
      if (m.sourceCourseCodes.length === 1) {
        bySource[m.sourceCourseCodes[0]] = {
          status: m.status,
          targetCourseCode: m.targetCourseCode,
        };
      }
    }

    // (a) high code+name similarity, exact ECTS → CMPE101
    expect(bySource["CMP101"]).toEqual({
      status: MappingStatus.SuggestedMatch,
      targetCourseCode: "CMPE101",
    });
    // (b) partial code, high name, exact ECTS → Calculus I (MATH101 in this curriculum)
    expect(bySource["MAT150"]).toEqual({
      status: MappingStatus.SuggestedMatch,
      targetCourseCode: "MATH101",
    });
    // (c) low code, high name, exact ECTS → CMPE213 (Data Structures)
    expect(bySource["CSE220"]).toEqual({
      status: MappingStatus.SuggestedMatch,
      targetCourseCode: "CMPE213",
    });
    // (d) no similarity, ECTS out of range → no suggestion
    expect(bySource["HIST200"]).toEqual({
      status: MappingStatus.PendingReview,
      targetCourseCode: null,
    });
    // (e) code-prefix match but ECTS far outside overlap → no suggestion
    expect(bySource["CMPE999"]).toEqual({
      status: MappingStatus.PendingReview,
      targetCourseCode: null,
    });

    // Test is read-only: nothing saved, status unchanged.
    const stored = kit.container.applications.findById(appId);
    expect(stored?.currentStatus).toBe(ApplicationStatus.RankedAsil);
  });
});
