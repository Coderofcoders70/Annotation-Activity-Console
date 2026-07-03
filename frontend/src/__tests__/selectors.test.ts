import { selectFilteredAndSortedTasks } from "../store/tasksSlice";
import { TaskStatus } from "../utils/normalize";

jest.mock("isomorphic-dompurify", () => ({
  sanitize: (content: string) => content, 
}));

describe("Redux Memoized Selectors Test Suite", () => {
  const mockTasksState = {
    tasks: {
      ids: ["t1", "t2"],
      entities: {
        t1: { id: "t1", title: "Alpha Core", type: "text", status: TaskStatus.TODO, annotationCount: 5, updatedAt: 1000 },
        t2: { id: "t2", title: "Beta Vector", type: "image", status: TaskStatus.DONE, annotationCount: 12, updatedAt: 2000 },
      },
      filters: { type: "all", status: "all", searchQuery: "" },
      sorting: { sortBy: "updatedAt", sortOrder: "desc" },
    },
  };

  it("should correctly filter tasks based on text search query strings", () => {
    const updatedState = {
      ...mockTasksState,
      tasks: { ...mockTasksState.tasks, filters: { ...mockTasksState.tasks.filters, searchQuery: "Beta" } }
    };
    // @ts-ignore - structural snapshot check
    const result = selectFilteredAndSortedTasks(updatedState);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t2");
  });

  it("should respect sorting criteria orders perfectly", () => {
    // @ts-ignore - structural snapshot check
    const result = selectFilteredAndSortedTasks(mockTasksState);
    expect(result[0].id).toBe("t2"); 
  });
});