import { normalizeStatus, normalizeTimestamp, normalizeTask, TaskStatus } from "../utils/normalize";

jest.mock("isomorphic-dompurify", () => ({
  sanitize: (content: string) => content, 
}));

describe("Domain Mapping and Data Normalization Test Suite", () => {
  
  describe("normalizeStatus() Utility Tests", () => {
    it("should gracefully parse inconsistent casings and underscores into clean Enum tokens", () => {
      expect(normalizeStatus("in_progress")).toBe(TaskStatus.IN_PROGRESS);
      expect(normalizeStatus("InProgress")).toBe(TaskStatus.IN_PROGRESS);
      expect(normalizeStatus("QA")).toBe(TaskStatus.QA);
      expect(normalizeStatus("done")).toBe(TaskStatus.DONE);
      expect(normalizeStatus("BLOCKED")).toBe(TaskStatus.BLOCKED);
    });

    it("should fall back to UNKNOWN when provided a completely invalid or empty status value", () => {
      expect(normalizeStatus("")).toBe(TaskStatus.UNKNOWN);
      expect(normalizeStatus("corrupted_backend_status")).toBe(TaskStatus.UNKNOWN);
    });
  });

  describe("normalizeTimestamp() Utility Tests", () => {
    it("should preserve standard epoch millisecond numbers directly", () => {
      const fixedEpochMs = 1719600000000;
      expect(normalizeTimestamp(fixedEpochMs)).toBe(fixedEpochMs);
    });

    it("should successfully convert ISO date string formats into standard epoch numbers", () => {
      const isoString = "2026-07-02T12:00:00.000Z";
      const expectedEpoch = Date.parse(isoString);
      expect(normalizeTimestamp(isoString)).toBe(expectedEpoch);
    });

    it("should fall back to the current timestamp if the incoming time data frame is unparseable", () => {
      const spy = jest.spyOn(Date, "now").mockImplementation(() => 1600000000000);
      expect(normalizeTimestamp("completely-invalid-date-string")).toBe(1600000000000);
      spy.mockRestore();
    });
  });

  describe("normalizeTask() Core Pipeline Engine Tests", () => {
    it("should take a chaotic, messy backend payload and transform it into a clean NormalizedTask profile", () => {
      const rawPayload = {
        id: "t45",
        title: "Test Vector",
        type: "image",
        status: "InProgress",
        assignee: { id: "u2", name: "Ben" },
        annotationCount: "14", // String wrapped number 
        updatedAt: "2026-07-02T10:00:00.000Z", // ISO format
      };

      const result = normalizeTask(rawPayload);

      expect(result.id).toBe("t45");
      expect(result.type).toBe("image");
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      expect(result.annotationCount).toBe(14); // strict number conversion
      expect(result.updatedAt).toBe(Date.parse("2026-07-02T10:00:00.000Z")); // timestamp conversion
      expect(result.assignee).toEqual({ id: "u2", name: "Ben" });
    });

    it("should gracefully handle outlier or unrecognized media type signatures by mapping them safely to unknown", () => {
      const rawPayloadWithOutlierType = {
        id: "t99",
        title: "Outlier Video Task",
        type: "video", // Outlier type 
        status: "todo",
        annotationCount: 0,
        updatedAt: 1719600000000,
      };

      const result = normalizeTask(rawPayloadWithOutlierType);
      expect(result.type).toBe("unknown"); // resilience block fallback
    });

    it("should throw an explicit error message if the incoming payload is structurally corrupt or lacks an ID", () => {
      expect(() => normalizeTask(null)).toThrow();
      expect(() => normalizeTask({})).toThrow();
    });
  });
});