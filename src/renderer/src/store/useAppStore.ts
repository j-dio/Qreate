/**
 * Global Application State (Zustand)
 *
 * This store holds app-wide state that needs to be accessed from multiple components.
 *
 * Why Zustand?
 * - Simple API (no boilerplate like Redux)
 * - TypeScript-first
 * - Small bundle size
 * - No Provider wrapping needed
 *
 * Usage:
 *   const user = useAppStore(state => state.user)
 *   const setUser = useAppStore(state => state.setUser)
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * User interface
 * Represents authenticated user data
 */
export interface User {
  id: string
  email: string
  name: string
  createdAt: string
  chatgptConnected: boolean
  googleDriveConnected: boolean
}

/**
 * API Credentials interface
 * Stores encrypted API keys and tokens
 * NOTE: In production, these should be encrypted before storage
 */
export interface ApiCredentials {
  openaiApiKey: string | null
  googleDriveToken: string | null
}

/**
 * Project interface
 * Represents a saved exam project
 */
export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  status: 'draft' | 'processing' | 'completed' | 'failed'
  filesCount: number
}

/**
 * App settings interface
 */
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  defaultDifficulty: {
    veryEasy: number
    easy: number
    moderate: number
    hard: number
    veryHard: number
  }
}

/**
 * App State interface
 * Defines the shape of our global state
 */
interface AppState {
  // State
  user: User | null
  projects: Project[]
  settings: AppSettings
  apiCredentials: ApiCredentials

  // Actions (functions that modify state)
  setUser: (user: User | null) => void
  updateUser: (updates: Partial<User>) => void
  addProject: (project: Project) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  updateSettings: (settings: Partial<AppSettings>) => void
  setApiCredentials: (credentials: Partial<ApiCredentials>) => void
}

/**
 * Create the Zustand store
 *
 * persist() middleware saves state to localStorage automatically
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      projects: [],
      settings: {
        theme: 'system',
        defaultDifficulty: {
          veryEasy: 20,
          easy: 20,
          moderate: 30,
          hard: 20,
          veryHard: 10,
        },
      },
      apiCredentials: {
        openaiApiKey: null,
        googleDriveToken: null,
      },

      // Actions
      setUser: (user) => set({ user }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      addProject: (project) =>
        set((state) => ({
          projects: [project, ...state.projects], // Add to beginning
        })),

      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        })),

      updateSettings: (settings) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),

      setApiCredentials: (credentials) =>
        set((state) => ({
          apiCredentials: { ...state.apiCredentials, ...credentials },
        })),
    }),
    {
      name: 'qreate-storage', // localStorage key
      storage: createJSONStorage(() => localStorage),
    }
  )
)
