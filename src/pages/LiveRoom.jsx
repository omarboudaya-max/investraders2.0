import { useState } from 'react'
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Settings, Users, MessageSquare } from 'lucide-react'

export default function LiveRoom() {
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(true)
  const [showSidebar, setShowSidebar] = useState('chat') // 'chat' | 'participants' | false

  // Mock participants
  const participants = [
    { id: 1, name: "Omar Boudaya (You)", speaking: false, initial: "O", color: "bg-blue-600" },
    { id: 2, name: "Sarah Jenkins", speaking: true, initial: "S", color: "bg-emerald-600" },
    { id: 3, name: "Alex Chen", speaking: false, initial: "A", color: "bg-purple-600" },
    { id: 4, name: "Maria Garcia", speaking: false, initial: "M", color: "bg-rose-600" }
  ]

  return (
    <div className="flex h-full w-full bg-background">
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col p-4 gap-4">
        
        {/* Top Header */}
        <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border">
          <div>
            <h2 className="text-xl font-bold">Scaling Your Startup Operations</h2>
            <p className="text-sm text-muted-foreground">Live Masterclass • 4 Participants</p>
          </div>
          <div className="bg-red-500/10 text-red-500 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            LIVE
          </div>
        </div>

        {/* Video Grid */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          {participants.map(p => (
            <div key={p.id} className={`relative bg-card rounded-xl border ${p.speaking ? 'border-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-border'} overflow-hidden flex items-center justify-center`}>
              {/* Mock Video Feed / Avatar */}
              <div className={`w-24 h-24 rounded-full ${p.color} flex items-center justify-center text-4xl font-bold text-white`}>
                {p.initial}
              </div>
              
              {/* Name Plate */}
              <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
                {p.name}
                {!micOn && p.id === 1 && <MicOff size={14} className="text-red-500" />}
              </div>
            </div>
          ))}
        </div>

        {/* Control Bar */}
        <div className="bg-card p-4 rounded-xl border border-border flex justify-center items-center gap-4">
          <button 
            onClick={() => setMicOn(!micOn)}
            className={`p-4 rounded-full transition-colors ${micOn ? 'bg-secondary hover:bg-secondary/80' : 'bg-red-500 text-white hover:bg-red-600'}`}
          >
            {micOn ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          
          <button 
            onClick={() => setCameraOn(!cameraOn)}
            className={`p-4 rounded-full transition-colors ${cameraOn ? 'bg-secondary hover:bg-secondary/80' : 'bg-red-500 text-white hover:bg-red-600'}`}
          >
            {cameraOn ? <Video size={24} /> : <VideoOff size={24} />}
          </button>
          
          <button className="p-4 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
            <MonitorUp size={24} />
          </button>
          
          <button className="p-4 rounded-full bg-secondary hover:bg-secondary/80 transition-colors hidden md:block">
            <Settings size={24} />
          </button>

          <button className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors ml-4">
            <PhoneOff size={24} />
          </button>
        </div>
      </div>

      {/* Right Sidebar (Chat/Participants) */}
      <div className="w-80 border-l border-border bg-card flex flex-col">
        <div className="flex border-b border-border">
          <button 
            className={`flex-1 p-4 font-medium border-b-2 transition-colors ${showSidebar === 'chat' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:bg-muted'}`}
            onClick={() => setShowSidebar('chat')}
          >
            <MessageSquare size={18} className="mx-auto mb-1" />
            <span className="text-sm">Chat</span>
          </button>
          <button 
            className={`flex-1 p-4 font-medium border-b-2 transition-colors ${showSidebar === 'participants' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:bg-muted'}`}
            onClick={() => setShowSidebar('participants')}
          >
            <Users size={18} className="mx-auto mb-1" />
            <span className="text-sm">People</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {showSidebar === 'chat' ? (
            <>
              <div className="bg-muted p-3 rounded-lg text-sm">
                <span className="font-bold text-emerald-500">Sarah Jenkins:</span> Welcome everyone! We will be starting in 2 minutes.
              </div>
              <div className="bg-muted p-3 rounded-lg text-sm">
                <span className="font-bold text-purple-500">Alex Chen:</span> Looking forward to this!
              </div>
            </>
          ) : (
            participants.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${p.color} flex items-center justify-center text-xs font-bold text-white`}>
                  {p.initial}
                </div>
                <div className="flex-1 text-sm font-medium">{p.name}</div>
                {p.speaking ? <Mic size={16} className="text-primary" /> : <MicOff size={16} className="text-muted-foreground" />}
              </div>
            ))
          )}
        </div>
        
        {showSidebar === 'chat' && (
          <div className="p-4 border-t border-border bg-background">
            <input 
              type="text" 
              placeholder="Send a message to everyone..." 
              className="w-full bg-card border border-border rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>
        )}
      </div>
    </div>
  )
}
