import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store";
import {
  updateTaskStatusFromStream,
  updateTaskAssigneeFromStream,
  incrementAnnotationCountFromStream,
  upsertTaskFromStream,
  selectAllTasks,
} from "../store/tasksSlice";
import { normalizeStatus, TaskStatus, NormalizedTask } from "../utils/normalize";

// Define incoming strict structural shapes for WebSocket events
type WebSocketEvent =
  | { kind: "task.updated"; payload: { id: string; status: string; updatedAt: number } }
  | { kind: "task.assigned"; payload: { id: string; assignee: { id: string; name: string } | null } }
  | { kind: "annotation.created"; payload: { taskId: string; by: string; at: number } };

export function useTaskFeed(wsUrl: string = "ws://localhost:4000/ws") {
  const dispatch = useAppDispatch();
  const tasks = useAppSelector(selectAllTasks);
  const [isConnected, setIsConnected] = useState(false);
  
  // Use a ref to keep track of active tasks for immediate O(1) checks inside the message handler closure
  const existingTaskIdsRef = useRef<Set<string>>(new Set());
  
  // Keep our tracking cache synchronized with current store keys
  useEffect(() => {
    existingTaskIdsRef.current = new Set(tasks.map((t) => t.id));
  }, [tasks]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;
    let reconnectDelay = 1000; // Initial delay of 1 second

    function connect() {
      if (socket) return;

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setIsConnected(true);
        reconnectDelay = 1000; // Reset exponential backoff delay on successful connection
      };

      socket.onmessage = (event) => {
        try {
          const rawData: WebSocketEvent = JSON.parse(event.data);
          if (!rawData || !rawData.kind) return;

          const targetId = rawData.kind === "annotation.created" ? rawData.payload.taskId : rawData.payload.id;
          const taskExistsLocally = existingTaskIdsRef.current.has(targetId);

          // Handle updates for missing/out-of-bounds tasks
          if (!taskExistsLocally) {
            const basicShellTask: NormalizedTask = {
              id: targetId,
              title: `Task ${targetId} (Discovered Live)`,
              type: "unknown",
              status: TaskStatus.UNKNOWN,
              assignee: null,
              annotationCount: 0,
              updatedAt: Date.now(),
              meta: { discoveredViaStream: true },
            };
            dispatch(upsertTaskFromStream(basicShellTask));
          }

          // Process the event actions cleanly based on 'kind'
          switch (rawData.kind) {
            case "task.updated":
              dispatch(
                updateTaskStatusFromStream({
                  id: rawData.payload.id,
                  status: normalizeStatus(rawData.payload.status),
                  updatedAt: rawData.payload.updatedAt,
                })
              );
              break;

            case "task.assigned":
              dispatch(
                updateTaskAssigneeFromStream({
                  id: rawData.payload.id,
                  assignee: rawData.payload.assignee,
                })
              );
              break;

            case "annotation.created":
              dispatch(incrementAnnotationCountFromStream({ taskId: rawData.payload.taskId }));
              break;

            default:
              break;
          }
        } catch (err) {
          console.error("Malformed or unhandled WebSocket streaming message frame error:", err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        socket = null;
        
        // Execute Exponential Backoff Auto-Reconnection sequence
        reconnectTimeoutId = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, 30000); // Cap the delay at 30 seconds max
          connect();
        }, reconnectDelay);
      };

      socket.onerror = (error) => {
        // WebSocket drops will automatically fire onclose, let that drive the reconnect sequence
        console.error("WebSocket runtime connection link failure emitted:", error);
      };
    }

    connect();

    // Clean up connections on unmount to prevent memory leaks and dangling sockets
    return () => {
      setIsConnected(false);
      if (socket) {
        socket.onclose = null; // Unbind the listener first to prevent accidental immediate reconnect calls
        socket.close();
      }
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
    };
  }, [wsUrl, dispatch]);

  return { isConnected };
}