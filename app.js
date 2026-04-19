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

function populateDashboard() {
  const p = currentUserProfile;
  if (!p) return;

  // Header & Profile
  $('#dashNameTop').textContent = p.firstName;
  $('#dashAvatarTop').textContent = p.firstName.charAt(0).toUpperCase();
  $('#dashRoleBadge').textContent = p.role;
  $('#dashRoleBadge').className = `dash-role-badge ${p.role}`;
  $('#dashWelcomeTitle').textContent = `Welcome back, ${p.firstName}👋`;
  
  if (p.joinedAt) {
    const date = new Date(p.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    $('#dashJoinDate').textContent = `Member since ${date}`;
  }

  // Overview Stats & Panels
  const statsContainer = $('#dashStatCards');
  const infoGrid = $('#dashInfoGrid');
  
  if (p.role === 'founder') {
    statsContainer.innerHTML = `
      <div class="dash-stat-card primary-card">
        <div class="dash-stat-label">Startup Value</div>
        <div class="dash-stat-value">$250K</div>
        <div class="dash-stat-sub">Pre-seed Estimation</div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-label">Incubator Score</div>
        <div class="dash-stat-value">78%</div>
        <div class="dash-stat-sub">Readiness Benchmark</div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-label">Active Intros</div>
        <div class="dash-stat-value">3</div>
        <div class="dash-stat-sub">Investor Pipeline</div>
      </div>
    `;

    infoGrid.innerHTML = `
      <div class="dash-panel">
        <div class="dash-panel-header">
          <span class="dash-panel-title">Your Startup Profile</span>
          <span class="dash-panel-badge">Active</span>
        </div>
        <div class="dash-info-list">
          <div class="dash-info-row">
            <div class="dash-info-icon">🏢</div>
            <div class="dash-info-content">
              <span class="dash-info-key">Name</span>
              <span class="dash-info-val">${p.startupName}</span>
            </div>
          </div>
          <div class="dash-info-row">
            <div class="dash-info-icon">🌐</div>
            <div class="dash-info-content">
              <span class="dash-info-key">Field</span>
              <span class="dash-info-val">${p.startupField}</span>
            </div>
          </div>
          <div class="dash-info-row">
            <div class="dash-info-icon">📉</div>
            <div class="dash-info-content">
              <span class="dash-info-key">Stage</span>
              <span class="dash-info-val">${p.startupStage}</span>
            </div>
          </div>
          <div class="dash-info-row">
            <div class="dash-info-icon">👥</div>
            <div class="dash-info-content">
              <span class="dash-info-key">Employees</span>
              <span class="dash-info-val">${p.startupEmployees}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="dash-panel">
        <div class="dash-panel-header">
          <span class="dash-panel-title">Funding Goal</span>
        </div>
        <div class="dash-info-list">
          <div class="dash-info-row">
            <div class="dash-info-content">
              <span class="dash-info-key">Current Round</span>
              <span class="dash-info-val">${p.startupCapital}</span>
            </div>
          </div>
          <div style="margin-top: 0.5rem;">
            <span class="dash-info-key">Profile Completeness</span>
            <div class="dash-progress-bar">
              <div class="dash-progress-fill" style="width: 85%;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    // Investor Role
    statsContainer.innerHTML = `
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
        <div class="dash-stat-label">Portfolio Cos</div>
        <div class="dash-stat-value">12</div>
        <div class="dash-stat-sub">Across 5 Sectors</div>
      </div>
    `;

    infoGrid.innerHTML = `
      <div class="dash-panel">
        <div class="dash-panel-header">
          <span class="dash-panel-title">Investor Thesis</span>
          <span class="dash-panel-badge">Verified</span>
        </div>
        <div class="dash-info-list">
          <div class="dash-info-row">
            <div class="dash-info-icon">💼</div>
            <div class="dash-info-content">
              <span class="dash-info-key">Fund Name</span>
              <span class="dash-info-val">${p.investorFund || 'Individual Angel'}</span>
            </div>
          </div>
          <div class="dash-info-row">
            <div class="dash-info-icon">🎯</div>
            <div class="dash-info-content">
              <span class="dash-info-key">Industry Focus</span>
              <span class="dash-info-val">${p.investorFocus}</span>
            </div>
          </div>
          <div class="dash-info-row">
            <div class="dash-info-icon">📅</div>
            <div class="dash-info-content">
              <span class="dash-info-key">Preferred Stage</span>
              <span class="dash-info-val">${p.investorPreferredStage}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Populate Profile tab
  const profileGrid = $('#dashProfileGrid');
  profileGrid.innerHTML = `
    <div class="dash-panel">
      <div class="dash-panel-header">
        <span class="dash-panel-title">Personal Information</span>
      </div>
      <div class="dash-info-list">
        <div class="dash-info-row">
          <div class="dash-info-content">
            <span class="dash-info-key">Full Name</span>
            <span class="dash-info-val">${p.firstName} ${p.lastName}</span>
          </div>
        </div>
        <div class="dash-info-row">
          <div class="dash-info-content">
            <span class="dash-info-key">Email</span>
            <span class="dash-info-val">${p.email}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
