import { saveTasksToCache, loadTasksFromCache, clearTasksCache } from "../services/cacheService";
import localforage from "localforage";
import { NormalizedTask, TaskStatus } from "../utils/normalize";

jest.mock("isomorphic-dompurify", () => ({
  sanitize: (content: string) => content, 
}));

// Mock localforage 
jest.mock("localforage", () => {
  const store: Record<string, any> = {};
  return {
    config: jest.fn(),
    setItem: jest.fn((key, value) => {
      store[key] = value;
      return Promise.resolve(value);
    }),
    getItem: jest.fn((key) => Promise.resolve(store[key] || null)),
    removeItem: jest.fn((key) => {
      delete store[key];
      return Promise.resolve();
    }),
  };
});

describe("Cache Service Asynchronous Storage Test Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should silently commit task collections and page metadata to the cache", async () => {
    const mockTasks = [
      { 
        id: "t1", 
        title: "Cache Task", 
        type: "text", 
        status: TaskStatus.TODO, 
        annotationCount: 2, 
        updatedAt: 1000, 
        assignee: null
    }
    ];
    const mockMetadata = { totalItems: 1, currentPage: 1, pageSize: 20 };

    await expect(saveTasksToCache(mockTasks as NormalizedTask[], mockMetadata)).resolves.not.toThrow();
    expect(localforage.setItem).toHaveBeenCalledTimes(2);
  });

  it("should retrieve cached tasks and metadata structured cleanly if both exist", async () => {
    const mockTasks = [
      { id: "t1", title: "Cache Task", type: "text", status: TaskStatus.TODO, annotationCount: 2, updatedAt: 1000 }
    ];
    const mockMetadata = { totalItems: 1, currentPage: 1, pageSize: 20, cachedAt: Date.now() };

    // Seed the mock store values
    (localforage.getItem as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve(mockTasks))
      .mockImplementationOnce(() => Promise.resolve(mockMetadata));

    const cachedData = await loadTasksFromCache();
    expect(cachedData).not.toBeNull();
    expect(cachedData?.tasks).toEqual(mockTasks);
    expect(cachedData?.metadata.totalItems).toBe(1);
  });

  it("should return null if either the tasks array or metadata block is missing from storage", async () => {
    (localforage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(null));
    
    const cachedData = await loadTasksFromCache();
    expect(cachedData).toBeNull();
  });

  it("should safely wipe active store keys during application reset routines", async () => {
    await expect(clearTasksCache()).resolves.not.toThrow();
    expect(localforage.removeItem).toHaveBeenCalledTimes(2);
  });
});