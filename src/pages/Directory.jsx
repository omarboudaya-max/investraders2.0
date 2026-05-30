import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, Mail, Filter, ShieldCheck, TrendingUp, Building } from 'lucide-react'

export default function Directory() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, founder, investor, admin

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error("Error fetching directory:", err)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(u => filter === 'all' || u.role === filter)

  return (
    <div className="flex flex-col w-full h-full bg-background p-8">
      
      {/* Header Area */}
      <div className="max-w-6xl mx-auto w-full mb-8">
        <h1 className="text-3xl font-bold mb-2">Member Directory</h1>
        <p className="text-muted-foreground mb-8">Connect with founders, investors, and industry experts.</p>
        
        <div className="flex flex-col md:flex-row justify-between gap-4 items-center bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="relative w-full md:w-96">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by name, role, or company..." 
              className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <Filter size={18} className="text-muted-foreground mr-2" />
            <button 
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              All Members
            </button>
            <button 
              onClick={() => setFilter('founder')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${filter === 'founder' ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              <Building size={14} /> Founders
            </button>
            <button 
              onClick={() => setFilter('investor')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${filter === 'investor' ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              <TrendingUp size={14} /> Investors
            </button>
          </div>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="max-w-6xl mx-auto w-full flex-1">
        {loading ? (
          <div className="text-center p-12 text-muted-foreground">Loading directory...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground bg-card rounded-xl border border-border">No members found matching your filter.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredUsers.map(user => {
              const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown User'
              
              let roleColor = 'text-muted-foreground'
              let roleBg = 'bg-muted'
              let RoleIcon = null
              
              if (user.role === 'founder') { 
                roleColor = 'text-blue-500'
                roleBg = 'bg-blue-500/10'
                RoleIcon = Building
              }
              if (user.role === 'investor') { 
                roleColor = 'text-emerald-500'
                roleBg = 'bg-emerald-500/10'
                RoleIcon = TrendingUp
              }
              if (user.role === 'admin') { 
                roleColor = 'text-red-500'
                roleBg = 'bg-red-500/10'
                RoleIcon = ShieldCheck
              }

              return (
                <div key={user.id} className="bg-card rounded-xl border border-border p-6 flex flex-col items-center text-center hover:border-primary/50 transition-all hover:shadow-md group">
                  <div className="w-20 h-20 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-2xl mb-4 group-hover:scale-105 transition-transform">
                    {fullName.charAt(0).toUpperCase()}
                  </div>
                  
                  <h3 className="font-bold text-lg text-foreground mb-1 line-clamp-1">{fullName}</h3>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider mb-4 ${roleBg} ${roleColor}`}>
                    {RoleIcon && <RoleIcon size={12} />}
                    {user.role || 'Member'}
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-6 h-10">
                    {user.subscription_tier === 'pro' ? 'Pro Member' : 'Community Member'} joined {new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </p>
                  
                  <div className="w-full grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-border">
                    <Link to={`/messages?user=${user.id}`} className="flex items-center justify-center gap-2 py-2 rounded-lg bg-muted text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors">
                      <Mail size={16} /> Message
                    </Link>
                    <Link to={`/profile/${user.id}`} className="flex items-center justify-center gap-2 py-2 rounded-lg bg-muted text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors">
                      Profile
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
