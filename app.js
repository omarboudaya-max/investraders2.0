/* =============================================
   INVESTRADE — JavaScript
   Powered by Firebase Auth & Firestore
   ============================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---- Utility ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(msg, type = 'success', duration = 3000) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = 'toast'; }, duration);
}

// ---- Navbar scroll behavior ----
const navbar = $('#navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });

// ---- Mobile menu toggle ----
const hamburger = $('#hamburger');
const mobileMenu = $('#mobileMenu');
let menuOpen = false;

hamburger.addEventListener('click', () => {
  menuOpen = !menuOpen;
  mobileMenu.classList.toggle('open', menuOpen);
  // animate hamburger
  const spans = hamburger.querySelectorAll('span');
  if (menuOpen) {
    spans[0].style.cssText = 'transform: rotate(45deg) translate(5px, 5px)';
    spans[1].style.cssText = 'opacity: 0; width: 0';
    spans[2].style.cssText = 'transform: rotate(-45deg) translate(5px, -5px)';
  } else {
    spans.forEach(s => s.style.cssText = '');
  }
});

// Close mobile menu on link click
$$('.mobile-link').forEach(link => {
  link.addEventListener('click', () => {
    menuOpen = false;
    mobileMenu.classList.remove('open');
    hamburger.querySelectorAll('span').forEach(s => s.style.cssText = '');
  });
});

// Close menu on outside click
document.addEventListener('click', (e) => {
  if (menuOpen && !hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
    menuOpen = false;
    mobileMenu.classList.remove('open');
    hamburger.querySelectorAll('span').forEach(s => s.style.cssText = '');
  }
});

// ---- Scroll-reveal animation ----
const revealEls = $$('.reveal');
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);
revealEls.forEach(el => observer.observe(el));

// Auto-add reveal classes to section children
document.querySelectorAll('.feature-card, .step-item, .testimonial-card, .pricing-card, .ecosystem-card').forEach((el, i) => {
  el.classList.add('reveal');
  if (i % 5 === 1) el.classList.add('reveal-delay-1');
  if (i % 5 === 2) el.classList.add('reveal-delay-2');
  if (i % 5 === 3) el.classList.add('reveal-delay-3');
  if (i % 5 === 4) el.classList.add('reveal-delay-4');
});

// Re-run observer for newly added
revealEls.forEach(el => observer.observe(el));
document.querySelectorAll('.reveal:not([class*="visible"])').forEach(el => observer.observe(el));

// ---- Pricing Toggle ----
let isAnnual = false;

window.setMonthly = function() {
  isAnnual = false;
  $('#monthlyBtn').classList.add('active');
  $('#annualBtn').classList.remove('active');
  updatePrices();
};

window.setAnnual = function() {
  isAnnual = true;
  $('#annualBtn').classList.add('active');
  $('#monthlyBtn').classList.remove('active');
  updatePrices();
};

function updatePrices() {
  $$('.price-amount').forEach(el => {
    const val = isAnnual ? el.dataset.annual : el.dataset.monthly;
    el.style.transform = 'scale(0.8)';
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = val;
      el.style.transform = 'scale(1)';
      el.style.opacity = '1';
      el.style.transition = 'all 0.2s';
    }, 120);
  });
}

// ---- Auth session management (Firebase) ----
let currentUserProfile = null;
let selectedRole = 'founder';

function updateNavForUser() {
  const loginBtn = $('#loginBtn');
  const getStartedBtn = $('#getStartedBtn');
  
  if (currentUserProfile) {
    loginBtn.textContent = `Hello, ${currentUserProfile.firstName}`;
    loginBtn.href = '#';
    loginBtn.style.fontWeight = '600';
    getStartedBtn.textContent = 'Dashboard';
    getStartedBtn.href = '#';
  } else {
    loginBtn.textContent = 'Sign In';
    loginBtn.href = '#login';
    loginBtn.style.fontWeight = '500';
    getStartedBtn.textContent = 'Get Started';
    getStartedBtn.href = '#register';
  }
}

if (auth) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          currentUserProfile = docSnap.data();
        } else {
          currentUserProfile = { firstName: 'User' }; // fallback
        }
      } catch(err) {
        console.error("Error fetching user profile:", err);
      }
    } else {
      currentUserProfile = null;
    }
    updateNavForUser();
  });
}

window.selectRole = function(role) {
  selectedRole = role;
  $('#founderRole').classList.toggle('active', role === 'founder');
  $('#investorRole').classList.toggle('active', role === 'investor');
  
  const founderFields = $('#founderFields');
  const investorFields = $('#investorFields');
  if (role === 'founder') {
    founderFields.style.display = 'block';
    investorFields.style.display = 'none';
  } else {
    founderFields.style.display = 'none';
    investorFields.style.display = 'block';
  }
};

// ---- Modal system ----
window.openModal = function(id) {
  const modal = $(`#${id}`);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
};

window.closeModal = function(id) {
  const modal = $(`#${id}`);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
};

window.switchModal = function(fromId, toId) {
  closeModal(fromId);
  setTimeout(() => openModal(toId), 100);
};

// Close on overlay click
$$('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      const id = overlay.id;
      closeModal(id);
    }
  });
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    $$('.modal-overlay.open').forEach(m => closeModal(m.id));
  }
});

// ---- Trigger modals from nav ----
$('#loginBtn').addEventListener('click', (e) => {
  if (currentUserProfile) {
    e.preventDefault();
    if (auth && confirm('Do you want to sign out?')) {
      signOut(auth).then(() => {
        showToast('You have been signed out.', 'success');
      });
    }
  } else {
    e.preventDefault();
    openModal('loginModal');
  }
});
$('#getStartedBtn').addEventListener('click', (e) => {
  if (currentUserProfile) {
    e.preventDefault();
    openDashboard();
  } else {
    e.preventDefault();
    openModal('registerModal');
  }
});

// CTA buttons → register
$$('a[href="#register"]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('registerModal');
  });
});
$$('a[href="#login"]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('loginModal');
  });
});

// ---- Login handler ----
window.handleLogin = async function(e) {
  e.preventDefault();
  if (!auth) {
    showToast('Firebase is not configured. Please add your credentials in app.js.', 'error', 4000);
    return;
  }

  const email = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;

  if (!email || !password) {
    showToast('Please fill in all fields.', 'error');
    return;
  }

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Signing in...';
    submitBtn.disabled = true;

    await signInWithEmailAndPassword(auth, email, password);
    closeModal('loginModal');
    showToast(`👋 Welcome back!`, 'success');
    e.target.reset();
  } catch (error) {
    console.error("Login Error:", error);
    showToast(error.message.replace('Firebase: ', ''), 'error', 4000);
  } finally {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Sign In';
    submitBtn.disabled = false;
  }
};

// ---- Register handler ----
window.handleRegister = async function(e) {
  e.preventDefault();
  if (!auth) {
    showToast('Firebase is not configured. Please add your credentials in app.js.', 'error', 4000);
    return;
  }

  const firstName = $('#firstName').value.trim();
  const lastName = $('#lastName').value.trim();
  const email = $('#regEmail').value.trim();
  const password = $('#regPassword').value;

  if (!firstName || !lastName || !email || !password) {
    showToast('Please fill in all core fields.', 'error');
    return;
  }
  if (password.length < 8) {
    showToast('Password must be at least 8 characters.', 'error');
    return;
  }

  let extraData = {};
  if (selectedRole === 'founder') {
    const startupName = $('#startupName').value.trim();
    const startupField = $('#startupField').value.trim();
    const startupStage = $('#startupStage').value;
    const startupEmployees = $('#startupEmployees').value;
    const startupCapital = $('#startupCapital').value;
    const startupYear = $('#startupYear').value.trim();
    const startupWebsite = $('#startupWebsite').value.trim();
    const startupDescription = $('#startupDescription').value.trim();
    
    if (!startupName || !startupField || !startupStage || !startupEmployees || !startupCapital || !startupYear || !startupWebsite || !startupDescription) {
      showToast('Please fill in all startup fields.', 'error');
      return;
    }
    
    extraData = {
      startupName, startupField, startupStage, startupEmployees, startupCapital, startupYear, startupWebsite, startupDescription
    };
  } else if (selectedRole === 'investor') {
    const defaultFund = $('#company') ? $('#company').value.trim() : ''; // fallback if exists
    const investorFund = $('#investorFund').value.trim() || defaultFund;
    const investorFocus = $('#investorFocus').value.trim();
    const investorTicketSize = $('#investorTicketSize').value;
    const investorPreferredStage = $('#investorPreferredStage').value;

    if (!investorFocus || !investorTicketSize || !investorPreferredStage) {
      showToast('Please fill in all required investor fields.', 'error');
      return;
    }
    
    extraData = {
      investorFund, investorFocus, investorTicketSize, investorPreferredStage
    };
  }

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Creating account...';
    submitBtn.disabled = true;

    // Create user in Firebase Auth
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    // Save profile in Firestore
    await setDoc(doc(db, "users", user.uid), {
      firstName,
      lastName,
      email,
      ...extraData,
      role: selectedRole,
      joinedAt: new Date().toISOString()
    });

    closeModal('registerModal');
    showToast(`🎉 Welcome to Investrade, ${firstName}! Your journey starts now.`, 'success', 4000);
    e.target.reset();

    // Take user directly to dashboard
    setTimeout(() => {
      if (window.openDashboard) window.openDashboard();
    }, 500);

  } catch (error) {
    console.error("Register Error:", error);
    showToast(error.message.replace('Firebase: ', ''), 'error', 5000);
  } finally {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Create Account';
    submitBtn.disabled = false;
  }
};

// ---- Smooth scroll for nav links ----
$$('a[href^="#"]').forEach(anchor => {
  const href = anchor.getAttribute('href');
  if (href.length > 1 && !['#login', '#register'].includes(href)) {
    anchor.addEventListener('click', (e) => {
      const target = $(href);
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  }
});

// ---- Active nav highlighting on scroll ----
const sections = $$('section[id]');
const navLinks = $$('.nav-link');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop - 100;
    if (window.scrollY >= sectionTop) {
      current = section.id;
    }
  });
  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${current}`) {
      link.classList.add('active');
    }
  });
}, { passive: true });

// Add active style
const style = document.createElement('style');
style.textContent = `.nav-link.active { color: var(--foreground) !important; background: var(--muted); }`;
document.head.appendChild(style);

// ---- Initialize ----
updateNavForUser();

// Animated counter for hero stats
function animateCounter(el, target, prefix = '', suffix = '') {
  const duration = 1800;
  const step = target / (duration / 16);
  let current = 0;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = prefix + (target >= 1000 ? (current / 1000).toFixed(1) + 'K' : Math.floor(current)) + suffix;
    if (current >= target) clearInterval(timer);
  }, 16);
}

// Trigger counters when hero comes into view
const heroStatsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const statNumbers = entry.target.querySelectorAll('.stat-number');
      statNumbers.forEach(el => {
        const text = el.textContent;
        if (text.includes('2,400')) animateCounter(el, 2400, '', '+');
        else if (text.includes('$48M')) { el.textContent = '$48M+'; }
        else if (text.includes('320')) animateCounter(el, 320, '', '+');
        else if (text.includes('94')) animateCounter(el, 94, '', '%');
      });
      heroStatsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

const heroStats = $('.hero-stats');
if (heroStats) heroStatsObserver.observe(heroStats);

console.log('%cInvestrade Platform', 'font-size:20px;font-weight:900;color:#3730f5');
console.log('%cBuilt with ❤️ — Firebase SDK Integration.', 'color:#6b7280');

// ---- Course Enrollment Modal ----

let courseApplicantData = {};

// Step 1 → Step 2
window.handleCourseStep1 = function(e) {
  e.preventDefault();
  const firstName = $('#enrollFirstName').value.trim();
  const lastName  = $('#enrollLastName').value.trim();
  const age       = $('#enrollAge').value.trim();
  const country   = $('#enrollCountry').value.trim();
  const email     = $('#enrollEmail').value.trim();
  const education = $('#enrollEducation').value;
  const professional = $('#enrollProfessional').value;
  const motivation = $('#enrollMotivation').value.trim();

  if (!firstName || !lastName || !age || !country || !email || !education || !professional) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  courseApplicantData = { firstName, lastName, age, country, email, education, professional, motivation };

  // Show step 2
  $('#enrollStep1').style.display = 'none';
  $('#enrollStep2').style.display = 'block';
  $('#enrollStep2Ind').style.background = 'var(--primary)';
  $('#enrollStepLabel').textContent = 'Step 2 of 2';
};

// Go back to step 1
window.goBackEnrollStep = function() {
  $('#enrollStep2').style.display = 'none';
  $('#enrollStep1').style.display = 'block';
  $('#enrollStep2Ind').style.background = 'var(--border)';
  $('#enrollStepLabel').textContent = 'Step 1 of 2';
};

// Payment method switcher
window.selectPayMethod = function(method) {
  ['card', 'paypal'].forEach(m => {
    const btn = $(`#pay${m.charAt(0).toUpperCase() + m.slice(1)}`);
    const fields = $(`#pay${m.charAt(0).toUpperCase() + m.slice(1)}Fields`);
    if (!btn || !fields) return;

    if (m === method) {
      btn.style.border = '2px solid var(--primary)';
      btn.style.background = 'rgba(99,102,241,0.08)';
      fields.style.display = 'block';
    } else {
      btn.style.border = '2px solid var(--border)';
      btn.style.background = 'transparent';
      fields.style.display = 'none';
    }
  });
};

// Final submit
window.handleCourseSubmit = async function() {
  try {
    const accessCode = generateAccessCode();
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(accessCode)}`;

    // Save to Firestore if available
    if (db) {
      const ref = doc(db, 'courseEnrollments', `${Date.now()}_${courseApplicantData.email}`);
      await setDoc(ref, {
        ...courseApplicantData,
        enrolledAt: new Date().toISOString(),
        course: 'How to Build Your Startup Using AI',
        price: 300,
        paymentStatus: 'pending',
        accessCode: accessCode,
        sessionDate: '2026-08-15'
      });
    }

    // Show step 3 (Success)
    $('#enrollStep2').style.display = 'none';
    $('#enrollStep3').style.display = 'block';
    
    // Set UI details
    $('#enrollQrImage').src = qrUrl;
    $('#enrollAccessCode').textContent = accessCode;
    
    // Update indicator
    $('#enrollStepLabel').textContent = 'Success!';
    
    showToast('🎓 Enrollment Successful!', 'success', 5000);
    
    // Reset internal state but NOT the UI yet (user needs to see QR)
    courseApplicantData = {};
  } catch(err) {
    console.error('Enrollment error:', err);
    showToast('Something went wrong. Please try again.', 'error', 4000);
  }
};

// ---- PayPal SDK Integration ----
if (window.paypal) {
  paypal.Buttons({
    createOrder: async function(data, actions) {
      if(!courseApplicantData.email) return;
      try {
        // Pointing to your deployed cloud function (or emulator if running locally)
        // You'll need to update this URL to your real Firebase project URL later:
        const API_BASE = "http://127.0.0.1:5001/YOUR_PROJECT_ID/us-central1"; 
        
        const res = await fetch(`${API_BASE}/createPayPalOrder`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'}
        });
        const orderData = await res.json();
        return orderData.id;
      } catch (err) {
        console.error("Order creation failed", err);
        showToast("Error creating PayPal order", "error");
      }
    },
    onApprove: async function(data, actions) {
      try {
        const API_BASE = "http://127.0.0.1:5001/YOUR_PROJECT_ID/us-central1"; 
        
        const res = await fetch(`${API_BASE}/capturePayPalOrder`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            orderID: data.orderID,
            userEmail: courseApplicantData.email,
            courseApplicantData: courseApplicantData
          })
        });
        
        const captureData = await res.json();
        
        if (captureData.success) {
            // Show step 3 (Success)
            $('#enrollStep2').style.display = 'none';
            $('#enrollStep3').style.display = 'block';
            
            // Set UI details generated from backend
            $('#enrollQrImage').src = captureData.qrUrl;
            $('#enrollAccessCode').textContent = captureData.accessCode;
            $('#enrollStepLabel').textContent = 'Success!';
            
            showToast('🎓 PayPal Payment Successful!', 'success', 5000);
            courseApplicantData = {};
        } else {
            showToast('Payment verification failed.', 'error', 4000);
        }
      } catch (err) {
        console.error("Capture failed", err);
        showToast("Error verifying PayPal capture", "error");
      }
    }
  }).render('#paypal-button-container');
}

function generateAccessCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = () => {
    let res = '';
    for(let i=0; i<4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
  };
  return `INVEST-${segment()}-${segment()}`;
}

// ---- DASHBOARD LOGIC ----

window.openDashboard = function() {
  if (!currentUserProfile) {
    openModal('loginModal');
    return;
  }
  populateDashboard();
  $('#dashboardPage').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeDashboard = function() {
  $('#dashboardPage').classList.remove('open');
  document.body.style.overflow = '';
};

window.dashTabSwitch = function(btn, tabId) {
  // Update buttons
  $$('.dash-nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  // Update tabs
  ['dashOverview', 'dashProfile', 'dashNetwork', 'dashCourse', 'dashDeals'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.style.display = (id === tabId) ? 'block' : 'none';
  });
};

window.handleSignOut = function() {
  if (auth && confirm('Are you sure you want to sign out?')) {
    signOut(auth).then(() => {
      closeDashboard();
      showToast('Signed out successfully.');
    });
  }
};

window.populateDashboard = function() {
  const p = currentUserProfile;
  if (!p) return;

  // Header
  $('#dashNameTop').textContent = p.firstName;
  $('#dashAvatarTop').textContent = p.firstName.charAt(0).toUpperCase();
  $('#dashRoleBadge').textContent = p.role;
  $('#dashRoleBadge').className = `dash-role-badge ${p.role}`;
  
  const joinDate = p.joinedAt ? new Date(p.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently';
  const welcomeStr = `Welcome back, ${p.firstName} 👋`;

  const sidebar = $('#dashSidebar');
  const main = $('#dashMain');
  
  if (p.role === 'founder') {
    // FOUNDER SIDEBAR
    sidebar.innerHTML = `
      <div class="dash-nav-section">Menu</div>
      <button class="dash-nav-item active" onclick="dashTabSwitch(this,'dashOverview')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        <span>Overview</span>
      </button>
      <button class="dash-nav-item" onclick="dashTabSwitch(this,'dashProfile')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>My Profile</span>
      </button>
      <div class="dash-nav-section">Learning</div>
      <button class="dash-nav-item" onclick="dashTabSwitch(this,'dashMarketCourses')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <span>Courses</span>
      </button>
      <button class="dash-nav-item" onclick="dashTabSwitch(this,'dashMyCourse')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        <span>My Courses</span>
      </button>
      <div class="dash-nav-section">Tools</div>
      <button class="dash-nav-item" onclick="dashTabSwitch(this,'dashDeals')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        <span>Deals</span>
      </button>
    `;

    // FOUNDER MAIN
    main.innerHTML = `
      <!-- OVERVIEW -->
      <div id="dashOverview">
        <div class="dash-welcome">
          <div class="dash-welcome-text">
            <h1>${welcomeStr}</h1>
            <p>Here's a snapshot of your Investrade journey.</p>
          </div>
          <span style="font-size:0.78rem;color:var(--muted-fg);">Member since ${joinDate}</span>
        </div>
        
        <div class="dash-stats-row cols-2" style="grid-template-columns: repeat(2, 1fr);">
          <div class="dash-stat-card primary-card">
            <div class="dash-stat-label">Startup Value</div>
            <div class="dash-stat-value">-</div>
            <div class="dash-stat-sub">Pre-seed Estimation</div>
          </div>
          <div class="dash-stat-card">
            <div class="dash-stat-label">Investor Visits</div>
            <div class="dash-stat-value">${p.investorVisits || 0}</div>
            <div class="dash-stat-sub">Total views from verified funds</div>
          </div>
        </div>

        <div class="dash-grid wide">
          <div class="dash-panel">
            <div class="dash-panel-header">
              <span class="dash-panel-title">Your Startup Profile</span>
              <span class="dash-panel-badge">Active</span>
            </div>
            <div class="dash-info-list">
              <div class="dash-info-row"><div class="dash-info-icon">🏢</div><div class="dash-info-content"><span class="dash-info-key">Name</span><span class="dash-info-val">${p.startupName}</span></div></div>
              <div class="dash-info-row"><div class="dash-info-icon">🌐</div><div class="dash-info-content"><span class="dash-info-key">Field</span><span class="dash-info-val">${p.startupField}</span></div></div>
              <div class="dash-info-row"><div class="dash-info-icon">📉</div><div class="dash-info-content"><span class="dash-info-key">Stage</span><span class="dash-info-val">${p.startupStage}</span></div></div>
              <div class="dash-info-row"><div class="dash-info-icon">👥</div><div class="dash-info-content"><span class="dash-info-key">Employees</span><span class="dash-info-val">${p.startupEmployees}</span></div></div>
            </div>
          </div>
        </div>
      </div>

      <!-- PROFILE -->
      <div id="dashProfile" style="display:none;">
        <div class="dash-welcome"><div class="dash-welcome-text"><h1>My Profile</h1><p>Edit your personal information</p></div></div>
        <div class="dash-grid">
          <div class="dash-panel">
            <div class="dash-info-list" id="profileViewMode">
              <div class="dash-info-row"><div class="dash-info-content"><span class="dash-info-key">Full Name</span><span class="dash-info-val">${p.firstName} ${p.lastName}</span></div></div>
              <div class="dash-info-row"><div class="dash-info-content"><span class="dash-info-key">Email</span><span class="dash-info-val">${p.email}</span></div></div>
              <button onclick="document.getElementById('profileViewMode').style.display='none'; document.getElementById('profileEditMode').style.display='block';" class="btn btn-outline" style="margin-top:1rem;width:fit-content;">Edit Profile</button>
            </div>
            <div class="auth-form" id="profileEditMode" style="display:none;margin-top:0;">
               <div class="form-row">
                 <div class="form-group"><label>First Name</label><input type="text" id="editProfileFirst" value="${p.firstName}"></div>
                 <div class="form-group"><label>Last Name</label><input type="text" id="editProfileLast" value="${p.lastName}"></div>
               </div>
               <div class="form-group"><label>Email (Requires verification)</label><input type="email" id="editProfileEmail" value="${p.email}"></div>
               <div style="display:flex;gap:0.5rem;margin-top:1rem;">
                 <button onclick="handleProfileEdit()" class="btn btn-primary" style="flex:1;">Save Changes</button>
                 <button onclick="document.getElementById('profileViewMode').style.display='flex'; document.getElementById('profileEditMode').style.display='none';" class="btn btn-outline" style="flex:1;">Cancel</button>
               </div>
            </div>
          </div>
        </div>
      </div>

      <!-- COURSES MARKETPLACE -->
      <div id="dashMarketCourses" style="display:none;">
        <div class="dash-welcome"><div class="dash-welcome-text"><h1>Course Marketplace</h1><p>Discover courses to elevate your startup.</p></div></div>
        <div class="dash-panel" style="display:flex;flex-direction:row;justify-content:space-between;align-items:center;padding:2rem;">
          <div>
            <h3 style="font-size:1.1rem;font-weight:700;">How to Build Your Startup Using AI</h3>
            <p style="color:var(--muted-fg);font-size:0.875rem;margin-top:0.5rem;max-width:500px;">A comprehensive live masterclass on implementing AI into your workflows, pitching to AI-focused investors, and driving massive growth with limited resources.</p>
            <p style="font-weight:600;margin-top:1rem;color:var(--primary);">$300 — Next Live Session: 15 Aug 2026</p>
          </div>
          <button onclick="window.openModal('courseEnrollModal')" class="btn btn-primary">Apply Now</button>
        </div>
      </div>

      <!-- MY COURSE -->
      <div id="dashMyCourse" style="display:none;">
        <div class="dash-welcome"><div class="dash-welcome-text"><h1>My Courses</h1><p>Track your enrolled courses.</p></div></div>
        <div id="enrolledCourseContainer" class="dash-panel" style="align-items:center;padding:3rem;text-align:center;">
          <div class="loader" style="margin: 0 auto; border-color:var(--primary); border-top-color:transparent;"></div>
          <p style="margin-top:1rem;">Loading your enrollments...</p>
        </div>
      </div>

      <!-- DEALS -->
      <div id="dashDeals" style="display:none;">
        <div class="dash-welcome"><div class="dash-welcome-text"><h1>Deals</h1><p>Your active investment opportunities.</p></div></div>
        <div class="dash-panel" style="align-items:center;padding:3rem;text-align:center;">
          <div style="font-size:3rem;margin-bottom:1rem;">📋</div><h3 style="font-size:1.1rem;font-weight:700;margin-bottom:0.5rem;">No Active Deals</h3>
          <p style="color:var(--muted-fg);font-size:0.875rem;max-width:400px;">Once you connect with investors, your deal pipeline will appear here.</p>
        </div>
      </div>
    `;

    // Fetch My Courses dynamically
    if (window.fetchMyCourses) window.fetchMyCourses(p.email);

  } else {
    // INVESTOR SIDEBAR
    sidebar.innerHTML = `
      <div class="dash-nav-section">Menu</div>
      <button class="dash-nav-item active" onclick="dashTabSwitch(this,'dashOverview')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        <span>Overview</span>
      </button>
      <button class="dash-nav-item" onclick="dashTabSwitch(this,'dashProfile')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>My Profile</span>
      </button>
      <div class="dash-nav-section">Deal Flow</div>
      <button class="dash-nav-item" onclick="dashTabSwitch(this,'dashDirectory')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Startup Directory</span>
      </button>
      <button class="dash-nav-item" onclick="dashTabSwitch(this,'dashPipeline')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        <span>Deal Pipeline</span>
      </button>
    `;

    // INVESTOR MAIN
    main.innerHTML = `
      <div id="dashOverview">
        <div class="dash-welcome">
          <div class="dash-welcome-text">
            <h1>${welcomeStr}</h1>
            <p>Your investor dashboard. Discover your next unicorn.</p>
          </div>
          <span style="font-size:0.78rem;color:var(--muted-fg);">Fund: ${p.investorFund || 'Angel'}</span>
        </div>
        
        <div class="dash-stats-row cols-3">
          <div class="dash-stat-card gold-card">
            <div class="dash-stat-label">AUM Focus</div>
            <div class="dash-stat-value">${p.investorTicketSize}</div>
            <div class="dash-stat-sub">Average Ticket Size</div>
          </div>
          <div class="dash-stat-card">
            <div class="dash-stat-label">Deals Screened</div>
            <div class="dash-stat-value">124</div>
            <div class="dash-stat-sub">In last 30 days</div>
          </div>
          <div class="dash-stat-card">
            <div class="dash-stat-label">Profile Views</div>
            <div class="dash-stat-value">42</div>
            <div class="dash-stat-sub">From Founders</div>
          </div>
        </div>

        <div class="dash-grid wide">
          <div class="dash-panel">
            <div class="dash-panel-header">
              <span class="dash-panel-title">Investor Thesis</span>
              <span class="dash-panel-badge">Verified</span>
            </div>
            <div class="dash-info-list">
              <div class="dash-info-row"><div class="dash-info-icon">💼</div><div class="dash-info-content"><span class="dash-info-key">Fund Name</span><span class="dash-info-val">${p.investorFund || 'Individual Angel'}</span></div></div>
              <div class="dash-info-row"><div class="dash-info-icon">🎯</div><div class="dash-info-content"><span class="dash-info-key">Industry Focus</span><span class="dash-info-val">${p.investorFocus}</span></div></div>
              <div class="dash-info-row"><div class="dash-info-icon">📅</div><div class="dash-info-content"><span class="dash-info-key">Preferred Stage</span><span class="dash-info-val">${p.investorPreferredStage}</span></div></div>
            </div>
          </div>
        </div>
      </div>

      <!-- PROFILE -->
      <div id="dashProfile" style="display:none;">
        <div class="dash-welcome"><div class="dash-welcome-text"><h1>My Profile</h1><p>Edit your personal information</p></div></div>
        <div class="dash-grid">
          <div class="dash-panel">
            <div class="dash-info-list" id="profileViewMode">
              <div class="dash-info-row"><div class="dash-info-content"><span class="dash-info-key">Full Name</span><span class="dash-info-val">${p.firstName} ${p.lastName}</span></div></div>
              <div class="dash-info-row"><div class="dash-info-content"><span class="dash-info-key">Email</span><span class="dash-info-val">${p.email}</span></div></div>
            </div>
          </div>
        </div>
      </div>

      <!-- DIRECTORY -->
      <div id="dashDirectory" style="display:none;">
        <div class="dash-welcome"><div class="dash-welcome-text"><h1>Startup Directory</h1><p>Curated startups matching your thesis.</p></div></div>
        <div class="dash-grid wide">
          <!-- Dummy Startup 1 -->
          <div class="dash-panel" style="flex-direction:row; align-items:center; justify-content:space-between; cursor:pointer;" onclick="showToast('Loading data room...')">
            <div style="display:flex;gap:1.5rem;align-items:center;">
              <div style="width:50px;height:50px;background:var(--primary);border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1.5rem;">A</div>
              <div><h4 style="font-weight:700;">AeroSync AI</h4><p style="font-size:0.85rem;color:var(--muted-fg);">Fintech · Pre-seed</p></div>
            </div>
            <button class="btn btn-outline">View Data Room</button>
          </div>
          <!-- Dummy Startup 2 -->
          <div class="dash-panel" style="flex-direction:row; align-items:center; justify-content:space-between; cursor:pointer;" onclick="showToast('Loading data room...')">
            <div style="display:flex;gap:1.5rem;align-items:center;">
              <div style="width:50px;height:50px;background:#10b981;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1.5rem;">N</div>
              <div><h4 style="font-weight:700;">Nova Health</h4><p style="font-size:0.85rem;color:var(--muted-fg);">Healthtech · Seed</p></div>
            </div>
            <button class="btn btn-outline">View Data Room</button>
          </div>
        </div>
      </div>

      <!-- PIPELINE -->
      <div id="dashPipeline" style="display:none;">
        <div class="dash-welcome"><div class="dash-welcome-text"><h1>Deal Pipeline</h1><p>Startups you are actively tracking.</p></div></div>
        <div class="dash-panel" style="align-items:center;padding:3rem;text-align:center;">
          <div style="font-size:3rem;margin-bottom:1rem;">📋</div><h3 style="font-size:1.1rem;font-weight:700;margin-bottom:0.5rem;">Pipeline Empty</h3>
          <p style="color:var(--muted-fg);font-size:0.875rem;max-width:400px;">Save startups from the directory to track them here.</p>
        </div>
      </div>
    `;
  }
}

// ----------------------------------------------------------------------
// NEW DASHBOARD UTILITY FUNCTIONS
// ----------------------------------------------------------------------

window.handleProfileEdit = async function() {
  const newFirst = document.getElementById('editProfileFirst').value;
  const newLast = document.getElementById('editProfileLast').value;
  const newEmail = document.getElementById('editProfileEmail').value;

  if (!auth.currentUser) return;

  try {
    const user = auth.currentUser;
    let authUpdated = false;

    // Trigger Firebase verifyBeforeUpdateEmail if email is changing
    if (newEmail && newEmail !== currentUserProfile.email) {
       // Requires importing verifyBeforeUpdateEmail, assumed to be attached or mock it for now since we just use basic auth 
       if(window.verifyBeforeUpdateEmail) {
         await window.verifyBeforeUpdateEmail(user, newEmail);
         showToast('Verification email sent to new address! Please verify to complete email change.', 'success', 6000);
       } else {
         showToast('Email change requested.', 'success');
       }
       authUpdated = true;
    }
    
    // Update Firestore Profile
    await updateDoc(doc(db, "users", user.uid), {
      firstName: newFirst,
      lastName: newLast
    });

    currentUserProfile.firstName = newFirst;
    currentUserProfile.lastName = newLast;
    
    showToast('Profile updated!', 'success');
    populateDashboard(); // re-render
  } catch (err) {
    showToast('Error updating profile: ' + err.message, 'error');
  }
};

window.fetchMyCourses = async function(email) {
  try {
    const q = query(collection(db, "courseEnrollments"), where("email", "==", email));
    const snapshot = await getDocs(q);
    
    const container = document.getElementById('enrolledCourseContainer');
    if(!container) return;

    if (snapshot.empty) {
      container.innerHTML = \`
        <div style="font-size:3rem;margin-bottom:1rem;">📚</div>
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:0.5rem;">You haven't enrolled yet</h3>
        <p style="color:var(--muted-fg);font-size:0.875rem;max-width:400px;">Browse the Course Marketplace to enroll in your first masterclass.</p>
        <button onclick="dashTabSwitch(document.querySelector('[onclick=\\\\'dashTabSwitch(this,\\\\\\'dashMarketCourses\\\\\\')\\\\']'), 'dashMarketCourses')" class="btn btn-outline" style="margin-top:1.5rem;">Browse Courses</button>
      \`;
    } else {
      let html = '';
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        html += \`
          <div style="text-align:left; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <h3 style="font-weight:700;font-size:1.2rem;">\${data.course}</h3>
                <p style="font-size:0.85rem;color:var(--muted-fg);margin-top:0.3rem;">Status: <span style="color:var(--primary);">\${data.paymentStatus.toUpperCase()}</span> · Session Date: \${data.sessionDate}</p>
              </div>
              <div style="text-align:center;">
                 <img src="\${data.qrUrl}" style="width:80px;height:80px;border-radius:8px;border:1px solid var(--border);" />
                 <div style="font-family:monospace; font-size:0.75rem; color:var(--primary); margin-top:0.3rem;">\${data.accessCode}</div>
              </div>
            </div>
            <div style="margin-top:2rem; padding-top:1.5rem; border-top:1px solid var(--border);">
               <h4 style="font-weight:600;margin-bottom:1rem;">Course Modules</h4>
               <ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:0.75rem; font-size:0.9rem;">
                  <li style="display:flex;align-items:center;gap:0.5rem;"><div style="width:16px;height:16px;border-radius:50%;border:2px solid var(--border);"></div> Module 1: AI Ideation</li>
                  <li style="display:flex;align-items:center;gap:0.5rem;"><div style="width:16px;height:16px;border-radius:50%;border:2px solid var(--border);"></div> Module 2: Prototyping Without Code</li>
                  <li style="display:flex;align-items:center;gap:0.5rem;color:var(--muted-fg);">... Wait for session start ...</li>
               </ul>
            </div>
          </div>
        \`;
      });
      container.innerHTML = html;
      container.style.alignItems = "flex-start";
      container.style.textAlign = "left";
    }
  } catch (err) {
    console.error("Error fetching courses", err);
    document.getElementById('enrolledCourseContainer').innerHTML = "<p>Error loading courses.</p>";
  }
};
