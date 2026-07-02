import DOMPurify from "isomorphic-dompurify";

export interface RawAssignee {
  id: string;
  name: string;
}

export interface RawTask {
  id: string;
  title: string;
  type: string; // "image" | "audio" etc.
  status: string; // "in_progress" | "InProgress" | "done" | "QA" | "todo" | "BLOCKED"
  assignee: RawAssignee | null;
  annotationCount: string | number; // Messy string or number
  updatedAt: string | number; // Messy ISO string or Epoch timestamp
  meta?: Record<string, any>;
}

// clean normalized domain types 
export enum TaskStatus {
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  QA = "qa",
  DONE = "done",
  BLOCKED = "blocked",
  UNKNOWN = "unknown",
}

export type TaskType = "image" | "audio" | "text" | "unknown";

export interface BaseNormalizedTask {
  id: string;
  title: string;
  status: TaskStatus;
  assignee: RawAssignee | null;
  annotationCount: number;
  updatedAt: number; // Normalized exclusively to epoch ms
  meta: Record<string, any>;
}

// Discriminated Union based on 'type'
export interface ImageTask extends BaseNormalizedTask {
  type: "image";
}

export interface AudioTask extends BaseNormalizedTask {
  type: "audio";
}

export interface TextTask extends BaseNormalizedTask {
  type: "text";
}

export interface UnknownTask extends BaseNormalizedTask {
  type: "unknown";
}

export type NormalizedTask = ImageTask | AudioTask | TextTask | UnknownTask;

// Normalizes arbitrary backend status variants to clean Enum tokens
export function normalizeStatus(rawStatus: string): TaskStatus {
  if (!rawStatus) return TaskStatus.UNKNOWN;
  
  const normalized = rawStatus.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  switch (normalized) {
    case "todo":
      return TaskStatus.TODO;
    case "inprogress":
    case "inprogress":
      return TaskStatus.IN_PROGRESS;
    case "qa":
      return TaskStatus.QA;
    case "done":
      return TaskStatus.DONE;
    case "blocked":
      return TaskStatus.BLOCKED;
    default:
      return TaskStatus.UNKNOWN;
  }
}

// Safely converts dual format string/number timestamps to standard epoch milliseconds
export function normalizeTimestamp(rawTime: string | number): number {
  if (typeof rawTime === "number") {
    return rawTime;
  }
  if (typeof rawTime === "string") {
    const parsed = Date.parse(rawTime);
    return isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
}

// Transforms raw payloads securely into our clean internal model.
export function normalizeTask(raw: any): NormalizedTask {
  // Gracefully handle complete garbage/missing items
  if (!raw || typeof raw !== "object" || !raw.id) {
    throw new Error("Invalid task payload structural data signature.");
  }

  // Coerce annotation counts properly
  const annotationCount = typeof raw.annotationCount === "string" 
    ? parseInt(raw.annotationCount, 10) || 0 
    : Number(raw.annotationCount) || 0;

  // Narrow and validate the type discriminator string safely
  let type: TaskType = "unknown";
  if (raw.type === "image" || raw.type === "audio" || raw.type === "text") {
    type = raw.type;
  }

  const baseTask: BaseNormalizedTask = {
    id: String(raw.id),
    title: String(raw.title || `Task ${raw.id}`),
    status: normalizeStatus(String(raw.status || "")),
    assignee: raw.assignee && raw.assignee.id ? { id: String(raw.assignee.id), name: String(raw.assignee.name || "") } : null,
    annotationCount,
    updatedAt: normalizeTimestamp(raw.updatedAt),
    meta: raw.meta && typeof raw.meta === "object" ? raw.meta : {},
  };

  return { ...baseTask, type } as NormalizedTask;
}

// XSS sanitization
export function sanitizeContent(untrustedHtmlOrMarkdown: string): string {
  return DOMPurify.sanitize(untrustedHtmlOrMarkdown, {
    ALLOWED_TAGS: ["h1", "h2", "h3", "p", "ul", "ol", "li", "strong", "em", "code", "pre", "span"],
    ALLOWED_ATTR: ["class"], // Keep it clean for styling, reject event handlers like onerror
  });
}