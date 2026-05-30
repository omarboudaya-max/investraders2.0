import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopHeader from './TopHeader'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background text-foreground">Loading...</div>
  }

  // If not logged in, we could redirect, but for now we just show a login prompt
  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground">
        <h1 className="text-3xl font-bold text-primary mb-4">Investraders Auth Required</h1>
        <p>Please log in using the legacy landing page for now, or implement a new React Login page here.</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader />
        <main className="flex-1 overflow-y-auto bg-muted/20">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
