import { createSlice, createAsyncThunk, createEntityAdapter, createSelector, PayloadAction } from "@reduxjs/toolkit";
import { NormalizedTask, normalizeTask, TaskStatus } from "../utils/normalize";

// Setup the high-performance Entity Adapter
export const tasksAdapter = createEntityAdapter<NormalizedTask>({
  sortComparer: (a, b) => b.updatedAt - a.updatedAt,
});

// the extended state shape for pagination and UI filtering criteria
export interface TasksState extends ReturnType<typeof tasksAdapter.getInitialState> {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  loading: boolean;
  error: string | null;
  selectedTaskId: string | null;
  filters: {
    type: string; 
    status: string; 
    searchQuery: string;
  };
  sorting: {
    sortBy: "updatedAt" | "annotationCount";
    sortOrder: "asc" | "desc";
  };
}

const initialState: TasksState = tasksAdapter.getInitialState({
  currentPage: 1,
  pageSize: 20,
  totalItems: 0,
  loading: false,
  error: null,
  selectedTaskId: null,
  filters: {
    type: "all",
    status: "all",
    searchQuery: "",
  },
  sorting: {
    sortBy: "updatedAt",
    sortOrder: "desc",
  },
});

// the asynchronous Redux Thunk for server-side pagination
export const fetchTasksPage = createAsyncThunk(
  "tasks/fetchPage",
  async ({ page, pageSize }: { page: number; pageSize: number }, { rejectWithValue }) => {
    try {
      const response = await fetch(`http://localhost:4000/api/tasks?page=${page}&pageSize=${pageSize}`);
      if (!response.ok) {
        throw new Error(`HTTP error code status: ${response.status}`);
      }
      const data = await response.json();
      
      // Normalize raw payload arrays immediately at the boundary
      const normalizedItems = data.items.map((rawItem: any) => normalizeTask(rawItem));
      
      return {
        items: normalizedItems,
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to query server tasks task logs.");
    }
  }
);

// Create the Slice
const tasksSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<Partial<TasksState["filters"]>>) {
      state.filters = { ...state.filters, ...action.payload };
      state.currentPage = 1; // Reset to page 1 on active filter changes
    },
    setSorting(state, action: PayloadAction<TasksState["sorting"]>) {
      state.sorting = action.payload;
    },
    setCurrentPage(state, action: PayloadAction<number>) {
      state.currentPage = action.payload;
    },
    setSelectedTaskId(state, action: PayloadAction<string | null>) {
      state.selectedTaskId = action.payload;
    },
    // WebSocket Real-time action hooks
    upsertTaskFromStream(state, action: PayloadAction<NormalizedTask>) {
      tasksAdapter.upsertOne(state, action.payload);
    },
    updateTaskStatusFromStream(state, action: PayloadAction<{ id: string; status: TaskStatus; updatedAt: number }>) {
      tasksAdapter.updateOne(state, {
        id: action.payload.id,
        changes: {
          status: action.payload.status,
          updatedAt: action.payload.updatedAt,
        },
      });
    },
    updateTaskAssigneeFromStream(state, action: PayloadAction<{ id: string; assignee: NormalizedTask["assignee"] }>) {
      tasksAdapter.updateOne(state, {
        id: action.payload.id,
        changes: { assignee: action.payload.assignee },
      });
    },
    incrementAnnotationCountFromStream(state, action: PayloadAction<{ taskId: string }>) {
      const existing = state.entities[action.payload.taskId];
      if (existing) {
        tasksAdapter.updateOne(state, {
          id: action.payload.taskId,
          changes: { annotationCount: existing.annotationCount + 1 },
        });
      }
    },
    // Hydrate slice safely from IndexedDB Cache on startup
    hydrateFromCache(state, action: PayloadAction<NormalizedTask[]>) {
      tasksAdapter.setAll(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTasksPage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTasksPage.fulfilled, (state, action) => {
        state.loading = false;
        state.totalItems = action.payload.total;
        state.currentPage = action.payload.page;
        state.pageSize = action.payload.pageSize;
        // setAll wipes old paginated views cleanly and swaps in fresh entities
        tasksAdapter.setAll(state, action.payload.items);
      })
      .addCase(fetchTasksPage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
    },
});

export const {
  setFilters,
  setSorting,
  setCurrentPage,
  setSelectedTaskId,
  upsertTaskFromStream,
  updateTaskStatusFromStream,
  updateTaskAssigneeFromStream,
  incrementAnnotationCountFromStream,
  hydrateFromCache,
} = tasksSlice.actions;

export default tasksSlice.reducer;

// High performance memoized selectors
const selectSelf = (state: { tasks: TasksState }) => state.tasks;

// Extract core built-in adapter entities lookup tables
const adapterSelectors = tasksAdapter.getSelectors(selectSelf);
export const selectAllTasks = adapterSelectors.selectAll;
export const selectTaskById = (state: { tasks: TasksState }, id: string) => adapterSelectors.selectById(state, id);

export const selectTasksFilters = createSelector(selectSelf, (state) => state.filters);
export const selectTasksSorting = createSelector(selectSelf, (state) => state.sorting);
export const selectSelectedTaskId = createSelector(selectSelf, (state) => state.selectedTaskId);
export const selectTasksMetadata = createSelector(selectSelf, (state) => ({
  loading: state.loading,
  error: state.error,
  currentPage: state.currentPage,
  pageSize: state.pageSize,
  totalItems: state.totalItems,
}));

// Returns the fully realized active selected task object profile
export const selectSelectedTask = createSelector(
  [selectSelf, (state: { tasks: TasksState }) => state.tasks.selectedTaskId],
  (state, selectedId) => (selectedId ? state.entities[selectedId] || null : null)
);

// Processes filter sorting logic without causing UI recalculation loops
export const selectFilteredAndSortedTasks = createSelector(
  [selectAllTasks, selectTasksFilters, selectTasksSorting],
  (tasks, filters, sorting) => {
    let result = [...tasks];

    // Text Search Filter Matching ID or Title match
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) => t.title.toLowerCase().includes(query) || t.id.toLowerCase().includes(query)
      );
    }

    // Type Multi-Criteria Filter Matching
    if (filters.type !== "all") {
      result = result.filter((t) => t.type === filters.type);
    }

    // Status Multi-Criteria Filter Matching
    if (filters.status !== "all") {
      result = result.filter((t) => t.status === filters.status);
    }

    // Fine-grained sorting math execution block
    result.sort((a, b) => {
      let comparison = 0;
      if (sorting.sortBy === "updatedAt") {
        comparison = a.updatedAt - b.updatedAt;
      } else if (sorting.sortBy === "annotationCount") {
        comparison = a.annotationCount - b.annotationCount;
      }

      return sorting.sortOrder === "desc" ? -comparison : comparison;
    });

    return result;
  }
);