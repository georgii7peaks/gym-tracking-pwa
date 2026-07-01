// Root layout: a scrollable content area above a persistent bottom tab bar.
// Mounts once for the app's lifetime, so it's also where the one-time Starter
// Program prompt (§5.9) lives — its launch check must run regardless of tab.
import { Outlet } from 'react-router-dom'
import { TabBar } from './TabBar'
import { StarterProgramPrompt } from '../routes/StarterProgramPrompt'
import { UpdateBanner } from '@/components/ui/UpdateBanner'

export function AppLayout() {
  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <TabBar />
      <StarterProgramPrompt />
      <UpdateBanner />
    </div>
  )
}
