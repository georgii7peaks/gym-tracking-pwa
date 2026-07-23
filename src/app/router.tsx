// Route table (APP_SPECIFICATION.md §4, adapted to the design). Three tabs under
// a shared layout. Workouts is a history list (root) that opens the inline
// active-session screen at /workouts/:sessionId (design's combined session +
// tracking). The routes array is exported so tests can mount a memory router.
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout'
import { WorkoutsListScreen } from './routes/WorkoutsListScreen'
import { WorkoutScreen } from './routes/WorkoutScreen'
import { RoutinesPage } from './routes/RoutinesPage'
import { RoutineDayEditorPage } from './routes/RoutineDayEditorPage'
import { ProgressPage } from './routes/ProgressPage'
import { SettingsPage } from './routes/SettingsPage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/workouts" replace /> },
      { path: 'workouts', element: <WorkoutsListScreen /> },
      { path: 'workouts/:sessionId', element: <WorkoutScreen /> },
      { path: 'routines', element: <RoutinesPage /> },
      { path: 'routines/:dayId', element: <RoutineDayEditorPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/workouts" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
