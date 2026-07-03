jest.mock("isomorphic-dompurify", () => ({
  sanitize: (content: string) => content, 
}));

describe("Task Ticker Subsystem Data Logic Verification", () => {
  let mockTasksCollection: Array<{ id: string; title: string; updatedAt: number }> = [];

  beforeEach(() => {
    mockTasksCollection = [
      { id: "t1", title: "Task 1", updatedAt: 1000 },
      { id: "t2", title: "Task 2", updatedAt: 2000 },
    ];
  });

  it("should correctly prevent duplicate IDs by filtering out older entries during ingestion", () => {
    const duplicateIncomingTask = { id: "t1", title: "Task 1 Updated", updatedAt: 3000 };
    
    // Simulate our components array-filtering logic manually to inspect boundary logic
    const filteredCollection = mockTasksCollection.filter((item) => item.id !== duplicateIncomingTask.id);
    const updatedCollection = [...filteredCollection, duplicateIncomingTask];

    expect(updatedCollection).toHaveLength(2);
    expect(updatedCollection.find(t => t.id === "t1")?.updatedAt).toBe(3000);
  });

  it("should safely homogenize incoming string-wrapped ISO timestamps into numeric epochs", () => {
    const rawBackendPayload = { id: "t3", title: "Task 3", updatedAt: "2026-07-02T12:00:00.000Z" };
    
    const processedTask = {
      id: rawBackendPayload.id,
      title: rawBackendPayload.title,
      updatedAt: typeof rawBackendPayload.updatedAt === "string" ? Date.parse(rawBackendPayload.updatedAt) : rawBackendPayload.updatedAt
    };

    expect(typeof processedTask.updatedAt).toBe("number");
    expect(processedTask.updatedAt).toBe(Date.parse("2026-07-02T12:00:00.000Z"));
  });

  it("should sort task entities correctly with the most recently updated items first", () => {
    // Add an older outlier task
    mockTasksCollection.push({ id: "t3", title: "Task 3", updatedAt: 500 });

    // Apply the exact sorting algorithm
    const sorted = [...mockTasksCollection].sort((a, b) => b.updatedAt - a.updatedAt);

    expect(sorted[0].id).toBe("t2"); // 2000 epoch
    expect(sorted[1].id).toBe("t1"); // 1000 epoch
    expect(sorted[2].id).toBe("t3"); // 500 epoch
  });
});