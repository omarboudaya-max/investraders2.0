import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Search, Send, User, MessageSquare, Plus, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

export default function Messages() {
  const { profile } = useAuth()
  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewMsgModal, setShowNewMsgModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userResults, setUserResults] = useState([])
  const messagesEndRef = useRef(null)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (profile) {
      fetchThreads().then(() => {
        const userId = searchParams.get('user')
        if (userId) {
          handleStartChat(userId)
        }
      })
    }
  }, [profile])

  useEffect(() => {
    if (activeThread) {
      fetchMessages(activeThread.thread_id)
      
      const subscription = supabase
        .channel(`messages:${activeThread.thread_id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'direct_messages',
          filter: `thread_id=eq.${activeThread.thread_id}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new])
          scrollToBottom()
        })
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [activeThread])

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const fetchThreads = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_thread_participants')
        .select(`
          thread_id,
          chat_threads (
            id,
            created_at
          )
        `)
        .eq('user_id', profile.id)
      
      if (error) throw error

      if (!data || data.length === 0) {
        setThreads([])
        setLoading(false)
        return
      }

      // Fetch the OTHER participant for each thread
      const threadIds = data.map(d => d.thread_id)
      const { data: otherParticipants, error: otherErr } = await supabase
        .from('chat_thread_participants')
        .select('thread_id, user_id')
        .in('thread_id', threadIds)
        .neq('user_id', profile.id)
      
      if (otherErr) throw otherErr

      // Fetch user details for those participants
      const otherUserIds = otherParticipants.map(p => p.user_id)
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('id, first_name, last_name, role')
        .in('id', otherUserIds)
      
      if (usersErr) throw usersErr

      const formattedThreads = data.map(d => {
        const participant = otherParticipants.find(p => p.thread_id === d.thread_id)
        const user = usersData.find(u => u.id === participant?.user_id)
        return {
          thread_id: d.thread_id,
          other_user_id: user?.id,
          name: user ? `${user.first_name} ${user.last_name}` : `Unknown User`,
          last_message: "Click to view messages"
        }
      })
      
      setThreads(formattedThreads)
      // Only set active if we don't already have one (to prevent overriding URL params)
      if (formattedThreads.length > 0 && !activeThread) {
        setActiveThread(formattedThreads[0])
      }
    } catch (err) {
      console.error("Error fetching threads:", err)
    } finally {
      setLoading(false)
    }
  }

  const searchUsers = async (query) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setUserResults([])
      return
    }
    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name, role')
      .neq('id', profile.id)
      .ilike('first_name', `%${query}%`)
      .limit(5)
    
    setUserResults(data || [])
  }

  const handleStartChat = async (userId) => {
    try {
      // Check if thread already exists
      const existingThread = threads.find(t => t.other_user_id === userId)
      if (existingThread) {
        setActiveThread(existingThread)
        setShowNewMsgModal(false)
        return
      }

      // Create new thread
      const { data: threadData, error: threadErr } = await supabase
        .from('chat_threads')
        .insert([{}])
        .select()
        .single()
      if (threadErr) throw threadErr

      // Add participants
      const { error: partErr } = await supabase
        .from('chat_thread_participants')
        .insert([
          { thread_id: threadData.id, user_id: profile.id },
          { thread_id: threadData.id, user_id: userId }
        ])
      if (partErr) throw partErr

      await fetchThreads()
      
      // Auto-select the newly created thread
      const newThreadInfo = {
        thread_id: threadData.id,
        other_user_id: userId,
        name: "New Conversation",
        last_message: "Say hi!"
      }
      setActiveThread(newThreadInfo)
      setShowNewMsgModal(false)
    } catch (err) {
      console.error("Error starting chat:", err)
    }
  }

  const fetchMessages = async (threadId) => {
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      setMessages(data || [])
      scrollToBottom()
    } catch (err) {
      console.error("Error fetching messages:", err)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeThread || !profile) return

    try {
      const { error } = await supabase
        .from('direct_messages')
        .insert([{
          thread_id: activeThread.thread_id,
          sender_id: profile.id,
          content: newMessage.trim()
        }])
      
      if (error) throw error
      setNewMessage('')
    } catch (err) {
      console.error("Error sending message:", err)
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full bg-background border-t border-border">
      
      {/* Thread List Sidebar */}
      <div className="w-80 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="font-bold text-lg">Messages</h2>
          <button 
            onClick={() => setShowNewMsgModal(true)}
            className="p-2 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No conversations yet.</div>
          ) : (
            threads.map(thread => (
              <button
                key={thread.thread_id}
                onClick={() => setActiveThread(thread)}
                className={`w-full flex items-start gap-3 p-4 border-b border-border/50 text-left transition-colors ${activeThread?.thread_id === thread.thread_id ? 'bg-muted' : 'hover:bg-muted/50'}`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold flex-shrink-0">
                  <User size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-semibold text-foreground truncate">{thread.name}</h3>
                    <span className="text-xs text-muted-foreground"></span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{thread.last_message}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col bg-background">
        {activeThread ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-border bg-card flex items-center px-6">
              <h2 className="font-bold text-lg">{activeThread.name}</h2>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {messages.length === 0 ? (
                <div className="m-auto text-center text-muted-foreground">
                  <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Send a message to start the conversation.</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.sender_id === profile?.id
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-5 py-3 ${isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border text-foreground rounded-bl-sm'}`}>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        <span className={`text-[0.65rem] block mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input Area */}
            <div className="p-4 bg-card border-t border-border">
              <form onSubmit={handleSendMessage} className="relative flex items-center max-w-4xl mx-auto">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full bg-background border border-border rounded-full pl-6 pr-14 py-3 text-sm outline-none focus:border-primary transition-colors"
                />
                <button 
                  type="submit" 
                  disabled={!newMessage.trim()}
                  className="absolute right-2 p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Send size={16} className="ml-0.5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="m-auto text-center text-muted-foreground flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare size={32} />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Your Messages</h2>
            <p>Select a conversation or start a new one.</p>
          </div>
        )}
      </div>

      {/* New Message Modal */}
      {showNewMsgModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-foreground">New Message</h2>
              <button onClick={() => setShowNewMsgModal(false)} className="text-muted-foreground hover:text-foreground">
                <X size={24} />
              </button>
            </div>
            
            <div className="relative mb-4">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => searchUsers(e.target.value)}
                placeholder="Search by name..." 
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-3 outline-none focus:border-primary"
                autoFocus
              />
            </div>
            
            <div className="max-h-60 overflow-y-auto flex flex-col gap-2">
              {userResults.length === 0 && searchQuery.length >= 2 ? (
                <p className="text-sm text-center text-muted-foreground py-4">No users found.</p>
              ) : (
                userResults.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleStartChat(user.id)}
                    className="flex items-center gap-3 p-3 hover:bg-muted rounded-xl transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                      {user.first_name?.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{user.first_name} {user.last_name}</h4>
                      <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
