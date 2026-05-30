import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Calendar as CalendarIcon, MapPin, Users, Clock, CheckCircle } from 'lucide-react'

export default function Events() {
  const { profile } = useAuth()
  const [events, setEvents] = useState([])
  const [registrations, setRegistrations] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()
    if (profile) {
      fetchRegistrations()
    }
  }, [profile])

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_time', { ascending: true })
      
      if (error) throw error
      setEvents(data || [])
    } catch (err) {
      console.error("Error fetching events:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from('event_registrations')
        .select('event_id')
        .eq('user_id', profile.id)
      
      if (error) throw error
      setRegistrations(new Set(data.map(d => d.event_id)))
    } catch (err) {
      console.error("Error fetching registrations:", err)
    }
  }

  const toggleRsvp = async (eventId, isRegistered) => {
    if (!profile) return

    try {
      if (isRegistered) {
        await supabase
          .from('event_registrations')
          .delete()
          .match({ event_id: eventId, user_id: profile.id })
          
        setRegistrations(prev => {
          const next = new Set(prev)
          next.delete(eventId)
          return next
        })
      } else {
        await supabase
          .from('event_registrations')
          .insert([{ event_id: eventId, user_id: profile.id }])
          
        setRegistrations(prev => {
          const next = new Set(prev)
          next.add(eventId)
          return next
        })
      }
    } catch (err) {
      console.error("Error toggling RSVP:", err)
    }
  }

  const upcomingEvents = events.filter(e => new Date(e.start_time) >= new Date())
  const featuredEvent = upcomingEvents[0]

  return (
    <div className="flex flex-col w-full h-full bg-background overflow-y-auto">
      
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-primary/20 via-background to-background border-b border-border p-8 md:p-12 relative overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-4">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> Next Up
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">{featuredEvent ? featuredEvent.title : 'No Upcoming Events'}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mb-8">
            {featuredEvent ? featuredEvent.description : 'Check back later for more masterclasses and networking sessions.'}
          </p>
          
          {featuredEvent && (
            <div className="flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-2 text-foreground font-medium bg-card px-4 py-2 rounded-lg border border-border">
                <CalendarIcon size={18} className="text-primary"/>
                {new Date(featuredEvent.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium bg-card px-4 py-2 rounded-lg border border-border">
                <Clock size={18} className="text-primary"/>
                {new Date(featuredEvent.start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </div>
              
              <button 
                onClick={() => toggleRsvp(featuredEvent.id, registrations.has(featuredEvent.id))}
                className={`px-8 py-3 rounded-full font-bold transition-all shadow-lg hover:shadow-primary/25 ${registrations.has(featuredEvent.id) ? 'bg-card text-emerald-500 border border-emerald-500/50 hover:bg-emerald-500/10' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
              >
                {registrations.has(featuredEvent.id) ? (
                  <span className="flex items-center gap-2"><CheckCircle size={20} /> Registered</span>
                ) : (
                  'RSVP Now'
                )}
              </button>
            </div>
          )}
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none"></div>
      </div>

      {/* Events Grid */}
      <div className="max-w-6xl mx-auto w-full p-8 flex-1">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">All Schedule</h2>
        
        {loading ? (
          <div className="text-muted-foreground">Loading schedule...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map(event => {
              const isRegistered = registrations.has(event.id)
              const eventDate = new Date(event.start_time)
              
              return (
                <div key={event.id} className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col hover:border-primary/50 transition-colors group">
                  <div className="h-32 bg-muted relative overflow-hidden flex items-center justify-center">
                    {/* Placeholder image representation */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20"></div>
                    <CalendarIcon size={48} className="text-primary/40 group-hover:scale-110 transition-transform duration-500" />
                    
                    <div className="absolute top-4 left-4 bg-background/90 backdrop-blur px-3 py-1.5 rounded-lg text-center shadow-sm">
                      <div className="text-xs font-bold text-primary uppercase leading-tight">{eventDate.toLocaleString('default', { month: 'short' })}</div>
                      <div className="text-xl font-bold text-foreground leading-none mt-1">{eventDate.getDate()}</div>
                    </div>
                  </div>
                  
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg mb-2 line-clamp-1">{event.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">{event.description}</p>
                    
                    <div className="flex flex-col gap-2 mb-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock size={16} />
                        {eventDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin size={16} />
                        {event.event_type === 'virtual' ? 'Live Room' : 'In Person'}
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => toggleRsvp(event.id, isRegistered)}
                      className={`w-full py-2.5 rounded-lg font-medium transition-all ${isRegistered ? 'bg-muted text-emerald-500 border border-emerald-500/30' : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'}`}
                    >
                      {isRegistered ? 'Registered' : 'RSVP'}
                    </button>
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
