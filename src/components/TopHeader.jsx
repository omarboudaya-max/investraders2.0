import { Search, Bell, Settings, Sun, Moon, LogOut, MessageSquare, Menu, User } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'

export default function TopHeader() {
  const { profile } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const dropdownRef = useRef(null)
  const notifRef = useRef(null)
  const location = useLocation()

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
    <div className="w-full flex justify-center pt-6 px-6 fixed top-0 z-50">
      <header className="w-full max-w-7xl h-16 bg-card/80 backdrop-blur-xl border border-border/50 rounded-full flex items-center justify-between px-6 shadow-sm">
        
        {/* Left: Logo & Links */}
        <div className="flex items-center gap-8">
          <Link to="/" className="font-bold text-xl text-foreground flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-black">IN</span>
            </div>
            Investraders
          </Link>
          

        </div>
        
        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center bg-muted/50 px-3 py-1.5 rounded-full w-64 border border-border/50 transition-all focus-within:w-72 focus-within:border-primary/50 focus-within:bg-background">
            <Search size={16} className="text-muted-foreground mr-2" />
            <input 
              type="text" 
              placeholder="Search network..." 
              className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <button 
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-muted"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <Link to="/messages" className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-muted relative">
            <MessageSquare size={18} />
          </Link>

          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="text-muted-foreground hover:text-foreground relative p-2 rounded-full hover:bg-muted transition-colors"
            >
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full border-2 border-card"></span>
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-4 w-80 bg-card border border-border rounded-2xl shadow-xl py-2 z-50">
                <div className="px-4 py-2 border-b border-border">
                  <h3 className="font-bold text-foreground">Notifications</h3>
                </div>
                <div className="flex flex-col max-h-80 overflow-y-auto">
                  <div className="px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/50">
                    <p className="text-sm text-foreground"><strong>System</strong> Platform updated to v2.0!</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 hover:bg-muted p-1 pr-2 rounded-full transition-colors border border-transparent hover:border-border"
            >
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold shadow-md">
                {profile?.first_name?.charAt(0).toUpperCase() || 'U'}
              </div>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-4 w-56 bg-card border border-border rounded-2xl shadow-xl overflow-hidden py-1 z-50">
                <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                  <p className="text-sm font-bold text-foreground">{profile?.first_name} {profile?.last_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                </div>
                <div className="py-1">
                  <Link onClick={() => setShowDropdown(false)} to={`/profile/${profile?.id}`} className="flex items-center px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <User size={16} className="mr-3" /> Profile
                  </Link>
                  <button className="w-full flex items-center px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Settings size={16} className="mr-3" /> Settings
                  </button>
                </div>
                <div className="border-t border-border/50 py-1">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut size={16} className="mr-3" /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>

          <button className="md:hidden p-2 text-muted-foreground hover:text-foreground">
            <Menu size={20} />
          </button>
        </div>
      </header>
    </div>
  )
}
