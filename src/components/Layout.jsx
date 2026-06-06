import { Outlet, Link, useLocation } from 'react-router-dom'
import TopHeader from './TopHeader'
import { useAuth } from '../contexts/AuthContext'
import Auth from '../pages/Auth'
import { Home, Calendar, BookOpen, Users, MessageSquare, Bookmark } from 'lucide-react'

export default function Layout() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background text-foreground">Loading...</div>
  }

  if (!user) {
    return <Auth />
  }

  const navLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Events', path: '/events', icon: Calendar },
    { name: 'Courses', path: '/courses', icon: BookOpen },
    { name: 'Members', path: '/community', icon: Users },
    { name: 'Message', path: '/messages', icon: MessageSquare },
    { name: 'Save', path: '/save', icon: Bookmark },
  ]

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
      <TopHeader />
      <main className="flex-1 w-full pt-28 px-6 h-full min-h-0">
        <div className="max-w-7xl mx-auto h-full flex gap-6 items-start">
          {/* Left Sidebar Navigation */}
          <aside className="hidden md:flex flex-col w-56 flex-shrink-0 gap-2 h-full overflow-y-auto no-scrollbar pb-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path
              const Icon = link.icon
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors font-semibold text-sm ${
                    isActive 
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'} />
                  {link.name}
                </Link>
              )
            })}
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0 h-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
