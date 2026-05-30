import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Search, Send, User, MessageSquare } from 'lucide-react'

export default function Messages() {
  const { profile } = useAuth()
  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (profile) {
      fetchThreads()
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

      // In a real app we'd fetch the OTHER participant details here.
      // For this UI mockup, we'll construct basic thread objects.
      const formattedThreads = data.map(d => ({
        thread_id: d.thread_id,
        name: `Thread ${d.thread_id.substring(0,6)}...`, // Mock name
        last_message: "Click to view messages"
      }))
      
      setThreads(formattedThreads)
      if (formattedThreads.length > 0) {
        setActiveThread(formattedThreads[0])
      }
    } catch (err) {
      console.error("Error fetching threads:", err)
    } finally {
      setLoading(false)
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
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search messages..." 
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
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
    </div>
  )
}
