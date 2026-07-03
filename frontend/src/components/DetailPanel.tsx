"use client";

import { useEffect, useState, useRef } from "react";
import { NormalizedTask, sanitizeContent } from "../utils/normalize";
import { useAppDispatch } from "../store";
import { setSelectedTaskId } from "../store/tasksSlice";
import { marked } from "marked";

interface DetailPanelProps {
  task: NormalizedTask | null;
}

export default function DetailPanel({ task }: DetailPanelProps) {
  const dispatch = useAppDispatch();
  const [summary, setSummary] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSummary("");
    setStreamError(null);
    setIsStreaming(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!task) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);

    async function readStream() {
      try {
        const response = await fetch(`http://localhost:4000/api/tasks/${task?.id}/summary`, {
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Stream network check failed: ${response.status}`);
        const reader = response.body?.getReader();
        if (!reader) throw new Error("ReadableStream is completely unavailable on this channel.");

        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            if (cleanLine.startsWith("data: ")) {
              try {
                const jsonStr = cleanLine.replace("data: ", "");
                if (jsonStr === "end") {
                  setIsStreaming(false);
                  continue;
                }
                const parsedChunk = JSON.parse(jsonStr);
                setSummary((prev) => prev + parsedChunk);
              } catch (e) {
                const rawChunk = cleanLine.substring(6);
                setSummary((prev) => prev + rawChunk);
              }
            } else if (cleanLine === "event: done") {
              setIsStreaming(false);
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setStreamError(err.message || "An error occurred while streaming the summary details.");
        setIsStreaming(false);
      }
    }

    readStream();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [task]);

  // If no task selected outer container handle its transition natively off-screen safely
  if (!task) return null;

  const parsedMarkdownHtml = marked.parse(summary) as string;
  const sanitizedHtmlHtml = sanitizeContent(parsedMarkdownHtml);

  return (
    <div className="flex flex-col h-full text-gray-100 font-sans select-none">
      
      {/* DRAWER PINNED ANCHORED HEADER CLOSET PANEL */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-950 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">
            {task.type}
          </span>
          <span className="text-xs font-mono text-gray-400">ID: {task.id}</span>
        </div>
        
        {/* INTERACTIVE CLOSING ACTION LINK BUTTON */}
        <button 
          onClick={() => dispatch(setSelectedTaskId(null))}
          className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition text-sm font-bold"
          title="Close Panel"
        >
          ✕
        </button>
      </div>

      {/* SCROLLABLE PANEL INTERIOR CONTAINER BODY */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-900/40">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{task.title}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-b border-gray-800/80 py-4 text-xs font-mono">
          <div>
            <span className="text-gray-400 block mb-0.5 uppercase tracking-wider text-[10px]">Status</span>
            <span className="font-semibold text-yellow-400 uppercase">{task.status}</span>
          </div>
          <div>
            <span className="text-gray-400 block mb-0.5 uppercase tracking-wider text-[10px]">Annotations</span>
            <span className="font-semibold text-green-400">{task.annotationCount} units</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-400 block mb-0.5 uppercase tracking-wider text-[10px]">Engineer Assignee</span>
            <span className="font-medium text-white">{task.assignee ? task.assignee.name : "Not available"}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase font-mono tracking-wider text-white">AI Summary Profile</h3>
            {isStreaming && (
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
              </span>
            )}
          </div>

          {streamError && (
            <div className="p-3 bg-red-900/30 border border-red-800 text-red-300 text-xs rounded font-mono">
              {streamError}
            </div>
          )}

          <div 
            className="prose prose-invert max-w-none text-gray-300 space-y-2 text-xs leading-relaxed border border-gray-800/60 bg-gray-950/40 p-4 rounded-md font-sans"
            dangerouslySetInnerHTML={{ __html: sanitizedHtmlHtml || "<p className='text-gray-500 italic'>Awaiting stream frames...</p>" }}
          />
        </div>
      </div>
    </div>
  );
}