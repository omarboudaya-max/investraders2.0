import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Image, Send, Heart, MessageSquare, Share2, TrendingUp, Calendar as CalendarIcon, Repeat, Video, Briefcase, Plus, UserPlus, Users } from 'lucide-react'

const DEFAULT_FEED_SPACE_ID = '00000000-0000-0000-0000-000000000001'

export default function Feed() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [postContent, setPostContent] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [eventData, setEventData] = useState({ title: '', type: 'masterclass', date: '' })
  const [suggestions, setSuggestions] = useState([])
  const [stats, setStats] = useState({ viewers: 0, connections: 0 })
  const fileInputRef = useRef(null)

  const fetchData = async () => {
    try {
      // 1. Fetch Posts
      const { data: postsData, error: postsErr } = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (!postsErr) setPosts(postsData || [])

      // 2. Fetch Suggestions
      if (profile) {
        const { data: usersData, error: usersErr } = await supabase
          .from('users')
          .select('id, first_name, last_name, role')
          .neq('id', profile.id)
          .limit(3)
        if (!usersErr) setSuggestions(usersData || [])

        // 3. Fetch Viewers count
        const { count, error: viewsErr } = await supabase
          .from('profile_views')
          .select('*', { count: 'exact', head: true })
          .eq('viewed_id', profile.id)
        
        if (!viewsErr) setStats(prev => ({ ...prev, viewers: count || 0 }))
      }
    } catch (err) {
      console.error("Error fetching feed data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [profile])

  const handlePost = async (e) => {
    e.preventDefault()
    if ((!postContent.trim() && !selectedImage) || !profile) return

    setIsPosting(true)
    try {
      let mediaUrl = null
      
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${profile.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('community_media')
          .upload(filePath, selectedImage)
        
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('community_media')
          .getPublicUrl(filePath)
          
        mediaUrl = publicUrl
      }

      const { error } = await supabase
        .from('community_posts')
        .insert([{
          space_id: DEFAULT_FEED_SPACE_ID,
          user_id: profile.id,
          user_name: `${profile.first_name} ${profile.last_name || ''}`.trim(),
          user_role: profile.role || 'member',
          content: postContent.trim(),
          media_url: mediaUrl
        }])
      
      if (error) throw error
      
      setPostContent('')
      setSelectedImage(null)
      fetchPosts()
    } catch (err) {
      console.error("Error creating post:", err)
      alert("Failed to post. Please try again.")
    } finally {
      setIsPosting(false)
    }
  }

  const handleImageSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0])
    }
  }

  const handleCreateEvent = async (e) => {
    e.preventDefault()
    if (!eventData.title || !eventData.date || !profile) return

    try {
      // 1. Create Event
      const { data: evData, error: evError } = await supabase
        .from('events')
        .insert([{
          title: eventData.title,
          event_type: eventData.type,
          start_time: new Date(eventData.date).toISOString(),
          host_id: profile.id
        }])
        .select()
        .single()
      
      if (evError) throw evError

      // 2. Announce Event in Feed
      const { error: postError } = await supabase
        .from('community_posts')
        .insert([{
          space_id: DEFAULT_FEED_SPACE_ID,
          user_id: profile.id,
          user_name: `${profile.first_name} ${profile.last_name || ''}`.trim(),
          user_role: profile.role || 'member',
          content: `📅 I just scheduled a new ${eventData.type}: **${eventData.title}** on ${new Date(eventData.date).toLocaleString()}! Check it out in the Events tab.`,
        }])
      
      if (postError) throw postError

      setShowEventModal(false)
      setEventData({ title: '', type: 'masterclass', date: '' })
      fetchPosts()
    } catch (err) {
      console.error("Error creating event:", err)
      alert("Failed to create event.")
    }
  }

  return (
    <div className="flex w-full max-w-7xl mx-auto p-4 lg:p-6 gap-6 justify-center">
      
      {/* Left Sidebar (Profile Card) */}
      <div className="hidden md:flex w-64 flex-col gap-4 flex-shrink-0">
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="h-16 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-4 border-card bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-xl">
              {profile?.first_name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
          <div className="pt-10 pb-4 px-4 text-center border-b border-border">
            <h3 className="font-bold text-foreground text-lg">{profile?.first_name} {profile?.last_name}</h3>
            <p className="text-sm text-muted-foreground capitalize mt-1">{profile?.role || 'Member'}</p>
          </div>
          <div className="py-3 px-4 flex flex-col gap-2 border-b border-border">
            <div className="flex justify-between items-center cursor-pointer hover:bg-muted/50 p-1 rounded">
              <span className="text-sm text-muted-foreground">Profile viewers</span>
              <span className="text-sm font-bold text-primary">{stats.viewers}</span>
            </div>
            <div className="flex justify-between items-center cursor-pointer hover:bg-muted/50 p-1 rounded">
              <span className="text-sm text-muted-foreground">Connections</span>
              <span className="text-sm font-bold text-primary">{stats.connections}</span>
            </div>
          </div>
          <div className="p-4 hover:bg-muted/50 cursor-pointer transition-colors">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Briefcase size={16} className="text-muted-foreground" />
              My Items
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-4 sticky top-6">
          <p className="text-sm font-semibold mb-3">Recent</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2 cursor-pointer"><Users size={16}/> Investraders Community</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer"><CalendarIcon size={16}/> Seed Funding Q3</div>
        </div>
      </div>

      {/* Main Feed Column */}
      <div className="flex-1 max-w-2xl flex flex-col gap-4">
        
        {/* Create Post Card */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg flex-shrink-0">
              {profile?.first_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <form onSubmit={handlePost} className="flex-1">
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="Share an update, pitch a startup, or ask a question..."
                className="w-full bg-transparent border-none resize-none outline-none text-foreground text-lg min-h-[80px]"
              />
              {selectedImage && (
                <div className="relative mb-3 inline-block">
                  <img src={URL.createObjectURL(selectedImage)} alt="Preview" className="max-h-48 rounded-lg object-cover" />
                  <button 
                    type="button" 
                    onClick={() => setSelectedImage(null)} 
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                  >
                    &times;
                  </button>
                </div>
              )}
              <div className="flex justify-between items-center mt-3">
                <div className="flex gap-1">
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    hidden 
                    onChange={handleImageSelect} 
                  />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 text-muted-foreground hover:bg-muted px-3 py-2 rounded-lg transition-colors font-medium text-sm"
                  >
                    <Image size={20} className="text-blue-500" /> <span className="hidden sm:inline">Media</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowEventModal(true)}
                    className="flex items-center gap-2 text-muted-foreground hover:bg-muted px-3 py-2 rounded-lg transition-colors font-medium text-sm"
                  >
                    <Video size={20} className="text-amber-500" /> <span className="hidden sm:inline">Event</span>
                  </button>
                  <button type="button" className="flex items-center gap-2 text-muted-foreground hover:bg-muted px-3 py-2 rounded-lg transition-colors font-medium text-sm">
                    <Briefcase size={20} className="text-emerald-500" /> <span className="hidden sm:inline">Job</span>
                  </button>
                </div>
                <button 
                  type="submit" 
                  disabled={isPosting || (!postContent.trim() && !selectedImage)}
                  className="bg-primary text-primary-foreground px-5 py-1.5 rounded-full font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isPosting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Post Feed */}
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="text-center p-8 text-muted-foreground">Loading feed...</div>
          ) : posts.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground bg-card rounded-xl border border-border">No posts yet. Be the first to share!</div>
          ) : (
            posts.map(post => (
              <div key={post.id} className="bg-card rounded-xl border border-border p-5 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold">
                    {post.user_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{post.user_name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">
                      {post.user_role} &bull; {new Date(post.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                
                <p className="text-foreground whitespace-pre-wrap leading-relaxed mb-4">
                  {post.content}
                </p>

                {post.media_url && (
                  <div className="mb-4 rounded-xl overflow-hidden border border-border">
                    <img src={post.media_url} alt="Post media" className="w-full object-cover max-h-96" />
                  </div>
                )}
                
                <div className="flex justify-between mt-4 pt-2 border-t border-border">
                  <button className="flex-1 flex justify-center items-center gap-2 text-muted-foreground hover:bg-muted py-3 rounded-lg transition-colors font-medium">
                    <Heart size={20} /> <span className="text-sm">Like</span>
                  </button>
                  <button className="flex-1 flex justify-center items-center gap-2 text-muted-foreground hover:bg-muted py-3 rounded-lg transition-colors font-medium">
                    <MessageSquare size={20} /> <span className="text-sm">Comment</span>
                  </button>
                  <button className="flex-1 flex justify-center items-center gap-2 text-muted-foreground hover:bg-muted py-3 rounded-lg transition-colors font-medium">
                    <Repeat size={20} /> <span className="text-sm">Repost</span>
                  </button>
                  <button className="flex-1 flex justify-center items-center gap-2 text-muted-foreground hover:bg-muted py-3 rounded-lg transition-colors font-medium">
                    <Send size={20} /> <span className="text-sm">Send</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="hidden lg:flex w-80 flex-col gap-4 flex-shrink-0">
        
        {/* Trending / News */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <h3 className="font-bold text-foreground mb-4">Investraders News</h3>
          <ul className="flex flex-col gap-4">
            <li className="cursor-pointer group">
              <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Top AI Startups to watch in Q4</div>
              <div className="text-xs text-muted-foreground mt-1">Top news • 10,493 readers</div>
            </li>
            <li className="cursor-pointer group">
              <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Venture Capital shifts focus to Seed</div>
              <div className="text-xs text-muted-foreground mt-1">12h ago • 5,231 readers</div>
            </li>
            <li className="cursor-pointer group">
              <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">How to build an MVP in 7 days</div>
              <div className="text-xs text-muted-foreground mt-1">1d ago • 8,924 readers</div>
            </li>
          </ul>
          <button className="text-sm text-muted-foreground font-semibold hover:text-foreground mt-4 px-2 py-1 rounded hover:bg-muted inline-block transition-colors">
            Show more
          </button>
        </div>

        {/* Add to your feed */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 sticky top-6">
          <h3 className="font-bold text-foreground mb-4">Add to your feed</h3>
          <div className="flex flex-col gap-4">
            
            {suggestions.map(s => (
              <div key={s.id} className="flex gap-3 items-start">
                <Link to={`/profile/${s.id}`} className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold flex-shrink-0 cursor-pointer hover:bg-primary/30 transition-colors">
                  {s.first_name?.charAt(0).toUpperCase()}
                </Link>
                <div className="flex-1">
                  <Link to={`/profile/${s.id}`} className="font-bold text-sm text-foreground hover:underline cursor-pointer block">
                    {s.first_name} {s.last_name}
                  </Link>
                  <p className="text-xs text-muted-foreground mb-2 capitalize">{s.role}</p>
                  <Link to={`/profile/${s.id}`} className="flex items-center justify-center gap-1 w-full py-1.5 rounded-full border border-border text-sm font-semibold hover:bg-muted hover:border-foreground transition-all">
                    <Plus size={16} /> Follow
                  </Link>
                </div>
              </div>
            ))}

          </div>
          <button className="text-sm text-primary font-semibold hover:underline mt-4 px-2 py-1 inline-block transition-colors">
            View all recommendations
          </button>
        </div>
      </div>

      {/* Event Creation Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold mb-6 text-foreground">Create Event</h2>
            <form onSubmit={handleCreateEvent} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Event Title</label>
                <input 
                  type="text" 
                  value={eventData.title}
                  onChange={e => setEventData({...eventData, title: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-2.5 outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Event Type</label>
                <select 
                  value={eventData.type}
                  onChange={e => setEventData({...eventData, type: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-2.5 outline-none focus:border-primary"
                >
                  <option value="masterclass">Masterclass</option>
                  <option value="networking">Networking</option>
                  <option value="ama">AMA</option>
                  <option value="live_room">Live Room</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Date & Time</label>
                <input 
                  type="datetime-local" 
                  value={eventData.date}
                  onChange={e => setEventData({...eventData, date: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-2.5 outline-none focus:border-primary"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
