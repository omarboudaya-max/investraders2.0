import { Search, Bell, Settings, Sun, Moon, LogOut, User } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'

export default function TopHeader() {
  const { profile } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const dropdownRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }
  
  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6 flex-shrink-0 relative z-50">
      <div className="flex items-center bg-muted px-3 py-2 rounded-md w-96">
        <Search size={18} className="text-muted-foreground mr-2" />
        <input 
          type="text" 
          placeholder="Search network, spaces, or courses..." 
          className="bg-transparent border-none outline-none text-sm w-full text-foreground"
        />
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-muted"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="text-muted-foreground hover:text-foreground relative p-2 rounded-full hover:bg-muted transition-colors"
          >
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-xl py-2 z-50">
              <div className="px-4 py-2 border-b border-border">
                <h3 className="font-bold text-foreground">Notifications</h3>
              </div>
              <div className="flex flex-col max-h-80 overflow-y-auto">
                <div className="px-4 py-3 hover:bg-muted cursor-pointer transition-colors border-b border-border">
                  <p className="text-sm text-foreground"><strong>Sarah Jenkins</strong> liked your post.</p>
                  <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
                </div>
                <div className="px-4 py-3 hover:bg-muted cursor-pointer transition-colors border-b border-border">
                  <p className="text-sm text-foreground"><strong>Marcus Doe</strong> viewed your profile.</p>
                  <p className="text-xs text-muted-foreground mt-1">5 hours ago</p>
                </div>
                <div className="px-4 py-3 hover:bg-muted cursor-pointer transition-colors">
                  <p className="text-sm text-foreground">System: Platform upgrade complete. Welcome to v2.0!</p>
                  <p className="text-xs text-muted-foreground mt-1">1 day ago</p>
                </div>
              </div>
              <div className="px-4 py-2 border-t border-border text-center">
                <button className="text-sm text-primary font-semibold hover:underline">Mark all as read</button>
              </div>
            </div>
          )}
        </div>
        
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 hover:bg-muted p-1 pr-3 rounded-full transition-colors"
          >
            <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
              {profile?.first_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <Settings size={18} className="text-muted-foreground" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-lg overflow-hidden py-1 z-50">
              <div className="px-4 py-2 border-b border-border">
                <p className="text-sm font-semibold text-foreground">{profile?.first_name} {profile?.last_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
              </div>
              
              <a href="#profile" className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                <User size={16} /> My Profile
              </a>
              <a href="#settings" className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                <Settings size={16} /> Preferences
              </a>
              
              <div className="border-t border-border mt-1 pt-1">
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 w-full text-left transition-colors"
                >
                  <LogOut size={16} /> Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
