import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Play, CheckCircle, Search, CreditCard, Banknote, ShieldCheck, X, PlayCircle } from 'lucide-react'

const MOCK_COURSE = {
  id: 'how-to-build-startup-with-ai',
  title: 'How to Build Your Startup Using AI',
  description: 'Master the future of entrepreneurship with our comprehensive 8-module masterclass.',
  syllabus: [
    { title: "Introduction to AI-Powered Entrepreneurship", desc: "Understanding how AI is transforming the startup landscape" },
    { title: "Idea Validation with AI Tools", desc: "Use AI to validate your business idea before investing time and money" },
    { title: "Market Research Using AI", desc: "Leverage AI for comprehensive market analysis and competitor research" },
    { title: "Building Your MVP Strategy", desc: "Plan and design your Minimum Viable Product" },
    { title: "AI-Assisted Business Model Canvas", desc: "Create a robust business model using AI frameworks" },
    { title: "Pitch Deck Mastery", desc: "Create compelling pitch decks that attract investors" },
    { title: "Financial Projections & Planning", desc: "Build realistic financial models for your startup" },
    { title: "Go-to-Market Strategy", desc: "Launch your product with an AI-optimized marketing strategy" }
  ],
  price: 150.00,
  original_price: 300.00,
  next_session: 'October 15th, 2026'
}

export default function Courses() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('market') // market, enrolled
  const [showModal, setShowModal] = useState(false)
  const [modalStep, setModalStep] = useState(1) // 1: details, 2: payment, 3: success
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [activeVideo, setActiveVideo] = useState(null)
  const [enrollmentId, setEnrollmentId] = useState(null)
  const [enrolledCourses, setEnrolledCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [proofFile, setProofFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  
  // Form State
  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    email: profile?.email || '',
    age: '',
    country: '',
    education: '',
    professional: '',
    motivation: ''
  })
  

  useEffect(() => {
    if (!profile) return
    
    fetchEnrolledCourses()

    const subscription = supabase
      .channel('public:course_enrollments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'course_enrollments', filter: `user_id=eq.${profile.id}` },
        () => {
          fetchEnrolledCourses()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [profile])

  const fetchEnrolledCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('user_id', profile.id)
        .order('enrolled_at', { ascending: false })
      
      if (error) throw error
      setEnrolledCourses(data || [])
    } catch (err) {
      console.error("Error fetching enrolled courses:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleStep1Submit = (e) => {
    e.preventDefault()
    setModalStep(2)
  }

  const handlePaymentSubmit = async () => {
    if (!paymentMethod) {
      alert("Please select a payment method")
      return
    }

    if (paymentMethod === 'card') {
      alert("Card payments are coming soon! Please use the PayPal option for immediate access.")
      return
    }

    if (paymentMethod === 'manual' && !proofFile) {
      alert("Please upload a proof of payment")
      return
    }

    setIsUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = profile?.id || session?.user?.id
      if (!userId) throw new Error("User session not found. Please log in again.")

      const newId = 'ENR-' + Math.random().toString(36).substr(2, 9).toUpperCase()
      const accessCode = Math.random().toString(36).substr(2, 6).toUpperCase()
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${newId}`
      
      let uploadedProofUrl = null
      
      if (paymentMethod === 'manual') {
        const fileExt = proofFile.name.split('.').pop()
        const fileName = `${newId}.${fileExt}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('course_proofs')
          .upload(fileName, proofFile)
          
        if (uploadError && uploadError.message !== 'The resource was not found') {
          // It's possible the bucket doesn't exist, we'll just skip upload if it's missing for now
          console.error("Upload error:", uploadError)
        } else if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('course_proofs').getPublicUrl(fileName)
          uploadedProofUrl = publicUrl
        }
      }
      
      const { error } = await supabase
        .from('course_enrollments')
        .insert([{
          id: newId,
          user_id: userId,
          email: formData.email,
          course_id: MOCK_COURSE.id,
          course: MOCK_COURSE.title,
          price: MOCK_COURSE.price,
          payment_status: 'unpaid',
          payment_provider: paymentMethod === 'manual' ? 'manual' : 'paypal',
          first_name: formData.firstName,
          last_name: formData.lastName,
          age: formData.age,
          country: formData.country,
          education: formData.education,
          professional: formData.professional,
          motivation: formData.motivation,
          access_code: accessCode,
          qr_url: qrUrl,
          proof_url: uploadedProofUrl
        }])
      
      if (error) throw error

      setEnrollmentId(newId)
      
      if (paymentMethod === 'paypal') {
        window.open(`https://paypal.me/CobraAhmed`, '_blank')
      }
      
      setModalStep(3)
      fetchEnrolledCourses()
    } catch (err) {
      console.error("Error processing enrollment:", err)
      alert(`Failed to process enrollment: ${err.message || JSON.stringify(err)}`)
    } finally {
      setIsUploading(false)
    }
  }

  const resetModal = () => {
    setShowModal(false)
    setModalStep(1)
    setEnrollmentId(null)
    setPaymentMethod('')
  }

  const currentEnrollment = enrolledCourses.find(c => c.course_id === MOCK_COURSE.id)
  const isEnrolled = !!currentEnrollment
  const isFullyPaid = currentEnrollment?.payment_status === 'paid'

  return (
    <div className="flex flex-col w-full h-full bg-background overflow-y-auto">
      
      {/* Header */}
      <div className="p-8 border-b border-border bg-card">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Investraders Academy</h1>
            <p className="text-muted-foreground mt-1">Accelerate your startup journey with exclusive masterclasses.</p>
          </div>
          <div className="flex bg-muted p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('market')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${activeTab === 'market' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Course Marketplace
            </button>
            <button 
              onClick={() => setActiveTab('enrolled')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${activeTab === 'enrolled' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              My Courses
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          
          {activeTab === 'market' ? (
            /* MARKETPLACE VIEW */
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col lg:flex-row">
              {/* Course Media / Video iframe */}
              <div className="lg:w-1/2 relative bg-black flex flex-col justify-center min-h-[300px] lg:min-h-full">
                <iframe 
                  className="w-full aspect-video" 
                  src="https://www.youtube.com/embed/i_kmrDifdoI?rel=0" 
                  title="Course Introduction" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
              </div>
              
              {/* Course Info */}
              <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center">
                <div className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider rounded-full w-max mb-4">
                  Flagship Masterclass
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-4">{MOCK_COURSE.title}</h2>
                <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                  {MOCK_COURSE.description}
                </p>
                
                <div className="flex flex-col gap-3 mb-8 max-h-[300px] overflow-y-auto pr-2">
                  {MOCK_COURSE.syllabus.map((module, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-sm">{module.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{module.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center gap-6 mb-8">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">${MOCK_COURSE.price}</span>
                    <span className="text-lg text-muted-foreground line-through">${MOCK_COURSE.original_price}</span>
                  </div>
                  <div className="text-sm text-amber-500 font-medium bg-amber-500/10 px-3 py-1 rounded-full">50% Off Limited Time</div>
                </div>

                {isEnrolled ? (
                  <button className={`w-full py-4 rounded-xl font-bold border flex items-center justify-center gap-2 cursor-default ${isFullyPaid ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30'}`}>
                    {isFullyPaid ? <><CheckCircle size={20} /> You are enrolled in this course</> : 'Your payment is pending review'}
                  </button>
                ) : (
                  <button 
                    onClick={() => setShowModal(true)}
                    className="w-full py-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg hover:shadow-primary/25"
                  >
                    Enroll Now
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* MY COURSES VIEW */
            <div>
              <h2 className="text-2xl font-bold mb-6">Enrolled Courses</h2>
              {loading ? (
                <div className="text-muted-foreground">Loading your courses...</div>
              ) : enrolledCourses.length === 0 ? (
                <div className="text-center p-16 bg-card rounded-2xl border border-border">
                  <Play size={48} className="mx-auto text-muted-foreground mb-4 opacity-30" />
                  <h3 className="text-xl font-semibold mb-2">No courses yet</h3>
                  <p className="text-muted-foreground mb-6">You haven't enrolled in any masterclasses.</p>
                  <button onClick={() => setActiveTab('market')} className="text-primary font-medium hover:underline">
                    Browse Marketplace
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {enrolledCourses.map(enrollment => {
                    const isPaid = enrollment.payment_status === 'paid'
                    return (
                    <div key={enrollment.id} className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col">
                      <div className="h-40 bg-muted relative flex items-center justify-center">
                        <img src="/training_banner.png" alt="Course Banner" className="absolute inset-0 w-full h-full object-cover opacity-40" onError={(e) => e.target.style.display='none'} />
                        <div className={`absolute top-4 right-4 bg-background/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${isPaid ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {isPaid ? <CheckCircle size={14} /> : null}
                          {isPaid ? 'Enrolled' : 'Pending Payment'}
                        </div>
                        <Play size={48} className="text-foreground/50" />
                      </div>
                      <div className="p-6">
                        {isPaid && (
                          <div className="mb-4 bg-white p-2 rounded-xl inline-block shadow-sm border border-gray-100">
                            <img src={enrollment.qr_url || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${enrollment.id}`} alt="Access QR Code" className="w-24 h-24 mx-auto" />
                            <div className="text-center text-[10px] mt-1 text-gray-800 font-bold uppercase tracking-wider">Access Pass</div>
                          </div>
                        )}
                        <h3 className="font-bold text-xl mb-2">{enrollment.course}</h3>
                        <p className="text-sm text-muted-foreground mb-6">Enrollment ID: <span className="font-mono text-xs">{enrollment.id}</span></p>
                        <div className="flex justify-between items-center pt-4 border-t border-border">
                          <span className={`text-xs font-bold uppercase ${isPaid ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {enrollment.payment_status.replace('_', ' ')}
                          </span>
                          {isPaid && (
                            <button 
                              onClick={() => {
                                setActiveVideo(enrollment.courses?.video_url)
                                setShowVideoModal(true)
                              }}
                              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                              Enter Course
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ENROLLMENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <button onClick={resetModal} className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
              <X size={20} />
            </button>
            
            <div className="p-8">
              {/* Stepper */}
              <div className="flex items-center justify-center mb-8">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${modalStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>1</div>
                <div className={`w-16 h-1 mx-2 ${modalStep >= 2 ? 'bg-primary' : 'bg-muted'}`}></div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${modalStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</div>
                <div className={`w-16 h-1 mx-2 ${modalStep >= 3 ? 'bg-primary' : 'bg-muted'}`}></div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${modalStep >= 3 ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>3</div>
              </div>

              {/* STEP 1: APPLICATION */}
              {modalStep === 1 && (
                <form onSubmit={handleStep1Submit} className="flex flex-col gap-4">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-foreground">Course Application</h2>
                    <p className="text-muted-foreground">Please fill out your details to enroll in {MOCK_COURSE.title}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">First Name</label>
                      <input required type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">Last Name</label>
                      <input required type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary" />
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">Email</label>
                    <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">Age</label>
                      <input required type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">Country</label>
                      <input required type="text" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} className="bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-4">
                    <button type="submit" className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors">
                      Continue to Payment
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: PAYMENT */}
              {modalStep === 2 && (
                <div className="flex flex-col gap-6">
                  <div className="text-center mb-2">
                    <h2 className="text-2xl font-bold text-foreground">Select Payment Method</h2>
                    <p className="text-muted-foreground">Total due: <span className="font-bold text-foreground">${MOCK_COURSE.price}</span></p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button 
                      onClick={() => setPaymentMethod('card')}
                      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all ${paymentMethod === 'card' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/50'}`}
                    >
                      <CreditCard size={32} />
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-sm">Credit Card</span>
                        <span className="text-[10px] uppercase font-bold text-primary mt-1 px-2 py-0.5 bg-primary/10 rounded-full">Coming Soon</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('paypal')}
                      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all ${paymentMethod === 'paypal' ? 'border-blue-500 bg-blue-500/5 text-blue-500' : 'border-border bg-background text-muted-foreground hover:border-blue-500/50'}`}
                    >
                      <ShieldCheck size={32} />
                      <span className="font-semibold text-sm">PayPal</span>
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('manual')}
                      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all ${paymentMethod === 'manual' ? 'border-amber-500 bg-amber-500/5 text-amber-500' : 'border-border bg-background text-muted-foreground hover:border-amber-500/50'}`}
                    >
                      <Banknote size={32} />
                      <span className="font-semibold text-sm text-center">Bank Transfer / Cash</span>
                    </button>
                  </div>

                  {paymentMethod === 'manual' && (
                    <div className="mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                      <h4 className="font-bold text-amber-600 mb-2">Upload Proof of Payment</h4>
                      <p className="text-sm text-muted-foreground mb-4">Please upload an image of your bank transfer receipt or cash deposit slip.</p>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => setProofFile(e.target.files[0])}
                        className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                      />
                    </div>
                  )}

                  <div className="flex justify-between mt-4 pt-6 border-t border-border">
                    <button onClick={() => setModalStep(1)} className="px-6 py-2 text-muted-foreground hover:text-foreground font-medium transition-colors">
                      Back
                    </button>
                    <button 
                      onClick={handlePaymentSubmit}
                      disabled={!paymentMethod || isUploading}
                      className="px-8 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {isUploading ? 'Processing...' : 'Complete Enrollment'}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: SUCCESS & QR CODE */}
              {modalStep === 3 && (
                <div className="flex flex-col items-center text-center gap-6 py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mb-2">
                    <CheckCircle size={32} />
                  </div>
                  
                  <div>
                    <h2 className="text-3xl font-bold text-foreground mb-2">Enrollment Successful!</h2>
                    <p className="text-muted-foreground">You are now enrolled in {MOCK_COURSE.title}.</p>
                  {paymentMethod === 'paypal' && (
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl mt-2 text-center w-full">
                      <p className="text-blue-600 text-sm font-medium mb-3">
                        We have opened PayPal in a new tab. If it didn't open, click the button below.
                      </p>
                      <a href="https://paypal.me/CobraAhmed" target="_blank" rel="noreferrer" className="inline-block px-6 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors">
                        Pay with PayPal
                      </a>
                      <p className="text-blue-500/70 text-xs mt-3">
                        We will activate your access once your payment is verified.
                      </p>
                    </div>
                  )}
                  {paymentMethod === 'manual' && (
                    <p className="text-amber-500 text-sm mt-2 font-medium bg-amber-500/10 px-4 py-2 rounded-lg inline-block">
                      Your proof of payment is pending manual verification by our admins.
                    </p>
                  )}
                  </div>

                  {/* Hide QR code if unpaid */}
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-border mt-4 opacity-50 grayscale blur-[2px] pointer-events-none">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${enrollmentId}`} 
                      alt="Enrollment QR Code" 
                      className="w-[200px] h-[200px]"
                    />
                  </div>
                  <p className="text-sm font-mono text-muted-foreground mt-2">ID: {enrollmentId}</p>
                  
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mt-4">
                    Once your payment is marked as Paid, your QR code will unlock and you can access the course.
                  </p>

                  <button 
                    onClick={resetModal}
                    className="w-full py-3 mt-6 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors"
                  >
                    Go to My Courses
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Viewer Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <button 
            onClick={() => setShowVideoModal(false)}
            className="absolute top-6 right-6 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          
          <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10 relative flex items-center justify-center">
            {activeVideo ? (
              <iframe 
                width="100%" 
                height="100%" 
                src={activeVideo.replace('watch?v=', 'embed/')} 
                title="Course Video" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            ) : (
              <div className="text-center text-white/50">
                <PlayCircle size={64} className="mx-auto mb-4 opacity-50" />
                <p>No video URL provided for this course.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
