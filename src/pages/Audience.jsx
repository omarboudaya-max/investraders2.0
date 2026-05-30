import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Users, Banknote, ShieldAlert, CheckCircle, Search, ExternalLink } from 'lucide-react'
import { Navigate } from 'react-router-dom'

export default function Audience() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('users') // 'users' or 'enrollments'
  const [users, setUsers] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile && profile.role === 'admin') {
      fetchData()
    }
  }, [profile])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersRes, enrollmentsRes] = await Promise.all([
        supabase.from('users').select('*').order('joined_at', { ascending: false }),
        supabase.from('course_enrollments').select('*').order('created_at', { ascending: false })
      ])
      
      if (usersRes.error) throw usersRes.error
      if (enrollmentsRes.error) throw enrollmentsRes.error
      
      setUsers(usersRes.data || [])
      setEnrollments(enrollmentsRes.data || [])
    } catch (err) {
      console.error("Error fetching admin data:", err)
    } finally {
      setLoading(false)
    }
  }

  const markAsPaid = async (enrollmentId) => {
    try {
      const { error } = await supabase
        .from('course_enrollments')
        .update({ payment_status: 'paid' })
        .eq('id', enrollmentId)
      
      if (error) throw error
      
      // Update local state
      setEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, payment_status: 'paid' } : e))
    } catch (err) {
      console.error("Error updating payment status:", err)
      alert("Failed to update status. Are you an admin?")
    }
  }

  // Security check: only admins
  if (profile && profile.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center">
        <ShieldAlert size={64} className="text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You must be an administrator to view this page.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-full bg-background p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Manage Audience</h1>
            <p className="text-muted-foreground mt-1">Admin control center for users and transactions.</p>
          </div>
          <div className="flex bg-muted p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('users')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${activeTab === 'users' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Users size={16} className="inline mr-2" /> Members
            </button>
            <button 
              onClick={() => setActiveTab('enrollments')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${activeTab === 'enrollments' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Banknote size={16} className="inline mr-2" /> Course Payments
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading admin data...</p>
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            
            {activeTab === 'users' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                    <th className="p-4 font-medium">Name</th>
                    <th className="p-4 font-medium">Email</th>
                    <th className="p-4 font-medium">Role</th>
                    <th className="p-4 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-4 font-medium">{user.first_name} {user.last_name}</td>
                      <td className="p-4 text-muted-foreground text-sm">{user.email}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                          user.role === 'admin' ? 'bg-red-500/10 text-red-500' :
                          user.role === 'investor' ? 'bg-emerald-500/10 text-emerald-500' :
                          'bg-blue-500/10 text-blue-500'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">
                        {user.joined_at ? new Date(user.joined_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan="4" className="p-8 text-center text-muted-foreground">No members found.</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'enrollments' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                    <th className="p-4 font-medium">Applicant</th>
                    <th className="p-4 font-medium">Course</th>
                    <th className="p-4 font-medium">Method & Proof</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrollments.map(enr => {
                    const isPaid = enr.payment_status === 'paid' || enr.payment_status === 'completed'
                    return (
                      <tr key={enr.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4">
                          <div className="font-medium">{enr.first_name} {enr.last_name}</div>
                          <div className="text-xs text-muted-foreground">{enr.email}</div>
                          <div className="text-xs font-mono text-muted-foreground mt-1">ID: {enr.id}</div>
                        </td>
                        <td className="p-4 font-medium">{enr.course}</td>
                        <td className="p-4">
                          <div className="text-sm uppercase font-bold text-muted-foreground">{enr.payment_provider}</div>
                          {enr.proof_url && (
                            <a href={enr.proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                              View Proof <ExternalLink size={12} />
                            </a>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                            isPaid ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            {isPaid ? 'Paid' : enr.payment_status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {!isPaid && (
                            <button 
                              onClick={() => markAsPaid(enr.id)}
                              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors"
                            >
                              Mark as Paid
                            </button>
                          )}
                          {isPaid && <CheckCircle size={20} className="text-emerald-500 ml-auto" />}
                        </td>
                      </tr>
                    )
                  })}
                  {enrollments.length === 0 && (
                    <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">No enrollments found.</td></tr>
                  )}
                </tbody>
              </table>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
