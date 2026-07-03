# Architecture & Design Decisions: Annotation Activity Console

This document outlines the core technical decisions, architectural design, and security frameworks implemented across the lifecycle of the Annotation Activity Console.

1. Domain Mapping & Strict Data Normalization:
The Challenge: The backend data stream emits unpredictable data shapes, alternating between ISO string dates and raw epoch millisecond numbers, while representing task tracking statuses as dissimlar string variations.

The Decision: Established a strict structural mapping boundary at the immediate network layer using utility pipelines (normalize.ts). All raw variations are forcefully coerced into explicit TypeScript Enums (TaskStatus) and consistent numeric formats (number for unix epochs) before touching the application state.

Security frameworks: To prevent Cross-Site Scripting (XSS) injections via malicious payloads hidden inside raw markdown descriptions, implemented strict client-side HTML sanitization using DOMPurify immediately prior to layout injections.

2. Normalized Redux State Architecture:
The Challenge: Managing rapid data injections from high-frequency real-time streams can easily degrade layout rendering, leading to slow updates, and accidental UI stutter.

The Decision: Implemented a normalized state engine leveraging Redux Toolkit's createEntityAdapter.
- Performance Impact: Tasks are indexed inside a flat lookup hash map (ids array and an entities object dictionary). This guarantees $O(1)$ time complexity for updates, streaming upserts, and lookups.
- Memoized Query Selectors: I utilized createSelector from Reselect to process search filter variations and sorting weights. This ensures that the UI components only re-render if their specific, isolated segment of computed state changes, preventing wasteful rendering loop cycles.

3. Resilient WebSocket Live Ingestion Subsystem:
The Challenge: Handling persistent streaming channels requires handling unexpected disconnects, mid-stream interruptions, and out-of-bounds tasks that have not yet been paginated into the core Redux index.

The Decision: Built a custom React hook engine (useTaskFeed) containing an automated, exponential backoff re-connection loop. If an incoming WebSocket payload updates an entity that doesn't exist locally in our cached table view yet, it handles it safely rather than throwing runtime errors, ensuring absolute stream stability.

4. Asynchronous Offline Caching Layer:
The Challenge: Blocking the main thread with heavy synchronous reads or writes to local storage will cause visible UI lag and dropped animation frames.

The Decision: Implemented an asynchronous cache service utilizing localforage backed by the browser's IndexedDB engine.
- Hydration Pipeline: On application boot, the dashboard checks IndexedDB and instantly paints the user interface using the cached session snapshot (hydrateFromCache). It then fires off a silent background network request (fetchTasksPage) to gracefully reconcile variations with the server, enabling an instantaneous, offline-ready experience.

5. Viewport-Pinned Drawer UX Layout Architecture:
The Challenge: Traditional split-screen master-detail views collapse poorly, create awkward whitespace columns, and waste horizontal screen economy.

The Decision: Transitioned the application layout into a Viewport-Pinned Drawer Architecture.The primary task matrix workspace scales to 100% width initially, optimizing layout density and column breathing room.Selecting a task triggers a smooth hardware-accelerated CSS sidebar drawer transition, overlaying detail fields right over the workspace margins.

- Stream Management: The detail stream engine leverages native AbortController hooks to cleanly terminate active readable stream connections mid-flight if a user toggles between multiple task items rapidly, preventing memory leaks and mixed-data stream contamination.

6. Jest for Testing Strategy:
The Challenge: Environmental dependency blocks (like downstream ESM modules inside HTML sanitizers) can throw path-resolution errors inside standard runtime testing environments.

The Decision: Implemented strict test isolation by mocking the underlying isomorphic-dompurify package configuration at the module boundary. This isolates the data transformation logic (normalizeStatus, normalizeTimestamp, normalizeTask) away from environmental quirks, ensuring fast execution and predictable unit testing metrics. 

# Summary of the Completed Technology Stack Framework: 
Next.js: Frontend Layout
State Management: Redux Toolkit + Memoized Selectors (createEntityAdapter)
Real-time Layer: WebSockets (Auto-Reconnecting Client Stream)
Caching Engine: IndexedDB via localforage (Asynchronous off-thread hydration)
Security: DOMPurify HTML Sanitization Matrix
Testing Suite: Jest + ts-jest Compiler Pipeline