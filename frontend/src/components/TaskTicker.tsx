"use client";

import { useEffect, useState } from "react";

type Task = { id: string; title: string; updatedAt: number };

export function TaskTicker({ apiBase }: { apiBase: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tick, setTick] = useState<number>(0);

  // BUG RESOLVED: Fixed stale closure by using a functional state updater
  useEffect(() => {
    const id = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // BUG RESOLVED: Added guard condition for null IDs, handled apiBase dependencies, and addressed race conditions
  useEffect(() => {
    if (!selectedId) return;

    let active = true;
    const controller = new AbortController();

    fetch(`${apiBase}/api/tasks/${selectedId}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Task target endpoint unreachable.");
        return r.json();
      })
      .then((t) => {
        if (!active) return;
        
        // BUG RESOLVED: Prevented direct state mutation and filtered out duplicate IDs safely
        setTasks((prev) => {
          const filtered = prev.filter((item) => item.id !== t.id);
          return [...filtered, { id: t.id, title: t.title, updatedAt: typeof t.updatedAt === "string" ? Date.parse(t.updatedAt) : t.updatedAt }];
        });
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedId, apiBase]);

  // BUG RESOLVED: Implemented safe shallow-copy arrays prior to execute sorting routines during render phases
  const sorted = [...tasks].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="p-4 bg-gray-950 border border-gray-800 rounded-lg max-h-[30vh] overflow-y-auto">
      <h3 className="text-xs font-mono uppercase tracking-wider text-gray-400 mb-2">Live Recent Activity Pulse (Ticker)</h3>
      {sorted.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No recently clicked inspection entries tracked yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((t) => (
            // BUG RESOLVED: Replaced indices keys with unique strings identifiers
            <li 
              key={t.id} 
              onClick={() => setSelectedId(t.id)}
              className={`text-xs font-mono cursor-pointer p-1.5 rounded transition ${selectedId === t.id ? "bg-blue-900/40 text-blue-300 border border-blue-800" : "bg-gray-900 hover:bg-gray-800 text-gray-300"}`}
            >
              {t.title} (updated {Math.max(0, Math.floor((Date.now() - t.updatedAt) / 1000))}s ago)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}