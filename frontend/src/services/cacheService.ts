import localforage from "localforage";
import { NormalizedTask } from "../utils/normalize";

// Configure the localforage instance exclusively for our application storage sandbox
localforage.config({
  name: "AnnotationConsole",
  storeName: "tasks_cache_store",
  description: "Caches the most recently loaded task list records for rapid client-side hydration",
});

const TASKS_CACHE_KEY = "cached_tasks_collection";
const METADATA_CACHE_KEY = "cached_tasks_metadata";

interface CachedMetadata {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  cachedAt: number;
}

/**
 * 1. SAVE TO INDEXEDDB CACHE
 * Writes tasks and structural page metadata silently off the main thread.
 */
export async function saveTasksToCache(
  tasks: NormalizedTask[],
  metadata: Omit<CachedMetadata, "cachedAt">
): Promise<void> {
  try {
    // Save the entities list array
    await localforage.setItem(TASKS_CACHE_KEY, tasks);
    
    // Save tracking parameters alongside a timestamp to identify age metrics
    const metaPayload: CachedMetadata = {
      ...metadata,
      cachedAt: Date.now(),
    };
    await localforage.setItem(METADATA_CACHE_KEY, metaPayload);
  } catch (err) {
    console.error("Failed to commit application runtime state data to IndexedDB cache layer:", err);
  }
}

/**
 * 2. LOAD FROM INDEXEDDB CACHE
 * Pulls local entries to enable instant paint rendering cycles.
 */
export async function loadTasksFromCache(): Promise<{
  tasks: NormalizedTask[];
  metadata: CachedMetadata;
} | null> {
  try {
    const tasks = await localforage.getItem<NormalizedTask[]>(TASKS_CACHE_KEY);
    const metadata = await localforage.getItem<CachedMetadata>(METADATA_CACHE_KEY);

    if (tasks && metadata) {
      return { tasks, metadata };
    }
    return null;
  } catch (err) {
    console.error("Failed to extract application state data from IndexedDB cache layer:", err);
    return null;
  }
}

/**
 * 3. CLEAR CACHE
 * Utility wrapper for logging out or resetting tasks profiles state boundaries cleanly.
 */
export async function clearTasksCache(): Promise<void> {
  try {
    await localforage.removeItem(TASKS_CACHE_KEY);
    await localforage.removeItem(METADATA_CACHE_KEY);
  } catch (err) {
    console.error("Failed to reset explicit IndexedDB storage cache keys:", err);
  }
}