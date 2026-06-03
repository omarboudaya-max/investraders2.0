import React from 'react';
import { ArrowRight, Plus } from 'lucide-react';

export default function Home() {
  return (
    <div className="w-full h-full flex flex-col gap-4 fade-in pb-2">
      {/* Hero Section & Sidebar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 w-full">
        
        {/* Left Side: Hero Articles */}
        <div className="flex flex-col xl:flex-row gap-3 w-full">
          {/* Main Featured Article */}
          <div className="relative flex-1 min-h-[260px] rounded-3xl overflow-hidden group cursor-pointer bg-card border border-border shadow-sm">
            <img 
              src="https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80" 
              alt="Hero Startup" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent" />
            
            <div className="absolute bottom-0 left-0 p-5 w-full md:w-3/4 flex flex-col gap-2">
              <h2 className="text-xl md:text-2xl font-black text-white leading-tight">
                The Future of AgriTech: Everything we know so far
              </h2>
              <p className="text-muted-foreground text-xs line-clamp-2">
                A new spin on sustainable farming will put a fresh perspective on vertical growth ecosystems and investment opportunities in the coming decade.
              </p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                <span>Sarah Jenkins</span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>3 min read</span>
              </div>
            </div>
            
            <div className="absolute bottom-5 right-5 hidden sm:flex">
              <button className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:scale-105 transition-transform shadow-lg shadow-primary/30">
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Vertical Small Articles */}
          <div className="w-full xl:w-[260px] flex flex-col gap-2">
            {[
              {
                img: 'https://images.unsplash.com/photo-1620825937374-87fc7d6bddc2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                title: 'The AI Revolution in Healthcare',
                desc: 'How machine learning is changing diagnostics.',
                author: 'Sam Johnson',
                read: '3 min read'
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
                desc: 'Decentralized finance is reshaping banks.',
                author: 'Jinny Laurens',
                read: '1 min read'
              }
            ].map((article, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-2 flex gap-2.5 items-center group cursor-pointer hover:border-primary/50 transition-colors shadow-sm flex-1">
                <img src={article.img} alt={article.title} className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex flex-col flex-1 justify-center">
                  <h4 className="text-[13px] font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{article.title}</h4>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5 mb-1">{article.desc}</p>
                  <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                    <span>{article.author}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{article.read}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Sidebar */}
        <div className="flex flex-col gap-3">
          {/* Activities */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">Activities</h3>
                <span className="bg-muted px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground border border-border/50">154</span>
              </div>
              <button className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/50">
                <ArrowRight size={12} />
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              {[
                { name: 'Tech Startups', type: 'Technology', members: '200.3k' },
                { name: 'AgriTech Rising', type: 'Agriculture', members: '80.4k' },
                { name: 'Eco Innovators', type: 'Ecology', members: '35.9k' }
              ].map((activity, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border">
                      <span className="font-bold text-[9px]">{activity.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer leading-tight">{activity.name}</span>
                      <span className="text-[10px] text-muted-foreground">{activity.type} • {activity.members}</span>
                    </div>
                  </div>
                  <button className="text-primary text-[10px] font-bold flex items-center gap-1 hover:bg-primary/10 px-2 py-1 rounded-full transition-colors">
                    <Plus size={10} /> JOIN
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          {/* Nearest Events */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">Nearest Events</h3>
                <span className="bg-muted px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground border border-border/50">230</span>
              </div>
              <button className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/50">
                <ArrowRight size={12} />
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              {[
                { day: '12', month: 'APR', title: 'Global Tech Summit', joined: '12.8k' },
                { day: '24', month: 'APR', title: 'AgriTech Network Meetup', joined: '3.2k' },
                { day: '30', month: 'APR', title: 'Sustainable Ecology Conf', joined: '1.1k' }
              ].map((event, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-10 rounded-lg border border-border/50 bg-muted/30 flex flex-col items-center justify-center relative overflow-hidden shadow-sm">
                       <div className="absolute top-0 w-full h-0.5 bg-primary/80"></div>
                       <span className="text-sm font-black text-foreground leading-none mt-1">{event.day}</span>
                       <span className="text-[8px] font-bold text-muted-foreground">{event.month}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer leading-tight">{event.title}</span>
                      <span className="text-[10px] text-muted-foreground">{event.joined} joined</span>
                    </div>
                  </div>
                  <button className="text-primary text-[10px] font-bold flex items-center gap-1 hover:bg-primary/10 px-2 py-1 rounded-full transition-colors">
                    <Plus size={10} /> JOIN
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Network */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">Network</h3>
                <span className="bg-muted px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground border border-border/50">1.2k</span>
              </div>
              <button className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/50">
                <ArrowRight size={12} />
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              {[
                { name: 'Alex Johnson', role: 'Angel Investor' },
                { name: 'Maria Garcia', role: 'Startup Founder' },
                { name: 'David Chen', role: 'Tech Enthusiast' }
              ].map((person, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-blue-500 flex items-center justify-center text-white font-bold text-[9px] shadow-sm">
                      {person.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer leading-tight">{person.name}</span>
                      <span className="text-[10px] text-muted-foreground">{person.role}</span>
                    </div>
                  </div>
                  <button className="text-[9px] font-bold bg-muted hover:bg-primary hover:text-primary-foreground text-foreground px-2.5 py-1 rounded-full transition-colors border border-border/50">
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Popular Forums */}
      <div className="w-full mt-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-foreground">Popular Forums</h3>
          <button className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/50">
            <ArrowRight size={12} />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
             { title: 'Tech Startups Hub', topic: 'Technology', members: '10.5k' },
             { title: 'AgriTech Innovators', topic: 'Agriculture', members: '14.6k' },
             { title: 'Sustainable Founders', topic: 'Ecology', members: '9.2k' },
             { title: 'Fintech Future', topic: 'Finance', members: '50.7k' }
          ].map((forum, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-3 flex items-center justify-between group cursor-pointer hover:border-primary/50 transition-colors shadow-sm hover:shadow-md">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center border border-border/50 shadow-inner group-hover:bg-primary/10 transition-colors">
                    <span className="font-bold text-primary">{forum.title.charAt(0)}</span>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors">{forum.title}</span>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                      <span className="bg-muted px-1.5 py-0.5 rounded-full border border-border/50">{forum.topic}</span>
                      <span className="flex items-center gap-0.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 flex items-center justify-center text-[7px] text-foreground">@</span>
                        {forum.members}
                      </span>
                    </div>
                 </div>
              </div>
              <span className="bg-muted px-2 py-0.5 rounded-full text-[10px] font-bold text-muted-foreground border border-border/50 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
                1.5k+
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
