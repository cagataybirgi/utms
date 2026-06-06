import { buildTestKit, TEST_USERS } from "../test-helpers";
import { ApplicationStatus } from "../../src/shared/types";

describe("Test Case 6K: Successful Transcript OCR/PDF Parsing", () => {
  it("Selin Aksoy: machine-readable transcript → 4 courses parsed into Column A, no manual entry", async () => {
    const kit = buildTestKit();
    const ygk = kit.asUser(TEST_USERS.ygkMember);
    const appId = "app-asil-selin-aksoy";

    const prep = await ygk.post(`/api/ygk/intibak/${appId}/prepare`).send();
    expect(prep.status).toBe(200);

    // No OCR-failure fallback: fully automated parse path.
    expect(prep.body.manualEntryRequired).toBe(false);

    // Exactly 4 courses parsed from the PDF.
    expect(prep.body.previousCourses).toHaveLength(4);

    const byCode = Object.fromEntries(
      prep.body.previousCourses.map((c: { code: string }) => [c.code, c]),
    );
    expect(byCode["CMPE101"]).toMatchObject({ name: "Introduction to Programming", letterGrade: "AA", ects: 6 });
    expect(byCode["MATH151"]).toMatchObject({ name: "Calculus I", letterGrade: "BA", ects: 7 });
    expect(byCode["PHYS101"]).toMatchObject({ name: "Physics I", letterGrade: "CB", ects: 6 });
    expect(byCode["ENG101"]).toMatchObject({ name: "English I", letterGrade: "AA", ects: 3 });

    // Intibak not saved → application status unchanged.
    const stored = kit.container.applications.findById(appId);
    expect(stored?.currentStatus).toBe(ApplicationStatus.RankedAsil);
  });
});
