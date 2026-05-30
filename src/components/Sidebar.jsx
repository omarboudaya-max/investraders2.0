import { Link, useLocation } from 'react-router-dom'
import { Home, Users, Calendar, Folder, BookOpen, MessageSquare, Bot, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  
  const navItems = [
    { name: 'Feed', path: '/', icon: Home },
    { name: 'Community', path: '/community', icon: Users },
    { name: 'Events', path: '/events', icon: Calendar },
    { name: 'Directory', path: '/directory', icon: Folder },
    { name: 'Courses', path: '/courses', icon: BookOpen },
    { name: 'Messages', path: '/messages', icon: MessageSquare },
    { name: 'AI Agents', path: '/ai', icon: Bot },
  ]
  
  if (profile?.role === 'admin') {
    navItems.push({ name: 'Manage Audience', path: '/audience', icon: Users })
  }

  return (
    <aside className="w-64 border-r border-border bg-background flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-bold text-primary">Investraders</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-2 px-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.name}</span>
            </Link>
          )
        })}
      </div>
      <div className="p-4 border-t border-border">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 px-4 py-3 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  )
}
