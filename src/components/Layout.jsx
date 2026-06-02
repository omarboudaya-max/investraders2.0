import { Outlet } from 'react-router-dom'
import TopHeader from './TopHeader'
import { useAuth } from '../contexts/AuthContext'
import Auth from '../pages/Auth'

export default function Layout() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background text-foreground">Loading...</div>
  }

  if (!user) {
    return <Auth />
  }

  return (
    <div className="flex flex-col min-h-screen w-screen bg-background text-foreground overflow-x-hidden">
      <TopHeader />
      <main className="flex-1 w-full pt-28 pb-12 px-6">
        <div className="max-w-7xl mx-auto h-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
