"use client";

import { useEffect, useState } from "react";

type Task = { id: string; title: string; updatedAt: number };

export function TaskTicker({ apiBase, selectedTaskId }: { apiBase: string; selectedTaskId: string | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tick, setTick] = useState<number>(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedTaskId) return;

    let active = true;
    const controller = new AbortController();

    fetch(`${apiBase}/api/tasks/${selectedTaskId}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Task target endpoint unreachable.");
        return r.json();
      })
      .then((t) => {
        if (!active) return;
        
        setTasks((prev) => {
          const filtered = prev.filter((item) => item.id !== t.id);
          return [...filtered, { 
            id: t.id, 
            title: t.title, 
            updatedAt: typeof t.updatedAt === "string" ? Date.parse(t.updatedAt) : t.updatedAt 
          }];
        });
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedTaskId, apiBase]); 

  const sorted = [...tasks].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="p-4 bg-gray-950 border border-gray-800 rounded-lg max-h-[30vh] overflow-y-auto">
      <h3 className="text-xs font-mono uppercase tracking-wider text-gray-400 mb-2">Live Recent Activity Ticker</h3>
      {sorted.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No tasks recently clicked yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((t) => (
            <li 
              key={t.id} 
              className={`text-xs font-mono p-1.5 rounded transition ${selectedTaskId === t.id ? "bg-blue-900/40 text-blue-300 border border-blue-800" : "bg-gray-900 text-gray-300"}`}
            >
              {t.title} (updated {Math.max(0, Math.floor((Date.now() - t.updatedAt) / 1000))}s ago)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}