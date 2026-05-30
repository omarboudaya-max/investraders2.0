import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Briefcase, MapPin, Globe, Calendar, Users, MessageSquare } from 'lucide-react'

export default function Profile() {
  const { id } = useParams()
  const { profile: currentUser } = useAuth()
  const navigate = useNavigate()
  const [userProfile, setUserProfile] = useState(null)
  const [startupProfile, setStartupProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id && currentUser) {
      fetchUserProfile()
      logProfileView()
    }
  }, [id, currentUser])

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      setUserProfile(data)

      if (data.role === 'founder' && data.startup_id) {
        const { data: startupData } = await supabase
          .from('startups')
          .select('*')
          .eq('owner_uid', id)
          .single()
        if (startupData) setStartupProfile(startupData)
      }
    } catch (err) {
      console.error("Error fetching profile:", err)
    } finally {
      setLoading(false)
    }
  }

  const logProfileView = async () => {
    if (id === currentUser.id) return // Don't log viewing own profile
    try {
      await supabase
        .from('profile_views')
        .insert([{
          viewed_id: id,
          viewer_id: currentUser.id
        }])
    } catch (err) {
      console.error("Error logging profile view:", err)
    }
  }

  const handleMessage = async () => {
    // Navigate to messages with pre-selected user ID (will implement later)
    navigate(`/app.html/messages?user=${id}`)
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading profile...</div>
  if (!userProfile) return <div className="p-8 text-center text-destructive">Profile not found.</div>

  return (
    <div className="flex w-full max-w-4xl mx-auto p-4 lg:p-6 gap-6 flex-col">
      {/* Cover and Avatar */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="h-48 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
          <div className="absolute -bottom-16 left-8 w-32 h-32 rounded-full border-4 border-card bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-5xl shadow-lg">
            {userProfile.first_name?.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="pt-20 pb-6 px-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{userProfile.first_name} {userProfile.last_name}</h1>
            <p className="text-lg text-muted-foreground capitalize mt-1">{userProfile.role}</p>
            <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
              {userProfile.joined_at && (
                <span className="flex items-center gap-1"><Calendar size={16} /> Joined {new Date(userProfile.joined_at).getFullYear()}</span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            {currentUser.id !== userProfile.id && (
              <>
                <button className="bg-primary text-primary-foreground px-6 py-2 rounded-full font-bold hover:bg-primary/90 transition-colors shadow-sm">
                  Follow
                </button>
                <button 
                  onClick={handleMessage}
                  className="bg-muted text-foreground border border-border px-4 py-2 rounded-full font-semibold hover:bg-muted/80 flex items-center gap-2 transition-colors"
                >
                  <MessageSquare size={18} /> Message
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Details Section */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-8">
        <h2 className="text-xl font-bold mb-4">About</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {userProfile.role === 'investor' && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Investment Focus</h3>
                <p>{userProfile.investor_focus || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Ticket Size</h3>
                <p>{userProfile.investor_ticket_size || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Preferred Stage</h3>
                <p>{userProfile.investor_preferred_stage || 'Not specified'}</p>
              </div>
            </>
          )}
          {userProfile.role === 'founder' && (
            <div className="col-span-1 md:col-span-2 mt-2 border-t border-border pt-6">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Briefcase size={20} className="text-primary" /> Startup Details
              </h3>
              {startupProfile ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Company Name</h3>
                    <p className="font-medium">{startupProfile.name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Field & Stage</h3>
                    <p>{startupProfile.field} • {startupProfile.stage}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Team Size</h3>
                    <p>{startupProfile.employees}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Capital Raised</h3>
                    <p>{startupProfile.capital}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Website</h3>
                    <a href={startupProfile.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{startupProfile.website}</a>
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Description</h3>
                    <p className="text-sm leading-relaxed">{startupProfile.description}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Startup profile not linked or created yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
