import { useState, useRef, useEffect } from 'react'
import { Bot, Send, User } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AIAgentChat() {
  const [messages, setMessages] = useState([
    { role: 'ai', content: "Hello! I'm Investrade AI, your personal pitch coach and startup advisor. How can I help you today?" }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setIsLoading(true)

    // Add empty AI message for streaming
    setMessages(prev => [...prev, { role: 'ai', content: '' }])

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ prompt: userMsg })
      })

      if (!response.ok) throw new Error('Network response was not ok')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let aiText = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        // Gemini SSE format is "data: {...}\n\n"
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6))
              const textPart = data.choices?.[0]?.delta?.content
              if (textPart) {
                aiText += textPart
                setMessages(prev => {
                  const newMsgs = [...prev]
                  newMsgs[newMsgs.length - 1] = { role: 'ai', content: aiText }
                  return newMsgs
                })
              }
            } catch (e) {
              console.error('Error parsing SSE:', e, line)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error calling AI:', error)
      setMessages(prev => {
        const newMsgs = [...prev]
        newMsgs[newMsgs.length - 1] = { role: 'ai', content: 'Sorry, I encountered an error. Please ensure the GEMINI_API_KEY is set in Supabase secrets.' }
        return newMsgs
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full bg-background p-4">
      <div className="flex flex-col w-full max-w-4xl mx-auto bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
            <Bot size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Investrade AI</h2>
            <p className="text-sm text-muted-foreground">Pitch Coach & Advisor</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-secondary text-secondary-foreground rounded-tl-none'}`}>
                <div className="whitespace-pre-wrap leading-relaxed text-[0.95rem]">{msg.content}</div>
                {msg.role === 'ai' && msg.content === '' && (
                  <div className="flex gap-1 items-center h-5">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-4 bg-background border-t border-border">
          <form onSubmit={handleSend} className="relative flex items-center max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Ask for feedback on your pitch deck..."
              className="w-full bg-card border border-border rounded-full pl-6 pr-14 py-4 outline-none focus:border-primary transition-colors disabled:opacity-50"
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="absolute right-2 p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary transition-colors"
            >
              <Send size={20} className="ml-1" />
            </button>
          </form>
          <div className="text-center text-xs text-muted-foreground mt-2">
            AI responses may be inaccurate. Please double-check critical information.
          </div>
        </div>
      </div>
    </div>
  )
}
