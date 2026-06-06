import React from 'react';
import { Check, Sparkles, Zap, Star } from 'lucide-react';

export default function Plans() {
  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar pb-32" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-black text-foreground mb-4">Choose Your Premium Plan</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Upgrade to unlock advanced features, analytics, and exclusive creator tools tailored for your success.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Basic Plan */}
          <div className="bg-card border border-border rounded-3xl p-8 shadow-sm flex flex-col hover:border-primary/50 transition-colors">
            <h3 className="text-xl font-bold text-foreground mb-2">Basic</h3>
            <p className="text-sm text-muted-foreground mb-6">Perfect for getting started</p>
            <div className="mb-6">
              <span className="text-4xl font-black text-foreground">$0</span>
              <span className="text-muted-foreground">/mo</span>
            </div>
            <ul className="flex flex-col gap-4 mb-8 flex-1">
              {[
                'Basic community access',
                'View public events',
                'Standard profile',
                'Join up to 3 groups'
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
            <button className="w-full py-3 rounded-xl font-bold text-sm bg-muted text-foreground hover:bg-muted/80 transition-colors">
              Current Plan
            </button>
          </div>

          {/* Pro Plan */}
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 rounded-3xl p-1 relative transform md:-translate-y-4 shadow-xl">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-lg whitespace-nowrap">
              <Star size={12} className="fill-yellow-900" /> Most Popular
            </div>
            <div className="bg-card rounded-[23px] p-8 flex flex-col h-full relative overflow-hidden">
              <div className="absolute -right-12 -top-12 w-40 h-40 bg-purple-500/20 blur-3xl rounded-full"></div>
              <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                Pro <Sparkles size={18} className="text-purple-500" />
              </h3>
              <p className="text-sm text-muted-foreground mb-6">For active creators</p>
              <div className="mb-6">
                <span className="text-4xl font-black text-foreground">$19</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <ul className="flex flex-col gap-4 mb-8 flex-1 relative z-10">
                {[
                  'Everything in Basic',
                  'Unlimited group creation',
                  'Advanced analytics dashboard',
                  'Priority support',
                  'Custom profile badge'
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-foreground font-medium">
                    <div className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center shrink-0">
                      <Check size={12} strokeWidth={3} />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90 transition-opacity shadow-md">
                Upgrade to Pro
              </button>
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className="bg-card border border-border rounded-3xl p-8 shadow-sm flex flex-col hover:border-primary/50 transition-colors">
            <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
              Business <Zap size={18} className="text-blue-500" />
            </h3>
            <p className="text-sm text-muted-foreground mb-6">For teams and organizations</p>
            <div className="mb-6">
              <span className="text-4xl font-black text-foreground">$49</span>
              <span className="text-muted-foreground">/mo</span>
            </div>
            <ul className="flex flex-col gap-4 mb-8 flex-1">
              {[
                'Everything in Pro',
                'Dedicated account manager',
                'API access',
                'White-label options',
                'Multiple admin seats'
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                  <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
            <button className="w-full py-3 rounded-xl font-bold text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
              Contact Sales
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
