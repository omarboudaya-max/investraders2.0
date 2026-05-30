import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Image, Send, Heart, MessageSquare, Share2, TrendingUp, Calendar as CalendarIcon } from 'lucide-react'

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
    <div className="flex w-full max-w-6xl mx-auto p-6 gap-6">
      
      {/* Main Feed Column */}
      <div className="flex-1 flex flex-col gap-6">
        
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
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                <button type="button" className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10">
                  <Image size={20} />
                </button>
                <button 
                  type="submit" 
                  disabled={isPosting || !postContent.trim()}
                  className="bg-primary text-primary-foreground px-6 py-2 rounded-full font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Send size={18} />
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
                
                <div className="flex gap-6 mt-4 pt-4 border-t border-border">
                  <button className="flex items-center gap-2 text-muted-foreground hover:text-red-500 transition-colors group">
                    <Heart size={18} className="group-hover:fill-red-500" /> <span className="text-sm font-medium">Like</span>
                  </button>
                  <button className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                    <MessageSquare size={18} /> <span className="text-sm font-medium">Comment</span>
                  </button>
                  <button className="flex items-center gap-2 text-muted-foreground hover:text-emerald-500 transition-colors ml-auto">
                    <Share2 size={18} /> <span className="text-sm font-medium">Share</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="hidden lg:flex w-80 flex-col gap-6">
        {/* Trending */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-primary"/> Trending Topics</h3>
          <ul className="flex flex-col gap-3">
            <li className="text-sm font-medium hover:text-primary cursor-pointer transition-colors">#SaaSGrowth</li>
            <li className="text-sm font-medium hover:text-primary cursor-pointer transition-colors">#SeedFunding</li>
            <li className="text-sm font-medium hover:text-primary cursor-pointer transition-colors">#AIStartups</li>
            <li className="text-sm font-medium hover:text-primary cursor-pointer transition-colors">#PitchDeck</li>
          </ul>
        </div>
        
        {/* Upcoming Events */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><CalendarIcon size={20} className="text-emerald-500"/> Upcoming</h3>
          <div className="flex flex-col gap-4">
            <div className="flex gap-3 items-start">
              <div className="bg-muted rounded p-2 text-center min-w-[50px]">
                <div className="text-xs font-bold text-red-500 uppercase">OCT</div>
                <div className="text-lg font-bold">12</div>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Scaling Operations Masterclass</h4>
                <p className="text-xs text-muted-foreground">2:00 PM EST</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="bg-muted rounded p-2 text-center min-w-[50px]">
                <div className="text-xs font-bold text-red-500 uppercase">OCT</div>
                <div className="text-lg font-bold">15</div>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Founder/Investor Mixer</h4>
                <p className="text-xs text-muted-foreground">5:00 PM EST</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
