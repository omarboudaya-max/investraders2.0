import { useState, useEffect } from 'react'
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

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) throw error
      setPosts(data || [])
    } catch (err) {
      console.error("Error fetching feed:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  const handlePost = async (e) => {
    e.preventDefault()
    if (!postContent.trim() || !profile) return

    setIsPosting(true)
    try {
      const { error } = await supabase
        .from('community_posts')
        .insert([{
          space_id: DEFAULT_FEED_SPACE_ID,
          user_id: profile.id,
          user_name: `${profile.first_name} ${profile.last_name || ''}`.trim(),
          user_role: profile.role || 'member',
          content: postContent.trim()
        }])
      
      if (error) throw error
      
      setPostContent('')
      fetchPosts()
    } catch (err) {
      console.error("Error creating post:", err)
      alert("Failed to post. Please try again.")
    } finally {
      setIsPosting(false)
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
              <span className="text-sm font-bold text-primary">47</span>
            </div>
            <div className="flex justify-between items-center cursor-pointer hover:bg-muted/50 p-1 rounded">
              <span className="text-sm text-muted-foreground">Connections</span>
              <span className="text-sm font-bold text-primary">152</span>
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
              <div className="flex justify-between items-center mt-3">
                <div className="flex gap-1">
                  <button type="button" className="flex items-center gap-2 text-muted-foreground hover:bg-muted px-3 py-2 rounded-lg transition-colors font-medium text-sm">
                    <Image size={20} className="text-blue-500" /> <span className="hidden sm:inline">Media</span>
                  </button>
                  <button type="button" className="flex items-center gap-2 text-muted-foreground hover:bg-muted px-3 py-2 rounded-lg transition-colors font-medium text-sm">
                    <Video size={20} className="text-amber-500" /> <span className="hidden sm:inline">Event</span>
                  </button>
                  <button type="button" className="flex items-center gap-2 text-muted-foreground hover:bg-muted px-3 py-2 rounded-lg transition-colors font-medium text-sm">
                    <Briefcase size={20} className="text-emerald-500" /> <span className="hidden sm:inline">Job</span>
                  </button>
                </div>
                <button 
                  type="submit" 
                  disabled={isPosting || !postContent.trim()}
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
            
            <div className="flex gap-3 items-start">
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold flex-shrink-0">
                S
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm text-foreground">Sarah Jenkins</h4>
                <p className="text-xs text-muted-foreground mb-2">Partner at Sequoia Capital | Fintech</p>
                <button className="flex items-center justify-center gap-1 w-full py-1.5 rounded-full border border-border text-sm font-semibold hover:bg-muted hover:border-foreground transition-all">
                  <Plus size={16} /> Follow
                </button>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold flex-shrink-0">
                M
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm text-foreground">Marcus Doe</h4>
                <p className="text-xs text-muted-foreground mb-2">Founder @ DataFlow | 3x Exited</p>
                <button className="flex items-center justify-center gap-1 w-full py-1.5 rounded-full border border-border text-sm font-semibold hover:bg-muted hover:border-foreground transition-all">
                  <Plus size={16} /> Follow
                </button>
              </div>
            </div>

          </div>
          <button className="text-sm text-primary font-semibold hover:underline mt-4 px-2 py-1 inline-block transition-colors">
            View all recommendations
          </button>
        </div>
      </div>
    </div>
  )
}
