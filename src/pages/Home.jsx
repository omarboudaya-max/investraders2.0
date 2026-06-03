import React from 'react';
import { ArrowRight, Plus } from 'lucide-react';

export default function Home() {
  return (
    <div className="w-full flex gap-6 fade-in pb-12">
      
      {/* Left Column (Hero + Forums) */}
      <div className="flex-1 flex flex-col gap-8 min-w-0">
        
        {/* Hero Card */}
        <div className="w-full relative rounded-3xl overflow-hidden shadow-sm h-[480px] bg-card border border-border group">
          {/* Background Image */}
          <img 
            src="https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80" 
            alt="Hero Startup" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
          />
          {/* Dark gradient from right side to make articles readable */}
          <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/20 to-transparent" />
          
          {/* Left Text Box (Bottom Left) */}
          <div className="absolute bottom-6 left-6 w-[55%] bg-[#0f0f13]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 pr-20 flex flex-col justify-center">
            <h2 className="text-2xl font-black text-white leading-tight mb-3">
              The Future of AgriTech:<br/>Everything we know so far
            </h2>
            <p className="text-white/60 text-sm line-clamp-2 mb-4">
              A new spin on sustainable farming will put a fresh perspective on vertical growth ecosystems and investment opportunities in the coming decade.
            </p>
            <div className="flex items-center gap-3 text-xs text-white/50">
              <span>Sarah Jenkins</span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span>3 min read</span>
            </div>
            
            <button className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors shadow-lg">
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Right Small Articles (Right aligned) */}
          <div className="absolute right-6 top-6 bottom-6 w-[35%] flex flex-col justify-between">
            {[
              {
                img: 'https://images.unsplash.com/photo-1620825937374-87fc7d6bddc2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                title: 'The AI Revolution in Healthcare',
                desc: 'Machine learning changing diagnostics.',
                author: 'Sam Johnson',
                read: '3 min read',
                active: true
              },
              {
                img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                title: 'Sustainable Energy Startups',
                desc: 'Top 5 companies to watch this year.',
                author: 'Paul Peers',
                read: '10 min read'
              },
              {
                img: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                title: 'Fintech and Blockchain',
                desc: 'Decentralized finance reshaping banks.',
                author: 'Jinny Laurens',
                read: '1 min read'
              },
              {
                img: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                title: 'Space Tech Investments',
                desc: 'Private sectors reaching for the stars.',
                author: 'Bayron Kam',
                read: '6 min read'
              }
            ].map((article, i) => (
              <div key={i} className={`rounded-2xl p-3 flex gap-4 items-center cursor-pointer transition-colors relative ${article.active ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                {article.active && (
                   <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-md"></div>
                )}
                <img src={article.img} alt={article.title} className="w-16 h-16 rounded-xl object-cover shadow-md" />
                <div className="flex flex-col flex-1 justify-center overflow-hidden">
                  <h4 className="text-[13px] font-bold text-white line-clamp-1">{article.title}</h4>
                  <p className="text-[11px] text-white/70 line-clamp-1 mt-0.5 mb-1.5">{article.desc}</p>
                  <div className="flex items-center gap-2 text-[10px] text-white/50">
                    <span>{article.author}</span>
                    <span className="w-1 h-1 rounded-full bg-white/30" />
                    <span>{article.read}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Popular Forums */}
        <div className="w-full flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-bold text-foreground">Popular Forums</h3>
            <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/50">
              <ArrowRight size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
               { title: 'Tech Startups Hub', topic: 'Technology', members: '10.5k' },
               { title: 'AgriTech Innovators', topic: 'Agriculture', members: '14.6k' },
               { title: 'Sustainable Founders', topic: 'Ecology', members: '9.2k' },
               { title: 'Fintech Future', topic: 'Finance', members: '50.7k' }
            ].map((forum, i) => (
              <div key={i} className="bg-card border border-border rounded-3xl p-4 flex items-center justify-between group cursor-pointer hover:border-primary/50 transition-colors shadow-sm">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border border-border/50 shadow-inner group-hover:bg-primary/10 transition-colors">
                      <span className="font-bold text-primary text-lg">{forum.title.charAt(0)}</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{forum.title}</span>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full border border-muted-foreground/30 flex items-center justify-center text-[7px] text-foreground">@</span>
                          {forum.topic}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-muted-foreground/30 flex items-center justify-center text-[7px] text-foreground">@</span>
                          {forum.members} members
                        </span>
                      </div>
                   </div>
                </div>
                <span className="bg-muted px-3 py-1 rounded-full text-[10px] font-bold text-muted-foreground border border-border/50 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  1.5k+
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column (Sidebar) */}
      <div className="w-[350px] shrink-0 flex flex-col gap-6">
        
        {/* Activities */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-foreground">Activities</h3>
              <span className="bg-muted px-2 py-0.5 rounded-md text-xs font-medium text-muted-foreground border border-border/50">154</span>
            </div>
            <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/50">
              <ArrowRight size={14} />
            </button>
          </div>
          
          <div className="flex flex-col gap-5">
            {[
              { name: 'Tech Startups', type: 'Technology', members: '200.3k' },
              { name: 'AgriTech Rising', type: 'Agriculture', members: '80.4k' },
              { name: 'Eco Innovators', type: 'Ecology', members: '35.9k' }
            ].map((activity, i) => (
              <div key={i} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border relative">
                    <span className="font-bold text-xs">{activity.name.substring(0, 2).toUpperCase()}</span>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-background flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer">{activity.name}</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">{activity.type} • {activity.members}</span>
                  </div>
                </div>
                <button className="text-blue-500 text-xs font-bold flex items-center gap-1 hover:text-blue-400 transition-colors">
                  <Plus size={14} /> JOIN
                </button>
              </div>
            ))}
          </div>
        </div>
        
        {/* Nearest Events */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-foreground">Nearest Events</h3>
              <span className="bg-muted px-2 py-0.5 rounded-md text-xs font-medium text-muted-foreground border border-border/50">230</span>
            </div>
            <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/50">
              <ArrowRight size={14} />
            </button>
          </div>
          
          <div className="flex flex-col gap-5">
            {[
              { day: '12', month: 'APR', title: 'Global Tech Summit', joined: '12.8k' },
              { day: '24', month: 'APR', title: 'AgriTech Network Meetup', joined: '3.2k' },
              { day: '30', month: 'APR', title: 'Sustainable Ecology Conf', joined: '1.1k' }
            ].map((event, i) => (
              <div key={i} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-12 rounded-xl border border-border bg-transparent flex flex-col items-center justify-center relative overflow-hidden shadow-sm">
                     <div className="absolute top-0 w-full h-1 bg-yellow-500/80"></div>
                     <span className="text-sm font-black text-foreground leading-none mt-1.5">{event.day}</span>
                     <span className="text-[9px] font-bold text-muted-foreground mt-0.5">{event.month}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer">{event.title}</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">{event.joined} people joined</span>
                  </div>
                </div>
                <button className="text-blue-500 text-xs font-bold flex items-center gap-1 hover:text-blue-400 transition-colors">
                  <Plus size={14} /> JOIN
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Network */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-foreground">Network</h3>
              <span className="bg-muted px-2 py-0.5 rounded-md text-xs font-medium text-muted-foreground border border-border/50">1.2k</span>
            </div>
            <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/50">
              <ArrowRight size={14} />
            </button>
          </div>
          
          <div className="flex flex-col gap-5">
            {[
              { name: 'Alex Johnson', role: 'Angel Investor', status: 'LIVE' },
              { name: 'Maria Garcia', role: 'Startup Founder' },
              { name: 'David Chen', role: 'Tech Enthusiast' }
            ].map((person, i) => (
              <div key={i} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-[10px] shadow-sm relative">
                    {person.name.substring(0, 2).toUpperCase()}
                    {person.status && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-background flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer">{person.name}</span>
                    {person.status ? (
                      <span className="text-[11px] text-red-500 font-medium flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        {person.status}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground mt-0.5">{person.role}</span>
                    )}
                  </div>
                </div>
                {person.status ? (
                  <button className="text-[10px] font-bold bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-md transition-colors border border-blue-500/20">
                    CONNECT
                  </button>
                ) : (
                  <button className="text-[10px] font-bold bg-muted hover:bg-primary hover:text-primary-foreground text-foreground px-3 py-1.5 rounded-md transition-colors border border-border/50">
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
