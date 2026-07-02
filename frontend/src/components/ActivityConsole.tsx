"use client";

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store";
import { 
  fetchTasksPage, 
  setFilters, 
  setSorting, 
  setSelectedTaskId, 
  setCurrentPage, 
  selectFilteredAndSortedTasks, 
  selectTasksFilters, 
  selectTasksSorting, 
  selectTasksMetadata,
  selectSelectedTask,
  hydrateFromCache
} from "../store/tasksSlice";
import { useTaskFeed } from "../hooks/useTaskFeed";
import { loadTasksFromCache } from "../services/cacheService";
import DetailPanel from "./DetailPanel";
import { TaskTicker } from "./TaskTicker";

export default function ActivityConsole() {
  const dispatch = useAppDispatch();
  const { isConnected } = useTaskFeed(); // Activate the live stream feed socket
  
  const tasks = useAppSelector(selectFilteredAndSortedTasks);
  const filters = useAppSelector(selectTasksFilters);
  const sorting = useAppSelector(selectTasksSorting);
  const metadata = useAppSelector(selectTasksMetadata);
  const selectedTask = useAppSelector(selectSelectedTask);

  const [isCacheLoaded, setIsCacheLoaded] = useState(false);

  // 1. Initial boot: Hydrate from IndexedDB immediately, then query fresh server logs
  useEffect(() => {
    async function prepareState() {
      const cached = await loadTasksFromCache();
      if (cached && cached.tasks.length > 0) {
        dispatch(hydrateFromCache(cached.tasks));
        setIsCacheLoaded(true);
      }
      // Revalidate records from the server in the background
      dispatch(fetchTasksPage({ page: metadata.currentPage, pageSize: metadata.pageSize }));
    }
    prepareState();
  }, [dispatch]);

  // Fetch a new page whenever the pagination parameters change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(metadata.totalItems / metadata.pageSize)) return;
    dispatch(setCurrentPage(newPage));
    dispatch(fetchTasksPage({ page: newPage, pageSize: metadata.pageSize }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 max-w-[1600px] mx-auto min-h-screen bg-black text-gray-100 antialiased">
      
      {/* LEFT GRID: Main Datatable Matrix Workspace */}
      <div className="lg:col-span-2 space-y-4 flex flex-col">
        
        {/* HEADER BRANDING CARD */}
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white font-sans">Annotation Activity Console</h1>
            <p className="text-xs text-gray-400 mt-0.5">Strict Typed State Infrastructure Operational Panel</p>
          </div>
          
          {/* NETWORKS INTERACTIVE SIGNALS */}
          <div className="flex items-center gap-3 text-xs font-mono">
            {isCacheLoaded && metadata.loading && (
              <span className="px-2 py-1 rounded bg-yellow-950 text-yellow-400 border border-yellow-800 text-[11px] animate-pulse">
                Revalidating Server Logs...
              </span>
            )}
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded border ${isConnected ? "bg-green-950/40 text-green-400 border-green-800" : "bg-red-950/40 text-red-400 border-red-800"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-500"}`} />
              WS: {isConnected ? "CONNECTED" : "DISCONNECTED"}
            </div>
          </div>
        </div>

        {/* SEARCH & FILTER CONTROLS HUB */}
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Search matching token ID or title..."
            value={filters.searchQuery}
            onChange={(e) => dispatch(setFilters({ searchQuery: e.target.value }))}
            className="bg-gray-950 text-sm border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-600 transition"
          />
          <select
            value={filters.type}
            onChange={(e) => dispatch(setFilters({ type: e.target.value }))}
            className="bg-gray-950 text-sm border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="all">Filter Type: All Formats</option>
            <option value="image">Image Vectors</option>
            <option value="audio">Audio Waveforms</option>
            <option value="text">Text Logs</option>
            <option value="unknown">Unknown Outliers</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => dispatch(setFilters({ status: e.target.value }))}
            className="bg-gray-950 text-sm border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="all">Filter Status: All Blocks</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="qa">Quality Assurance</option>
            <option value="done">Completed (Done)</option>
            <option value="blocked">Blocked Entries</option>
          </select>
        </div>

        {/* TASK MATRIX DATA-TABLE PANEL */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden flex-1 flex flex-col justify-between">
          <div className="overflow-x-auto min-h-100">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-950 border-b border-gray-800 font-mono text-xs text-gray-400 uppercase">
                  <th className="p-3">Identifier</th>
                  <th className="p-3">Task Meta Title</th>
                  <th className="p-3 cursor-pointer hover:text-white transition" onClick={() => dispatch(setSorting({ sortBy: "annotationCount", sortOrder: sorting.sortOrder === "desc" ? "asc" : "desc" }))}>
                    Annotations {sorting.sortBy === "annotationCount" ? (sorting.sortOrder === "desc" ? "▼" : "▲") : "↕"}
                  </th>
                  <th className="p-3">Assignee</th>
                  <th className="p-3 cursor-pointer hover:text-white transition" onClick={() => dispatch(setSorting({ sortBy: "updatedAt", sortOrder: sorting.sortOrder === "desc" ? "asc" : "desc" }))}>
                    Last Synchronized {sorting.sortBy === "updatedAt" ? (sorting.sortOrder === "desc" ? "▼" : "▲") : "↕"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-sans">
                {metadata.loading && tasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-12 text-gray-500 italic font-mono">
                      Requesting server frame packets...
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-12 text-gray-500 italic font-mono">
                      No contextual tasks match current query descriptors.
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => dispatch(setSelectedTaskId(task.id))}
                      className={`cursor-pointer transition-colors ${selectedTask?.id === task.id ? "bg-blue-950/40 hover:bg-blue-950/50" : "hover:bg-gray-800/50"} border-b border-gray-800/40`}
                    >
                      <td className="p-3 font-mono text-xs text-blue-400 font-bold">{task.id}</td>
                      <td className="p-3 font-medium text-white max-w-50 truncate">{task.title}</td>
                      <td className="p-3 font-mono text-green-400 font-semibold">{task.annotationCount}</td>
                      <td className="p-3 text-gray-300 text-xs">{task.assignee ? task.assignee.name : <span className="text-gray-600 italic">Open Queue</span>}</td>
                      <td className="p-3 font-mono text-xs text-gray-400">{new Date(task.updatedAt).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* SERVER PAGINATION ACTION CONTROL FEET */}
          <div className="bg-gray-950 border-t border-gray-800 p-3 flex items-center justify-between text-xs font-mono">
            <button
              disabled={metadata.currentPage === 1 || metadata.loading}
              onClick={() => handlePageChange(metadata.currentPage - 1)}
              className="px-3 py-1.5 rounded bg-gray-900 border border-gray-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-800 transition"
            >
              ◀ Previous Page
            </button>
            <span className="text-gray-400">
              Page {metadata.currentPage} / {Math.ceil(metadata.totalItems / metadata.pageSize) || 1}
            </span>
            <button
              disabled={metadata.currentPage >= Math.ceil(metadata.totalItems / metadata.pageSize) || metadata.loading}
              onClick={() => handlePageChange(metadata.currentPage + 1)}
              className="px-3 py-1.5 rounded bg-gray-900 border border-gray-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-800 transition"
            >
              Next Page ▶
            </button>
          </div>
        </div>

        {/* CLEANED TEAM TICKER PULSE INJECTOR */}
        <TaskTicker apiBase="http://localhost:4000" />
      </div>

      {/* RIGHT GRID: Master Detail Target Stream Viewer Panel */}
      <div className="h-full">
        <DetailPanel task={selectedTask} />
      </div>
    </div>
  );
}