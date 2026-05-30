import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Building, TrendingUp, Mail, Lock, User, AlertCircle, ArrowRight } from 'lucide-react'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Form State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  // Registration specific
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState('founder') // 'founder' | 'investor'

  const validatePassword = (pass) => {
    const hasNum = /[0-9]/.test(pass)
    const hasSpec = /[^A-Za-z0-9]/.test(pass)
    if (pass.length < 8 || !hasNum || !hasSpec) {
      return 'Password must be at least 8 characters and contain at least 1 number and 1 special character.'
    }
    return null
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError("Please fill in all required fields.")
      return
    }

    if (!isLogin) {
      if (!firstName || !lastName) {
        setError("Please provide your first and last name.")
        return
      }
      
      const passError = validatePassword(password)
      if (passError) {
        setError(passError)
        return
      }
    }

    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              firstName,
              lastName,
              role
            }
          }
        })
        if (error) throw error
        
        // Supabase auto-logins after signup if email confirmation isn't required.
        // The trigger in the DB will handle creating the public.users record.
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-screen bg-background flex flex-col justify-center items-center p-4">
      
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-primary mb-2">Investraders</h1>
        <p className="text-muted-foreground">The premier network for founders and investors.</p>
      </div>

      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        
        {/* Toggle */}
        <div className="flex border-b border-border">
          <button 
            onClick={() => { setIsLogin(true); setError(null) }}
            className={`flex-1 py-4 text-center font-semibold transition-colors ${isLogin ? 'bg-background text-primary border-b-2 border-primary' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Sign In
          </button>
          <button 
            onClick={() => { setIsLogin(false); setError(null) }}
            className={`flex-1 py-4 text-center font-semibold transition-colors ${!isLogin ? 'bg-background text-primary border-b-2 border-primary' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleAuth} className="p-8 flex flex-col gap-5">
          
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLogin && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">First Name</label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                      type="text" 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-primary transition-colors"
                      placeholder="John"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Last Name</label>
                  <input 
                    type="text" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 outline-none focus:border-primary transition-colors"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">I am a...</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setRole('founder')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors ${role === 'founder' ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                  >
                    <Building size={18} /> Founder
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('investor')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors ${role === 'investor' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-bold' : 'border-border text-muted-foreground hover:border-emerald-500/50'}`}
                  >
                    <TrendingUp size={18} /> Investor
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Email Address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-primary transition-colors"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-primary transition-colors"
                placeholder="••••••••"
              />
            </div>
            {!isLogin && (
              <p className="text-xs text-muted-foreground mt-1">Must be at least 8 characters, 1 number, 1 special character.</p>
            )}
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-bold mt-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            {!loading && <ArrowRight size={18} />}
          </button>
          
        </form>
      </div>
      
      <p className="text-sm text-muted-foreground mt-8 text-center max-w-sm">
        By continuing, you agree to Investraders' Terms of Service and Privacy Policy.
      </p>

    </div>
  )
}
