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
};

// ---- Modal system ----
function openModal(id) {
  const modal = $(`#${id}`);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

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
    showToast('🚀 Your dashboard is being prepared...', 'success');
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
  const company = $('#company').value.trim();

  if (!firstName || !lastName || !email || !password) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }
  if (password.length < 8) {
    showToast('Password must be at least 8 characters.', 'error');
    return;
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
      company,
      role: selectedRole,
      joinedAt: new Date().toISOString()
    });

    closeModal('registerModal');
    showToast(`🎉 Welcome to Investrade, ${firstName}! Your journey starts now.`, 'success', 4000);
    e.target.reset();

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
