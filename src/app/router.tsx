// Route table (APP_SPECIFICATION.md §4). Three tabs under a shared layout; each
// tab is its own stack (Workouts and Routines have nested detail routes). The
// routes array is exported so tests can mount a memory router over the same tree.
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout'
import { WorkoutsPage } from './routes/WorkoutsPage'
import { SessionDetailPage } from './routes/SessionDetailPage'
import { ExerciseTrackingPage } from './routes/ExerciseTrackingPage'
import { RoutinesPage } from './routes/RoutinesPage'
import { RoutineDayEditorPage } from './routes/RoutineDayEditorPage'
import { SettingsPage } from './routes/SettingsPage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/workouts" replace /> },
      { path: 'workouts', element: <WorkoutsPage /> },
      { path: 'workouts/:sessionId', element: <SessionDetailPage /> },
      { path: 'workouts/:sessionId/exercises/:logId', element: <ExerciseTrackingPage /> },
      { path: 'routines', element: <RoutinesPage /> },
      { path: 'routines/:dayId', element: <RoutineDayEditorPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/workouts" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
