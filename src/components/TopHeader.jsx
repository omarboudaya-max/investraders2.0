import { Search, Bell, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function TopHeader() {
  const { profile } = useAuth()
  
  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6">
      <div className="flex items-center bg-muted px-3 py-2 rounded-md w-96">
        <Search size={18} className="text-muted-foreground mr-2" />
        <input 
          type="text" 
          placeholder="Search network, spaces, or courses..." 
          className="bg-transparent border-none outline-none text-sm w-full text-foreground"
        />
      </div>
      
      <div className="flex items-center gap-4">
        <button className="text-muted-foreground hover:text-foreground relative">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full"></span>
        </button>
        <button className="text-muted-foreground hover:text-foreground">
          <Settings size={20} />
        </button>
        <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold ml-2">
          {profile?.first_name?.charAt(0).toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  )
}
