"use client";

import { useEffect, useState, useRef } from "react";
import { NormalizedTask, sanitizeContent } from "../utils/normalize";
import { marked } from "marked";

interface DetailPanelProps {
  task: NormalizedTask | null;
}

export default function DetailPanel({ task }: DetailPanelProps) {
  const [summary, setSummary] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // 1. Clear out previous panel state variables
    setSummary("");
    setStreamError(null);
    setIsStreaming(false);

    // Cancel the old stream if the user switches tasks mid-stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!task) return;

    // 2. Instantiate a fresh AbortController for this stream cycle
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
          
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            if (cleanLine.startsWith("data: ")) {
              try {
                const jsonStr = cleanLine.replace("data: ", "");
                // The backend sends a final confirmation chunk "end"
                if (jsonStr === "end") {
                  setIsStreaming(false);
                  continue;
                }
                const parsedChunk = JSON.parse(jsonStr);
                setSummary((prev) => prev + parsedChunk);
              } catch (e) {
                // Handle raw string fallbacks safely if parsing fails
                const rawChunk = cleanLine.substring(6);
                setSummary((prev) => prev + rawChunk);
              }
            } else if (cleanLine === "event: done") {
              setIsStreaming(false);
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          return; // Suppress state alerts for intentional cancellations
        }
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

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 italic bg-gray-900 border border-gray-800 rounded-lg p-6">
        Select a task from the workspace matrix to view metadata and AI tracking logs.
      </div>
    );
  }

  // Parse markdown syntax to raw HTML
  const parsedMarkdownHtml = marked.parse(summary) as string;
  // Apply our Phase 1 secure DOMPurify sanitization utility
  const sanitizedHtmlHtml = sanitizeContent(parsedMarkdownHtml);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-6 text-gray-100 max-h-[85vh] overflow-y-auto">
      <div>
        <span className="text-xs font-mono uppercase px-2 py-1 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">
          {task.type}
        </span>
        <h2 className="text-2xl font-bold text-white mt-2">{task.title}</h2>
        <p className="text-xs text-gray-400 mt-1 font-mono">System Identifier: {task.id}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-b border-gray-800 py-4 text-sm">
        <div>
          <span className="text-gray-400 block text-xs uppercase tracking-wider font-mono">Pipeline Status</span>
          <span className="font-semibold text-yellow-400 uppercase tracking-wide">{task.status}</span>
        </div>
        <div>
          <span className="text-gray-400 block text-xs uppercase tracking-wider font-mono">Annotation Count</span>
          <span className="font-semibold text-green-400">{task.annotationCount} units</span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-400 block text-xs uppercase tracking-wider font-mono">Assigned Engineer</span>
          <span className="font-medium text-white">{task.assignee ? task.assignee.name : "Unassigned Open Queue"}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-blue-400">AI-Generated Core Insights Summary</h3>
          {isStreaming && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
          )}
        </div>

        {streamError && (
          <div className="p-3 bg-red-900/30 border border-red-800 text-red-300 text-sm rounded">
            {streamError}
          </div>
        )}

        {/* Securely injected sanitized HTML node stream block */}
        <div 
          className="prose prose-invert max-w-none text-gray-300 space-y-2 text-sm leading-relaxed border border-gray-800/60 bg-gray-950/40 p-4 rounded-md font-sans"
          dangerouslySetInnerHTML={{ __html: sanitizedHtmlHtml || "<p className='text-gray-500 italic'>Awaiting content frames...</p>" }}
        />
      </div>
    </div>
  );
}