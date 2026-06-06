import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, Plus, Image, Send, Heart, MessageSquare, Share2, Video, Briefcase, Paperclip, Smile, MapPin, Sparkles } from 'lucide-react';

const DEFAULT_FEED_SPACE_ID = '00000000-0000-0000-0000-000000000001';

export default function Home() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [postContent, setPostContent] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [activeCommentPost, setActiveCommentPost] = useState(null)
  const [commentText, setCommentText] = useState('')
  const fileInputRef = useRef(null)

  const fetchData = async () => {
    try {
      const { data: postsData, error: postsErr } = await supabase
        .from('community_posts')
        .select(`
          *,
          community_reactions ( id, user_id, emoji ),
          community_comments ( id, user_id, user_name, content, created_at )
        `)
        .order('created_at', { ascending: false })
        .limit(50)
      if (!postsErr) setPosts(postsData || [])
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
      fetchData()
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

  const handleLike = async (postId, reactions) => {
    if (!profile) return
    const existing = reactions?.find(r => r.user_id === profile.id && r.emoji === 'heart')
    
    try {
      if (existing) {
        await supabase.from('community_reactions').delete().eq('id', existing.id)
      } else {
        await supabase.from('community_reactions').insert([{
          post_id: postId,
          user_id: profile.id,
          emoji: 'heart'
        }])
      }
      fetchData()
    } catch (err) {
      console.error("Error toggling like:", err)
    }
  }

  const handleComment = async (postId) => {
    if (!commentText.trim() || !profile) return
    try {
      await supabase.from('community_comments').insert([{
        post_id: postId,
        user_id: profile.id,
        user_name: `${profile.first_name} ${profile.last_name || ''}`.trim(),
        user_role: profile.role || 'member',
        content: commentText.trim()
      }])
      setCommentText('')
      setActiveCommentPost(null)
      fetchData()
    } catch (err) {
      console.error("Error posting comment:", err)
    }
  }

  const handleShare = async (post) => {
    const url = `${window.location.origin}/app.html?post=${post.id}`
    if (navigator.share) {
      navigator.share({
        title: `Post by ${post.user_name}`,
        text: post.content,
        url: url,
      }).catch(console.error)
    } else {
      navigator.clipboard.writeText(url)
      alert("Post link copied to clipboard!")
    }
  }

  return (
    <div className="flex w-full gap-6 justify-center items-start h-full">
      {/* Main Center Column */}
      <div className="flex-1 max-w-2xl min-w-0 h-full overflow-y-auto no-scrollbar pb-32" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="flex flex-col gap-6">
        
        {/* Stories Section */}
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 pt-2">
          {/* Add Story */}
          <div className="relative w-[110px] h-[160px] rounded-2xl overflow-hidden shadow-sm flex-shrink-0 cursor-pointer group bg-card border border-border">
            <img src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80" alt="Me" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-2 border border-white/40 group-hover:bg-white group-hover:text-black transition-colors">
                <Plus size={20} />
              </div>
              <span className="text-white font-semibold text-xs absolute bottom-3">Add Story</span>
            </div>
          </div>
          {/* Other Stories */}
          {[
            { name: 'Robert Fox', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80' },
            { name: 'Kick Rompe', img: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80' },
            { name: 'Arlene McCoy', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80' },
          ].map((story, i) => (
            <div key={i} className="relative w-[110px] h-[160px] rounded-2xl overflow-hidden shadow-sm flex-shrink-0 cursor-pointer group bg-card">
              <img src={story.img} alt={story.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <div className="absolute bottom-3 left-0 w-full flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border-2 border-blue-500 p-[2px] mb-1">
                   <img src={story.img} alt={story.name} className="w-full h-full rounded-full object-cover" />
                </div>
                <span className="text-white font-semibold text-xs">{story.name}</span>
              </div>
            </div>
          ))}
          <div className="w-[40px] h-[160px] flex items-center justify-center flex-shrink-0">
             <button className="w-8 h-8 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-foreground hover:bg-muted transition-colors">
                <ArrowRight size={16} />
             </button>
          </div>
        </div>

        {/* Create Post Card */}
        <div className="bg-card rounded-2xl border border-border p-3 shadow-sm relative overflow-hidden">
           <form onSubmit={handlePost} className="relative z-10 flex flex-col">
              <div className="flex gap-3 items-center">
                 <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {profile?.first_name?.charAt(0).toUpperCase() || 'U'}
                 </div>
                 <div className="flex-1 border border-border rounded-full bg-muted/30 focus-within:bg-background focus-within:border-primary transition-colors overflow-hidden flex items-center pr-1.5">
                    <input
                      type="text"
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      placeholder="What's on your mind?"
                      className="w-full bg-transparent border-none outline-none text-foreground text-sm px-4 py-2 h-[42px]"
                    />
                    <input type="file" accept="image/*" ref={fileInputRef} hidden onChange={handleImageSelect} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors mr-1">
                       <Image size={16} />
                    </button>
                    <button type="button" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors mr-1 hidden sm:flex">
                       <Video size={16} />
                    </button>
                    <button type="button" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors mr-1 hidden sm:flex">
                       <Paperclip size={16} />
                    </button>
                    <button type="button" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors mr-1 hidden md:flex lg:hidden xl:flex">
                       <MapPin size={16} />
                    </button>
                    <button type="button" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors mr-1 hidden md:flex lg:hidden xl:flex">
                       <Smile size={16} />
                    </button>
                    <button type="submit" disabled={isPosting || (!postContent.trim() && !selectedImage)} className="w-8 h-8 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 flex-shrink-0 ml-1">
                       <Send size={14} className="ml-0.5" />
                    </button>
                 </div>
              </div>
              {selectedImage && (
                <div className="relative mt-3 ml-12 inline-block self-start">
                  <img src={URL.createObjectURL(selectedImage)} alt="Preview" className="max-h-24 rounded-lg object-cover border border-border" />
                  <button 
                    type="button" 
                    onClick={() => setSelectedImage(null)} 
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-black text-[10px]"
                  >
                    &times;
                  </button>
                </div>
              )}
           </form>
        </div>

        {/* Feed Posts */}
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="text-center p-8 text-muted-foreground bg-card rounded-2xl border border-border">Loading feed...</div>
          ) : posts.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground bg-card rounded-2xl border border-border">No posts yet. Be the first to share!</div>
          ) : (
            posts.map(post => (
              <div key={post.id} className="bg-card rounded-2xl border border-border p-5 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-4 relative">
                  <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold">
                    {post.user_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{post.user_name}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(post.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button className="absolute top-0 right-0 p-2 text-muted-foreground hover:text-foreground">
                     <span className="flex gap-1"><span className="w-1 h-1 rounded-full bg-current"></span><span className="w-1 h-1 rounded-full bg-current"></span><span className="w-1 h-1 rounded-full bg-current"></span></span>
                  </button>
                </div>
                
                <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed mb-4">
                  {post.content}
                </p>

                {post.media_url && (
                  <div className="mb-4 rounded-xl overflow-hidden border border-border">
                    <img src={post.media_url} alt="Post media" className="w-full object-cover max-h-96" />
                  </div>
                )}
                
                {((post.community_reactions?.length || 0) > 0 || (post.community_comments?.length || 0) > 0) && (
                  <div className="flex justify-between items-center text-xs text-muted-foreground mb-3 px-1">
                    <span className="flex items-center gap-1"><Heart size={12} className="fill-blue-500 text-blue-500"/> {post.community_reactions?.length || 0}</span>
                    <span>{post.community_comments?.length || 0} comments</span>
                  </div>
                )}
                
                <div className="flex justify-between mt-2 pt-2 border-t border-border">
                  <button 
                    onClick={() => handleLike(post.id, post.community_reactions)}
                    className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-lg transition-colors font-medium ${post.community_reactions?.some(r => r.user_id === profile?.id) ? 'text-blue-500' : 'text-muted-foreground hover:bg-muted'}`}
                  >
                    <Heart size={18} className={post.community_reactions?.some(r => r.user_id === profile?.id) ? 'fill-blue-500' : ''} /> <span className="text-xs">Like</span>
                  </button>
                  <button 
                    onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)}
                    className="flex-1 flex justify-center items-center gap-2 text-muted-foreground hover:bg-muted py-2 rounded-lg transition-colors font-medium"
                  >
                    <MessageSquare size={18} /> <span className="text-xs">Comment</span>
                  </button>
                  <button 
                    onClick={() => handleShare(post)}
                    className="flex-1 flex justify-center items-center gap-2 text-muted-foreground hover:bg-muted py-2 rounded-lg transition-colors font-medium"
                  >
                    <Share2 size={18} /> <span className="text-xs">Share</span>
                  </button>
                </div>

                {activeCommentPost === post.id && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold flex-shrink-0 text-xs">
                        {profile?.first_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 flex border border-border rounded-full overflow-hidden focus-within:border-primary">
                        <input 
                          type="text" 
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Add a comment..." 
                          className="flex-1 bg-transparent px-4 py-2 outline-none text-xs"
                          onKeyDown={(e) => { if (e.key === 'Enter') handleComment(post.id) }}
                        />
                        <button 
                          onClick={() => handleComment(post.id)}
                          disabled={!commentText.trim()}
                          className="px-4 text-primary font-semibold text-xs hover:bg-muted disabled:opacity-50"
                        >
                          Post
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {post.community_comments?.map(comment => (
                        <div key={comment.id} className="flex gap-2">
                          <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold flex-shrink-0 text-xs mt-1">
                            {comment.user_name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="bg-muted px-4 py-2.5 rounded-2xl rounded-tl-sm flex-1">
                            <h4 className="font-semibold text-[13px] text-foreground">{comment.user_name}</h4>
                            <p className="text-xs text-foreground mt-0.5">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        </div>
      </div>

      {/* Right Sidebar Column */}
      <div className="hidden lg:flex w-[320px] shrink-0 flex-col gap-6 h-full overflow-y-auto no-scrollbar pb-32" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        
        {/* Upgrade Plan Banner */}
        <div className="shrink-0 relative bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 rounded-2xl p-6 text-white shadow-lg overflow-hidden group border border-white/10 flex flex-col gap-3">
           {/* Decorative background elements */}
           <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500 pointer-events-none"></div>
           <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:bg-white/10 transition-all duration-500 pointer-events-none"></div>
           
           <div className="relative z-10 flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                 <Sparkles size={18} className="text-yellow-300" />
                 <span className="text-sm font-bold text-white">Premium Plan</span>
              </div>
           </div>
           
           <div className="relative z-10">
              <h3 className="text-xl font-black tracking-tight text-white mb-1">Upgrade your plan</h3>
              <p className="text-xs text-indigo-100 opacity-90 mb-5 leading-relaxed">
                 Unlock creator class tools to access advanced analytics and exclusive features in the app.
              </p>
           </div>
           
           <Link to="/plans" className="relative z-10 w-full bg-white text-indigo-900 rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors shadow-md">
              Upgrade Now <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
           </Link>
        </div>

        {/* Activities */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-foreground">Activities</h3>
              <span className="bg-muted px-2 py-0.5 rounded-md text-[10px] font-medium text-muted-foreground border border-border/50">154</span>
            </div>
            <button className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/50">
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { name: 'Tech Startups', type: 'Technology', members: '200.3k' },
              { name: 'AgriTech Rising', type: 'Agriculture', members: '80.4k' },
              { name: 'Eco Innovators', type: 'Ecology', members: '35.9k' }
            ].map((activity, i) => (
              <div key={i} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center border border-border relative shrink-0">
                    <span className="font-bold text-[10px]">{activity.name.substring(0, 2).toUpperCase()}</span>
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-background flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer">{activity.name}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{activity.type} • {activity.members}</span>
                  </div>
                </div>
                <button className="text-blue-500 text-[10px] font-bold flex items-center gap-1 hover:text-blue-400 transition-colors">
                  <Plus size={12} /> JOIN
                </button>
              </div>
            ))}
          </div>
        </div>
        
        {/* Nearest Events */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-foreground">Nearest Events</h3>
              <span className="bg-muted px-2 py-0.5 rounded-md text-[10px] font-medium text-muted-foreground border border-border/50">230</span>
            </div>
            <button className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/50">
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { day: '12', month: 'APR', title: 'Global Tech Summit', joined: '12.8k' },
              { day: '24', month: 'APR', title: 'AgriTech Network Meetup', joined: '3.2k' },
              { day: '30', month: 'APR', title: 'Sustainable Ecology Conf', joined: '1.1k' }
            ].map((event, i) => (
              <div key={i} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-10 rounded-xl border border-border bg-transparent flex flex-col items-center justify-center relative overflow-hidden shadow-sm shrink-0">
                     <div className="absolute top-0 w-full h-1 bg-blue-500/80"></div>
                     <span className="text-[13px] font-black text-foreground leading-none mt-1">{event.day}</span>
                     <span className="text-[8px] font-bold text-muted-foreground mt-0.5">{event.month}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer">{event.title}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{event.joined} people joined</span>
                  </div>
                </div>
                <button className="text-blue-500 text-[10px] font-bold flex items-center gap-1 hover:text-blue-400 transition-colors">
                  <Plus size={12} /> JOIN
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Network */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-foreground">Network</h3>
              <span className="bg-muted px-2 py-0.5 rounded-md text-[10px] font-medium text-muted-foreground border border-border/50">1.2k</span>
            </div>
            <button className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/50">
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { name: 'Alex Johnson', role: 'Angel Investor', status: 'LIVE' },
              { name: 'Maria Garcia', role: 'Startup Founder' },
              { name: 'David Chen', role: 'Tech Enthusiast' }
            ].map((person, i) => (
              <div key={i} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-[9px] shadow-sm relative shrink-0">
                    {person.name.substring(0, 2).toUpperCase()}
                    {person.status && (
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-background flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer">{person.name}</span>
                    {person.status ? (
                      <span className="text-[10px] text-red-500 font-medium flex items-center gap-1 mt-0.5">
                        <span className="w-1 h-1 rounded-full bg-red-500"></span>
                        {person.status}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground mt-0.5">{person.role}</span>
                    )}
                  </div>
                </div>
                {person.status ? (
                  <button className="text-[9px] font-bold bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white px-2.5 py-1.5 rounded-md transition-colors border border-blue-500/20">
                    CONNECT
                  </button>
                ) : (
                  <button className="text-[9px] font-bold bg-muted hover:bg-primary hover:text-primary-foreground text-foreground px-2.5 py-1.5 rounded-md transition-colors border border-border/50">
                    Follow
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
