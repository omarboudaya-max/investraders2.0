import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MessageSquare, Users, Search, Hash } from 'lucide-react'

export default function Community() {
  const { profile } = useAuth()
  const [spaces, setSpaces] = useState([])
  const [activeSpace, setActiveSpace] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSpaces()
  }, [])

  useEffect(() => {
    if (activeSpace) {
      fetchPosts(activeSpace.id)
    }
  }, [activeSpace])

  const fetchSpaces = async () => {
    try {
      const { data, error } = await supabase
        .from('community_spaces')
        .select('*')
        .order('order_idx', { ascending: true })
      
      if (error) throw error
      setSpaces(data || [])
      if (data && data.length > 0) {
        setActiveSpace(data[0])
      }
    } catch (err) {
      console.error("Error fetching spaces:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPosts = async (spaceId) => {
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setPosts(data || [])
    } catch (err) {
      console.error("Error fetching posts:", err)
    }
  }

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      
      {/* Left Sidebar: Spaces */}
      <div className="w-64 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="p-4 border-b border-border">
          <h2 className="font-bold text-lg flex items-center gap-2"><Users size={20} className="text-primary"/> Spaces</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading spaces...</div>
          ) : (
            spaces.map(space => (
              <button
                key={space.id}
                onClick={() => setActiveSpace(space)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${activeSpace?.id === space.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <div className="w-6 h-6 flex items-center justify-center bg-background rounded border border-border shadow-sm text-sm">
                  {space.icon || <Hash size={14} />}
                </div>
                <span className="truncate">{space.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content: Threads */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border bg-card">
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <span className="text-3xl">{activeSpace?.icon}</span>
              {activeSpace?.name || 'Community'}
            </h1>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search this space..." 
                className="bg-background border border-border rounded-full pl-9 pr-4 py-2 text-sm outline-none focus:border-primary w-64"
              />
            </div>
          </div>
          <p className="text-muted-foreground">{activeSpace?.description}</p>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            {posts.length === 0 ? (
              <div className="text-center p-12 bg-card rounded-xl border border-border">
                <MessageSquare size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground mb-1">No discussions yet</h3>
                <p className="text-muted-foreground">Be the first to start a conversation in this space.</p>
              </div>
            ) : (
              posts.map(post => (
                <div key={post.id} className="bg-card rounded-xl border border-border p-5 shadow-sm hover:border-primary/50 transition-colors cursor-pointer group">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold flex-shrink-0">
                      {post.user_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="font-semibold text-foreground truncate">{post.user_name}</h3>
                        <span className="text-xs text-muted-foreground ml-4 flex-shrink-0">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-primary font-medium capitalize mb-2">{post.user_role}</p>
                      <h4 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{post.title || 'Discussion'}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {post.content}
                      </p>
                      <div className="flex items-center gap-4 mt-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <MessageSquare size={14} />
                          <span>Reply</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
