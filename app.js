/* =============================================
   INVESTRADE — JavaScript
   Powered by Supabase Auth & Postgres
   ============================================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { supabaseConfig } from "./supabase-config.js";
import { inject } from "@vercel/analytics";

// Initialize Vercel Analytics
inject();

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
const auth = { currentUser: null };
const db = {};

function mapUser(user) {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email,
    ...user
  };
}

async function createUserWithEmailAndPassword(_auth, email, password, metadata = {}) {
  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password,
    options: { data: metadata }
  });
  if (error) throw error;
  const user = mapUser(data.user);
  auth.currentUser = user;
  return { user };
}

async function signInWithEmailAndPassword(_auth, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const user = mapUser(data.user);
  auth.currentUser = user;
  return { user };
}

function onAuthStateChanged(_auth, callback) {
  supabase.auth.getUser().then(({ data }) => {
    const mapped = mapUser(data?.user || null);
    auth.currentUser = mapped;
    callback(mapped);
  });
  const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
    const mapped = mapUser(session?.user || null);
    auth.currentUser = mapped;
    callback(mapped);
  });
  return () => subscription.subscription.unsubscribe();
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  auth.currentUser = null;
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session?.access_token || null;
}

function doc(_db, ...segments) {
  return { segments };
}

function collection(_db, ...segments) {
  return { segments };
}

function where(field, op, value) {
  return { type: "where", field, op, value };
}

function limit(value) {
  return { type: "limit", value };
}

function query(collectionRef, ...constraints) {
  return { collectionRef, constraints };
}

function increment(value) {
  return { __increment: value };
}

function serverTimestamp() {
  return new Date().toISOString();
}

function camelToSnakeKey(key) {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function snakeToCamelKey(key) {
  return key.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
}

function camelToSnakeObject(input) {
  if (Array.isArray(input)) return input.map(camelToSnakeObject);
  if (input && typeof input === "object") {
    const out = {};
    for (const [k, v] of Object.entries(input)) out[camelToSnakeKey(k)] = camelToSnakeObject(v);
    return out;
  }
  return input;
}

function snakeToCamelObject(input) {
  if (Array.isArray(input)) return input.map(snakeToCamelObject);
  if (input && typeof input === "object") {
    const out = {};
    for (const [k, v] of Object.entries(input)) out[snakeToCamelKey(k)] = snakeToCamelObject(v);
    return out;
  }
  return input;
}

function mapTableFromSegments(segments) {
  const tableMap = {
    users: "users",
    startups: "startups",
    courses: "courses",
    courseEnrollments: "course_enrollments",
    stripeCheckoutSessions: "checkout_sessions"
  };
  const root = tableMap[segments[0]] || segments[0];
  if (!segments[0]) return { table: "unknown", id: null };
  
  if (segments.length === 1) return { table: root, id: null };
  if (segments.length === 2) return { table: root, id: segments[1] };
  if (segments.length === 3 && segments[2] === "visits") return { table: "startup_visits", id: null, startupId: segments[1] };
  if (segments.length === 4 && segments[2] === "visits") return { table: "startup_visits", id: segments[3], startupId: segments[1] };
  return { table: root, id: segments[1] || null };
}

async function setDoc(docRef, payload) {
  const { table, id, startupId } = mapTableFromSegments(docRef.segments);
  const row = camelToSnakeObject(payload);
  if (startupId) row.startup_id = startupId;
  if (id) row.id = id;
  const { error } = await supabase.from(table).upsert(row);
  if (error) throw error;
}

async function updateDoc(docRef, payload) {
  const { table, id } = mapTableFromSegments(docRef.segments);
  if (!id) throw new Error("Missing row ID for update");
  const updatePayload = {};
  for (const [key, value] of Object.entries(payload)) {
    const dbKey = camelToSnakeKey(key);
    if (value && typeof value === "object" && "__increment" in value) {
      const { data: existing, error: fetchErr } = await supabase.from(table).select(dbKey).eq("id", id).single();
      if (fetchErr) throw fetchErr;
      updatePayload[dbKey] = (Number(existing?.[dbKey] || 0) + value.__increment);
    } else {
      updatePayload[dbKey] = camelToSnakeObject(value);
    }
  }
  const { error } = await supabase.from(table).update(updatePayload).eq("id", id);
  if (error) throw error;
}

async function getDoc(docRef) {
  const { table, id } = mapTableFromSegments(docRef.segments);
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return {
    exists: () => !!data,
    data: () => snakeToCamelObject(data)
  };
}

async function addDoc(collectionRef, payload) {
  const { table, startupId } = mapTableFromSegments(collectionRef.segments);
  const row = camelToSnakeObject(payload);
  if (startupId) row.startup_id = startupId;
  const { data, error } = await supabase.from(table).insert(row).select("id").single();
  if (error) throw error;
  return { id: data.id };
}

async function getDocs(refOrQuery) {
  const queryRef = refOrQuery.collectionRef ? refOrQuery : { collectionRef: refOrQuery, constraints: [] };
  const { table, startupId } = mapTableFromSegments(queryRef.collectionRef.segments);
  let builder = supabase.from(table).select("*");
  if (startupId) builder = builder.eq("startup_id", startupId);
  for (const constraint of queryRef.constraints) {
    if (constraint.type === "where") {
      if (constraint.op === "==") builder = builder.eq(camelToSnakeKey(constraint.field), camelToSnakeObject(constraint.value));
    }
    if (constraint.type === "limit") builder = builder.limit(constraint.value);
  }
  const { data, error } = await builder;
  if (error) throw error;
  const rows = data || [];
  return {
    empty: rows.length === 0,
    forEach: (cb) => rows.forEach((row) => {
      const mapped = snakeToCamelObject(row);
      cb({ id: mapped.id, data: () => mapped });
    })
  };
}

// ---- Database Initialization ----
async function initializeDatabase() {
  console.log("%c✅ Supabase ready.", "color:#10b981;font-weight:bold;");
}

// ---- Utility ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(msg, type = 'success', duration = 3000) {
  const toast = $('#toast');
  if(!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = 'toast'; }, duration);
}

// ---- Confetti Effect ----
function triggerConfetti() {
  const duration = 3 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 2000 };

  const randomInRange = (min, max) => Math.random() * (max - min) + min;

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return clearInterval(interval);

    const particleCount = 50 * (timeLeft / duration);
    // confetti is a global from a CDN I'll add or a simple DOM version
    // For now, let's just use a high-energy toast if library isn't there
    // Actually, I'll inject a small style for confetti particles
  }, 250);
}

function celebrate() {
  // Simple CSS Confetti
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-particle';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
    confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 5000);
  }
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

// ---- Scroll-reveal animation & Color Grading ----
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      } else {
        // Only remove if we want fade out, which the user requested
        entry.target.classList.remove('visible');
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
);

// Auto-add reveal classes to section children and observe them
function initScrollAnimations() {
  const animatedSelectors = '.feature-card, .step-item, .testimonial-card, .pricing-card, .ecosystem-card, [data-aos]';
  document.querySelectorAll(animatedSelectors).forEach((el, i) => {
    if (!el.classList.contains('reveal') && !el.hasAttribute('data-aos')) {
      el.classList.add('reveal');
    }
    
    // Add staggered delays if not already present
    if (!el.className.includes('reveal-delay')) {
      const delayClass = `reveal-delay-${(i % 4) + 1}`;
      el.classList.add(delayClass);
    }
    
    observer.observe(el);
  });
}

initScrollAnimations();

// Section-based Color Grading
const sectionColors = {
  'hero': 'rgba(55, 48, 245, 0.08)',
  'training': 'rgba(212, 175, 55, 0.15)', // Gold
  'features': 'rgba(55, 48, 245, 0.05)',
  'how-it-works': 'rgba(148, 163, 184, 0.08)', // Slate
  'ecosystem': 'rgba(55, 48, 245, 0.05)',
  'courses': 'rgba(212, 175, 55, 0.12)', // Gold
  'pricing': 'rgba(148, 163, 184, 0.08)', // Slate
  'footer': 'rgba(15, 23, 42, 0.2)'
};


const currentRatios = {};
const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      currentRatios[entry.target.id] = entry.intersectionRatio;
    });

    let maxRatio = 0;
    let mostVisibleSection = null;

    for (const [id, ratio] of Object.entries(currentRatios)) {
      if (ratio > maxRatio) {
        maxRatio = ratio;
        mostVisibleSection = id;
      }
    }

    if (mostVisibleSection && maxRatio > 0.1) {
      const color = sectionColors[mostVisibleSection] || 'transparent';
      document.documentElement.style.setProperty('--color-grade', color);
    }
  },
  { threshold: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] }
);



document.querySelectorAll('section, footer').forEach(section => {
  sectionObserver.observe(section);
});



// ---- Banner ----
window.closeBanner = function() {
  const banner = $('#promoBanner');
  if (banner) {
    banner.style.transform = 'translateY(-100%)';
    document.body.classList.remove('has-banner');
    setTimeout(() => banner.remove(), 300);
  }
};

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

// ---- Auth session management (Supabase) ----
let currentUserProfile = null;
let selectedRole = 'founder';
let regCurrentStep = 1;

function updatePricingUI() {
  if (!currentUserProfile) return;
  const tier = (currentUserProfile.subscriptionTier || currentUserProfile.subscription_tier || "").toLowerCase();
  
  const plans = ['starter', 'pro', 'venture'];
  const currentIdx = plans.indexOf(tier);

  plans.forEach((p, idx) => {
    const btn = $(`#btn-${p}-plan`);
    if (!btn) return;
    const card = btn.closest('.pricing-card');

    if (currentIdx !== -1 && idx < currentIdx) {
      // Lower tier: Hide the entire card
      if (card) card.style.display = 'none';
    } else if (idx === currentIdx) {
      // Current tier: Show as Current Plan
      if (card) card.style.display = ''; 
      btn.textContent = "Current Plan";
      btn.classList.add('btn-disabled');
      btn.disabled = true;
      btn.style.background = "var(--muted)";
      btn.style.borderColor = "var(--border)";
      btn.style.color = "var(--muted-fg)";
      btn.style.cursor = "default";
      btn.onclick = null;
    } else {
      // Higher tier or no plan: Show as Upgrade/Subscribe
      if (card) card.style.display = '';
      btn.textContent = (currentIdx !== -1) ? "Upgrade Now" : "Subscribe Now";
      btn.classList.remove('btn-disabled');
      btn.disabled = false;
      // Reset styles to defaults (classes will handle it)
      btn.style.background = "";
      btn.style.borderColor = "";
      btn.style.color = "";
      btn.style.cursor = "";
    }
  });
}

function updateNavForUser() {
  const loginBtn = $('#loginBtn');
  const getStartedBtn = $('#getStartedBtn');
  const manageSubBtn = $('#manageSubBtn');
  
  if (currentUserProfile) {
    loginBtn.textContent = `Hello, ${currentUserProfile.firstName}`;
    loginBtn.href = 'javascript:void(0)';
    loginBtn.style.fontWeight = '600';
    
    // Check if admin
    const adminEmails = [
      'omarboudaya1@gmail.com',
      'dr.maherkhedher@wisdomnets.com',
      'mohammedkhedher222@gmail.com'
    ].map(e => e.toLowerCase().trim());
    
    const userEmail = (currentUserProfile.email || auth.currentUser?.email || "").toLowerCase().trim();
    
    if (adminEmails.includes(userEmail)) {
      getStartedBtn.textContent = 'Admin Dash';
      getStartedBtn.onclick = (e) => { e.preventDefault(); openAdminDashboard(); };
    } else {
      getStartedBtn.textContent = 'Dashboard';
      getStartedBtn.onclick = (e) => { e.preventDefault(); openDashboard(); };
    }

    // Show manage subscription button if they have a stripe customer ID
    if (manageSubBtn) {
      manageSubBtn.style.display = currentUserProfile.stripe_customer_id ? 'inline-block' : 'none';
    }
  } else {
    loginBtn.textContent = 'Sign In';
    loginBtn.href = '#login';
    loginBtn.style.fontWeight = '500';
    getStartedBtn.textContent = 'Get Started';
    getStartedBtn.onclick = null;
    getStartedBtn.href = '#register';
    if (manageSubBtn) manageSubBtn.style.display = 'none';
  }
}

let userProfileSubscription = null;
let courseEnrollmentSubscription = null;

function subscribeToUserProfile(uid) {
  if (userProfileSubscription) userProfileSubscription.unsubscribe();

  userProfileSubscription = supabase
    .channel(`user_profile_${uid}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${uid}`
      },
      async (payload) => {
        console.log('User profile updated via Realtime:', payload.new);
        currentUserProfile = { ...snakeToCamelObject(payload.new), uid: uid };
        updateNavForUser();
        updatePricingUI();
        if ($('#dashboardPage')?.classList.contains('open')) {
          populateDashboard();
        }
      }
    )
    .subscribe();
}

function subscribeToCourseEnrollments(uid) {
  if (courseEnrollmentSubscription) courseEnrollmentSubscription.unsubscribe();

  courseEnrollmentSubscription = supabase
    .channel(`course_enrollments_${uid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'course_enrollments',
        filter: `user_id=eq.${uid}`
      },
      async (payload) => {
        console.log('Course enrollment update via Realtime:', payload);
        if (window.fetchMyCourses) {
          window.fetchMyCourses(uid, currentUserProfile?.email);
        }
      }
    )
    .subscribe();
}

if (auth) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          currentUserProfile = { ...docSnap.data(), uid: user.uid };
        } else {
          currentUserProfile = { firstName: 'User', uid: user.uid };
        }
        // Subscribe to realtime changes
        subscribeToUserProfile(user.uid);
        subscribeToCourseEnrollments(user.uid);
      } catch(err) {
        console.error("Error fetching user profile:", err);
      }
    } else {
      currentUserProfile = null;
      if (userProfileSubscription) {
        userProfileSubscription.unsubscribe();
        userProfileSubscription = null;
      }
      if (courseEnrollmentSubscription) {
        courseEnrollmentSubscription.unsubscribe();
        courseEnrollmentSubscription = null;
      }
    }
    updateNavForUser();
    updatePricingUI();
    await handleStripeReturn();
  });
}

// ---- Registration Step Logic ----
window.selectRole = function(role) {
  selectedRole = role;
  document.querySelectorAll('.role-card').forEach(card => {
    card.classList.remove('active');
    if (card.dataset.role === role) card.classList.add('active');
  });
  
  const founderFields = $('#founderFields');
  const investorFields = $('#investorFields');
  if (founderFields) founderFields.style.display = role === 'founder' ? 'block' : 'none';
  if (investorFields) investorFields.style.display = role === 'investor' ? 'block' : 'none';
};

window.nextRegStep = function(step) {
  if (step === 2) {
    const f = $('#firstName').value.trim();
    const l = $('#lastName').value.trim();
    const e = $('#regEmail').value.trim();
    const p = $('#regPassword').value;
    if (!f || !l || !e || !p) {
      showToast('Please fill in your basic account info.', 'error');
      return;
    }
  }

  document.querySelectorAll('.reg-step').forEach(el => el.style.display = 'none');
  const target = document.getElementById(`regStep${step}`);
  if (target) target.style.display = 'block';
  
  document.querySelectorAll('.reg-indicator-step').forEach((el, index) => {
    if (index + 1 <= step) el.classList.add('active');
    else el.classList.remove('active');
  });
  
  regCurrentStep = step;
};

window.prevRegStep = function(step) {
  nextRegStep(step);
};

// ---- Registration Step Logic ----
window.selectRoleStep = function(role) {
  selectedRole = role;
  $('#cardFounder').classList.toggle('active', role === 'founder');
  $('#cardInvestor').classList.toggle('active', role === 'investor');
  
  // Toggle visibility in Step 3
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

window.nextRegStep = function(step) {
  // Simple Validation
  if (regCurrentStep === 1) {
    const fName = $('#firstName').value.trim();
    const lName = $('#lastName').value.trim();
    const email = $('#regEmail').value.trim();
    const pass = $('#regPassword').value;
    if (!fName || !lName || !email || !pass) {
      showToast('Please fill in all account fields.', 'error');
      return;
    }
    if (pass.length < 8) {
      showToast('Password must be at least 8 characters.', 'error');
      return;
    }
  }

  if (regCurrentStep === 3) {
    // Basic role validation before review
    if (selectedRole === 'founder') {
      const sName = $('#startupName').value.trim();
      if (!sName) { showToast('Please enter your startup name.', 'error'); return; }
    } else {
      const focus = $('#investorFocus').value.trim();
      if (!focus) { showToast('Please enter your investment focus.', 'error'); return; }
    }
  }

  goToRegStep(step);
};

window.prevRegStep = function(step) {
  goToRegStep(step);
};

function goToRegStep(step) {
  regCurrentStep = step;
  
  // Hide all
  $$('.reg-step').forEach(s => s.style.display = 'none');
  
  // Show target
  const target = $(`#regStep${step}`);
  if (target) target.style.display = 'block';
  
  // Update UI headers
  const title = $('#regModalTitle');
  const sub = $('#regModalSubtitle');
  const progress = $('#regProgressBar');
  
  const stepTitles = [
    '',
    'Step 1 of 4: Account Setup',
    'Step 2 of 4: Select Your Path',
    'Step 3 of 4: Profile Details',
    'Step 4 of 4: Review & Finalize'
  ];
  
  sub.textContent = stepTitles[step];
  progress.style.width = `${(step / 4) * 100}%`;
  
  if (step === 4) {
    updateReviewPanel();
  }
}

function updateReviewPanel() {
  const panel = $('#reviewPanel');
  const roleDisplay = selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1);
  
  let html = `
    <h4 style="margin-top:0;">Account Information</h4>
    <p><strong>Name:</strong> ${$('#firstName').value} ${$('#lastName').value}</p>
    <p><strong>Email:</strong> ${$('#regEmail').value}</p>
    <p><strong>Role:</strong> ${roleDisplay}</p>
  `;
  
  if (selectedRole === 'founder') {
    html += `
      <h4>Startup Details</h4>
      <p><strong>Startup:</strong> ${$('#startupName').value || '-'}</p>
      <p><strong>Field:</strong> ${$('#startupField').value || '-'}</p>
    `;
  } else {
    html += `
      <h4>Investor Details</h4>
      <p><strong>Focus:</strong> ${$('#investorFocus').value || '-'}</p>
      <p><strong>Fund:</strong> ${$('#investorFund').value || '-'}</p>
    `;
  }
  
  panel.innerHTML = html;
}

window.updatePasswordStrength = function(pw) {
  const bar = $('#strengthBar');
  const text = $('#strengthText');
  let score = 0;
  
  if (pw.length > 8) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  
  bar.className = 'strength-bar';
  if (pw.length === 0) {
    text.textContent = 'None';
  } else if (score === 0 || score === 1) {
    bar.classList.add('weak');
    text.textContent = 'Weak';
    text.style.color = '#ef4444';
  } else if (score === 2) {
    bar.classList.add('medium');
    text.textContent = 'Medium';
    text.style.color = '#f59e0b';
  } else {
    bar.classList.add('strong');
    text.textContent = 'Strong';
    text.style.color = '#10b981';
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
function checkAuthAndOpen(modalId) {
  if (currentUserProfile) {
    showToast('You are already logged in. Please log out first.', 'info');
    return;
  }
  
  // Reset registration form to Step 1
  if (modalId === 'registerModal') {
    goToRegStep(1);
    if ($('#registrationForm')) $('#registrationForm').reset();
  }
  
  openModal(modalId);
}

$('#loginBtn').addEventListener('click', (e) => {
  e.preventDefault();
  if (currentUserProfile) {
    if (auth && confirm('Do you want to sign out?')) {
      signOut(auth).then(() => {
        showToast('You have been signed out.', 'success');
      });
    }
  } else {
    checkAuthAndOpen('loginModal');
  }
});

$('#getStartedBtn').addEventListener('click', (e) => {
  e.preventDefault();
  if (currentUserProfile) {
    if (window.openDashboard) window.openDashboard();
  } else {
    checkAuthAndOpen('registerModal');
  }
});

// CTA buttons → register
$$('a[href="#register"]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    checkAuthAndOpen('registerModal');
  });
});
$$('a[href="#login"]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    checkAuthAndOpen('loginModal');
  });
});

// ---- Login handler ----
window.handleLogin = async function(e) {
  e.preventDefault();
  if (!auth) {
    showToast('Supabase is not configured. Please update supabase-config.js.', 'error', 4000);
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
    showToast(error.message, 'error', 4000);
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
    showToast('Supabase is not configured. Please update supabase-config.js.', 'error', 4000);
    return;
  }

  const firstName = $('#firstName').value.trim();
  const lastName = $('#lastName').value.trim();
  const email = $('#regEmail').value.trim();
  const password = $('#regPassword').value;
  let extraData = {};

  if (!firstName || !lastName || !email || !password) {
    showToast('Please fill in all core fields.', 'error');
    return;
  }
  if (password.length < 8) {
    showToast('Password must be at least 8 characters.', 'error');
    return;
  }

  // ── Collect role-specific data (validation only, no database writes yet) ──
  // FIX #3 — Startup document is now written AFTER user creation so ownerUid
  // is always set from the start. No more orphan documents if auth fails.
  let startupPayload = null;

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

    startupPayload = {
      name: startupName,
      field: startupField,
      stage: startupStage,
      employees: startupEmployees,
      capital: startupCapital,
      year: startupYear,
      website: startupWebsite,
      description: startupDescription,
      investorVisits: 0,
      createdAt: serverTimestamp()
    };

  } else if (selectedRole === 'investor') {
    const investorFund = $('#investorFund').value.trim();
    const investorFocus = $('#investorFocus').value.trim();
    const investorTicketSize = $('#investorTicketSize').value;
    const investorPreferredStage = $('#investorPreferredStage').value;

    if (!investorFocus || !investorTicketSize || !investorPreferredStage) {
      showToast('Please fill in all required investor fields.', 'error');
      return;
    }

    extraData = { investorFund, investorFocus, investorTicketSize, investorPreferredStage };
  }

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Creating account...';
    submitBtn.disabled = true;

    // ── Step 1: Create the authenticated user (metadata fuels the DB trigger) ──
    const registrationMetadata = {
      firstName,
      lastName,
      role: selectedRole,
      ...extraData
    };
    const userCred = await createUserWithEmailAndPassword(auth, email, password, registrationMetadata);
    const user = userCred.user;

    // ── Step 2: Write startup doc (Trigger handles user profile automatically) ──
    if (startupPayload) {
      const startupId = `startup_${user.uid}`;
      await setDoc(doc(db, "startups", startupId), {
        id: startupId,
        ownerUid: user.uid,
        ...startupPayload
      });
    }

    closeModal('registerModal');
    showToast(`🎉 Welcome to Investrade, ${firstName}!`, 'success', 5000);
    celebrate();
    e.target.reset();

    // Take user directly to dashboard
    setTimeout(() => {
      if (window.openDashboard) window.openDashboard();
    }, 1500);

  } catch (error) {
    console.error("Register Error:", error);
    showToast(error.message, 'error', 5000);
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
console.log('%cBuilt with ❤️ — Supabase Integration.', 'color:#6b7280');

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

// PRE-FILL ENROLLMENT FORM
function prefillEnrollmentForm() {
  if (currentUserProfile && $('#enrollEmail')) {
    $('#enrollEmail').value = currentUserProfile.email || '';
    $('#enrollFirstName').value = currentUserProfile.firstName || '';
    $('#enrollLastName').value = currentUserProfile.lastName || '';
  }
}

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

  // UI Updates for the selected method
  const completeBtn = $('#completeEnrollBtn');
  const noteText = $('#paymentNoteText');

  if (method === 'paypal') {
    if (completeBtn) completeBtn.style.display = 'none';
    if (noteText) noteText.textContent = 'Secure payment processing via PayPal SDK.';
  } else {
    if (completeBtn) completeBtn.style.display = 'block';
    if (noteText) noteText.textContent = 'Secure card payment powered by Stripe Checkout.';
  }
};

// "Complete Enrollment" button — card payment path.
// NOTE: Card payments are not yet integrated with a real processor.
// This button is intentionally disabled: it shows a clear message instead
// of granting access without verified payment (security fix).
// Real enrollment only happens after verified payment capture in backend.
window.handleCourseSubmit = function() {
  launchStripeCheckout();
};

async function launchStripeCheckout() {
  try {
    if (!courseApplicantData.email || !window.selectedCourseId) {
      showToast("Missing course or applicant data. Please complete Step 1 first.", "error", 5000);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      showToast("Please sign in before paying by card.", "error", 4000);
      return;
    }

    const API_BASE = supabaseConfig.functionsBaseUrl;
    const idToken = await getAccessToken();
    if (!idToken) {
      showToast("Your session is not ready yet. Confirm your email if required, or sign in again.", "error", 6000);
      return;
    }

    const res = await fetch(`${API_BASE}/createStripeCheckoutSession`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseConfig.anonKey,
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({
        courseId: window.selectedCourseId,
        courseApplicantData
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error || data.message || `Server error: ${res.status}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    if (!data.url) throw new Error("No Stripe checkout URL returned");

    window.location.href = data.url;
  } catch (err) {
    console.error("Stripe checkout launch error:", err);
    showToast("Error starting Stripe checkout: " + err.message, "error", 5000);
  }
}

async function handleStripeReturn() {
  try {
    const params = new URLSearchParams(window.location.search);
    const stripeState = params.get("stripe") || params.get("checkout");
    if (stripeState !== "success") return;

    const type = params.get("type");
    
    if (type === "subscription") {
      showToast('🎉 Welcome to your new Subscription! Activating your account...', 'success', 6000);
    } else {
      showToast('🎉 Payment Successful! Generating your access code...', 'success', 6000);
    }
    
    // Add a slight delay to give the webhook time to insert the record before the dashboard fetches data
    setTimeout(async () => {
      if (auth.currentUser) {
        try {
          const docSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
          if (docSnap.exists()) {
            currentUserProfile = { ...docSnap.data(), uid: auth.currentUser.uid };
            updatePricingUI();
          }
        } catch(e) { console.error(e); }
      }
      if (window.openDashboard) window.openDashboard();
    }, 3500);

    // Clean up URL parameters
    params.delete("stripe");
    params.delete("checkout");
    params.delete("session_id");
    const cleanQuery = params.toString();
    const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", cleanUrl);
  } catch (err) {
    console.error("Stripe return handling error:", err);
  }
}

// ---- Subscription Logic ----
window.handlePlanSelection = async function(planId) {
  try {
    const user = auth.currentUser;
    if (!user) {
      showToast("Please sign in or create an account to subscribe.", "info", 4000);
      window.location.hash = "#register";
      return;
    }

    if (planId === "starter") {
      window.openEnrollModal(
        'starter-plan', 
        'Starter Plan Subscription', 
        29, 
        'https://paypal.me/CobraAhmed/29',
        'https://buy.stripe.com/test_fZu7sMfruboKaN3aHK5c402'
      );
    } else if (planId === "pro") {
      window.openEnrollModal(
        'pro-plan', 
        'Pro Plan Subscription', 
        79, 
        'https://paypal.me/CobraAhmed/79',
        'https://buy.stripe.com/test_00wcN6enq50mbR7bLO5c401'
      );
    } else if (planId === "venture") {
      window.openEnrollModal(
        'venture-plan', 
        'Venture Plan Subscription', 
        249, 
        'https://paypal.me/CobraAhmed/249',
        'https://buy.stripe.com/test_00wcN6enq50mbR7bLO5c401'
      );
    } else {
      showToast("The " + planId + " plan is coming soon!", "info", 4000);
      return;
    }
  } catch (err) {
    console.error("Plan selection error:", err);
    showToast("Error starting subscription.", "error", 5000);
  }
};

window.openCustomerPortal = async function() {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const API_BASE = supabaseConfig.functionsBaseUrl;
    const idToken = await getAccessToken();
    if (!idToken) {
      showToast("Your session is not ready yet. Sign in again to manage billing.", "error", 5000);
      return;
    }

    const res = await fetch(`${API_BASE}/createCustomerPortalSession`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseConfig.anonKey,
        "Authorization": `Bearer ${idToken}`
      }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || "Portal error");
    }
    if (!data.url) throw new Error("No portal URL returned");
    window.location.href = data.url;
  } catch (err) {
    console.error("Portal error:", err);
    showToast("Error opening billing portal: " + err.message, "error", 5000);
  }
};

// ---- PayPal SDK Integration ----
// FIX #6 — PayPal buttons are now rendered on demand inside openEnrollModal,
// NOT at page load. This ensures:
//   a) The #paypal-button-container DOM element exists before render() is called.
//   b) window.selectedCourseId and courseApplicantData are always up to date.
// FIX #7 — window.selectedCourseId is guaranteed to be set by the time the
//   PayPal buttons are rendered because renderPayPalButtons() is called from
//   openEnrollModal, which sets the value right before calling this function.

let paypalButtonsRendered = false;

function renderPayPalButtons() {
  const container = document.getElementById('paypal-button-container');
  if (!container) return;

  if (!window.paypal) {
    container.innerHTML = '<p style="color:var(--destructive);font-size:0.875rem;">PayPal failed to load. Please refresh the page.</p>';
    return;
  }

  // Clear previous render before re-rendering (PayPal throws if you render twice)
  container.innerHTML = '';
  paypalButtonsRendered = false;

  const API_BASE = supabaseConfig.functionsBaseUrl;

  paypal.Buttons({
    createOrder: async function() {
      // courseApplicantData is set by handleCourseStep1 before step 2 is shown
      if (!courseApplicantData.email || !window.selectedCourseId) {
        showToast("Missing course or applicant data. Please go back and fill in your details.", "error", 5000);
        return Promise.reject(new Error("Missing data"));
      }
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE}/createPayPalOrder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseConfig.anonKey,
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ courseId: window.selectedCourseId })
        });
        const orderData = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = orderData.error || orderData.message || `Server error: ${res.status}`;
          throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
        if (!orderData.id) throw new Error('No order ID returned from server');
        return orderData.id;
      } catch (err) {
        console.error("Order creation failed", err);
        showToast("Error creating PayPal order: " + err.message, "error", 5000);
        return Promise.reject(err);
      }
    },

    onApprove: async function(data) {
      try {
        const user = auth.currentUser;
        if (!user) {
          showToast("Please sign in before completing payment.", "error", 4000);
          return;
        }
        const idToken = await getAccessToken();
        if (!idToken) {
          showToast("Your session is not ready. Sign in again before completing PayPal.", "error", 5000);
          return;
        }

        const res = await fetch(`${API_BASE}/capturePayPalOrder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            orderID: data.orderID,
            courseApplicantData: courseApplicantData,
            courseId: window.selectedCourseId
          })
        });
        const captureData = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = captureData.error || captureData.message || `Server error: ${res.status}`;
          throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        }

        if (captureData.success) {
          $('#enrollStep2').style.display = 'none';
          $('#enrollStep3').style.display = 'block';
          $('#enrollQrImage').src = captureData.qrUrl;
          $('#enrollAccessCode').textContent = captureData.accessCode;
          $('#enrollStepLabel').textContent = 'Success!';
          showToast('🎓 PayPal Payment Successful!', 'success', 5000);
          courseApplicantData = {};
        } else {
          showToast('Payment verification failed. Please contact support.', 'error', 5000);
        }
      } catch (err) {
        console.error("Capture failed", err);
        showToast("Error verifying PayPal payment: " + err.message, "error", 5000);
      }
    },

    onError: function(err) {
      console.error("PayPal error:", err);
      showToast("PayPal encountered an error. Please try again.", "error", 4000);
    },

    onCancel: function() {
      showToast("Payment cancelled.", "info", 3000);
    }
  }).render('#paypal-button-container').then(() => {
    paypalButtonsRendered = true;
  }).catch(err => {
    console.error("PayPal render error:", err);
  });
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
  document.querySelectorAll('.dash-nav-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  // Update tabs dynamically by selecting children of dashMain
  const mainTabs = document.getElementById('dashMain').children;
  Array.from(mainTabs).forEach(tab => {
    if (tab.id) {
      tab.style.display = (tab.id === tabId) ? 'block' : 'none';
    }
  });

  // Load forum messages if active
  if (tabId === 'dashCommunityForum') {
    if (window.loadForumMessages) window.loadForumMessages();
  }
};

window.handleSignOut = function() {
  if (auth && confirm('Are you sure you want to sign out?')) {
    signOut(auth).then(() => {
      closeDashboard();
      showToast('Signed out successfully.');
    });
  }
};

window.populateDashboard = async function() {
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

  // Fetch Startup Data if Founder
  let s = p; // default to legacy (info in user doc)
  if (p.role === 'founder' && p.startupId) {
    try {
      const sSnap = await getDoc(doc(db, "startups", p.startupId));
      if (sSnap.exists()) s = sSnap.data();
    } catch (err) { console.error("Error fetching startup:", err); }
  }

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
      <div class="dash-nav-section">Community</div>
      <button class="dash-nav-item" onclick="dashTabSwitch(this,'dashCommunityForum')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        <span>Forum</span>
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
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
            <span style="font-size:0.78rem;color:var(--muted-fg);">Member since ${joinDate}</span>
            ${p.subscriptionTier ? `<span class="dash-role-badge" style="background:var(--primary); color:white;">${p.subscriptionTier.toUpperCase()} PLAN</span>` : ''}
          </div>
        </div>
        
        <div class="dash-stats-row cols-3" style="grid-template-columns: repeat(3, 1fr);">
          <div class="dash-stat-card primary-card">
            <div class="dash-stat-label">Startup Value</div>
            <div class="dash-stat-value">-</div>
            <div class="dash-stat-sub">Pre-seed Estimation</div>
          </div>
          <div class="dash-stat-card">
            <div class="dash-stat-label">Investor Visits</div>
            <div class="dash-stat-value">${s.investorVisits || 0}</div>
            <div class="dash-stat-sub">Total views from verified funds</div>
          </div>
          <div class="dash-stat-card" style="background: linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.1) 100%); border: 1px solid rgba(99,102,241,0.2);">
            <div class="dash-stat-label">Membership</div>
            <div class="dash-stat-value" style="color: var(--primary); font-size: 1.5rem; letter-spacing: 1px;">${p.subscriptionTier ? p.subscriptionTier.toUpperCase() : 'FREE'}</div>
            <div class="dash-stat-sub">${p.subscriptionStatus === 'active' ? 'Premium Access' : 'Basic Member'}</div>
          </div>
        </div>

        <div class="dash-grid wide">
          <div class="dash-panel">
            <div class="dash-panel-header">
              <span class="dash-panel-title">Your Startup Profile</span>
              <span class="dash-panel-badge">Active</span>
            </div>
            <div class="dash-info-list">
              <div class="dash-info-row"><div class="dash-info-icon">🏢</div><div class="dash-info-content"><span class="dash-info-key">Name</span><span class="dash-info-val">${s.startupName || s.name}</span></div></div>
              <div class="dash-info-row"><div class="dash-info-icon">🌐</div><div class="dash-info-content"><span class="dash-info-key">Field</span><span class="dash-info-val">${s.startupField || s.field}</span></div></div>
              <div class="dash-info-row"><div class="dash-info-icon">📉</div><div class="dash-info-content"><span class="dash-info-key">Stage</span><span class="dash-info-val">${s.startupStage || s.stage}</span></div></div>
              <div class="dash-info-row"><div class="dash-info-icon">👥</div><div class="dash-info-content"><span class="dash-info-key">Employees</span><span class="dash-info-val">${s.startupEmployees || s.employees}</span></div></div>
            </div>
          </div>
          
          <div class="dash-panel">
            <div class="dash-panel-header">
              <span class="dash-panel-title">Funding & Details</span>
            </div>
            <div class="dash-info-list">
              <div class="dash-info-row"><div class="dash-info-icon">💰</div><div class="dash-info-content"><span class="dash-info-key">Capital Needs</span><span class="dash-info-val">${s.startupCapital || s.capital || '-'}</span></div></div>
              <div class="dash-info-row"><div class="dash-info-icon">🔗</div><div class="dash-info-content"><span class="dash-info-key">Website</span><span class="dash-info-val">${s.startupWebsite || s.website || '-'}</span></div></div>
              <div class="dash-info-row"><div class="dash-info-icon">📝</div><div class="dash-info-content"><span class="dash-info-key">Pitch / Description</span><span class="dash-info-val" style="white-space: normal; line-height: 1.4;">${s.startupDescription || s.description || '-'}</span></div></div>
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
              <div class="dash-info-row"><div class="dash-info-content"><span class="dash-info-key">Subscription</span><span class="dash-info-val" style="text-transform: capitalize; font-weight: bold; color: var(--primary);">${p.subscription_tier || 'Free'}</span></div></div>
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
        <div id="courseMarketList">
          <!-- Dynamically populated -->
          <div class="loader" style="margin: 2rem auto; border-color:var(--primary); border-top-color:transparent;"></div>
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
      
      <!-- COMMUNITY FORUM -->
      <div id="dashCommunityForum" style="display:none;">
        <div class="dash-welcome">
          <div class="dash-welcome-text">
            <h1>Community Forum</h1>
            <p>Connect with other founders and investors in the Investrade ecosystem.</p>
          </div>
        </div>

        ${(p.subscriptionStatus === 'active' || p.subscriptionTier) ? `
          <div class="dash-panel" style="margin-bottom:2rem; padding:1.5rem;">
            <form onsubmit="handleForumPost(event)" style="display:flex; flex-direction:column; gap:1rem;">
              <textarea id="forumMessageInput" placeholder="Share an update, ask a question, or introduce yourself..." 
                style="width:100%; min-height:100px; padding:1rem; border-radius:0.75rem; border:1px solid var(--border); background:var(--background); color:var(--foreground); font-family:inherit; resize:vertical;" required></textarea>
              <div style="display:flex; justify-content:flex-end;">
                <button type="submit" class="btn btn-primary">Post Message</button>
              </div>
            </form>
          </div>

          <div id="forumMessagesContainer">
            <div style="padding:2rem; text-align:center; color:var(--muted-fg);">Loading discussions...</div>
          </div>
        ` : `
          <div class="dash-panel" style="align-items:center; padding:4rem; text-align:center;">
            <div style="font-size:3rem; margin-bottom:1.5rem;">🔒</div>
            <h3 style="font-size:1.5rem; font-weight:700; margin-bottom:1rem;">Subscription Required</h3>
            <p style="color:var(--muted-fg); font-size:1rem; max-width:450px; margin:0 auto 2rem;">
              The Community Forum is exclusive to our Starter, Pro, and Venture members. 
              Join the conversation to connect with top-tier founders and investors.
            </p>
            <a href="#pricing" onclick="closeDashboard()" class="btn btn-primary">View Plans & Subscribe</a>
          </div>
        `}
      </div>
    `;

    // Fetch My Courses dynamically
    if (window.fetchMyCourses) window.fetchMyCourses(p.uid, p.email);
    
    // Fetch Market Courses dynamically
    fetchMarketCourses();

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
      <div class="dash-nav-section">Community</div>
      <button class="dash-nav-item" onclick="dashTabSwitch(this,'dashCommunityForum')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        <span>Forum</span>
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
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
            <span style="font-size:0.78rem;color:var(--muted-fg);">Fund: ${p.investorFund || 'Angel'}</span>
            ${p.subscriptionTier ? `<span class="dash-role-badge" style="background:var(--primary); color:white;">${p.subscriptionTier.toUpperCase()} PLAN</span>` : ''}
          </div>
        </div>
        
        <div class="dash-stats-row cols-3">
          <div class="dash-stat-card gold-card">
            <div class="dash-stat-label">AUM Focus</div>
            <div class="dash-stat-value">${p.investorTicketSize}</div>
            <div class="dash-stat-sub">Average Ticket Size</div>
          </div>
          <div class="dash-stat-card">
            <div class="dash-stat-label">Membership</div>
            <div class="dash-stat-value" style="color: var(--primary); font-size: 1.5rem;">${p.subscriptionTier ? p.subscriptionTier.toUpperCase() : 'FREE'}</div>
            <div class="dash-stat-sub">${p.subscriptionStatus === 'active' ? 'Full Access' : 'Basic Access'}</div>
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
              <div class="dash-info-row"><div class="dash-info-content"><span class="dash-info-key">Subscription</span><span class="dash-info-val" style="text-transform: capitalize; font-weight: bold; color: var(--primary);">${p.subscription_tier || 'Free'}</span></div></div>
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
      
      <!-- COMMUNITY FORUM -->
      <div id="dashCommunityForum" style="display:none;">
        <div class="dash-welcome">
          <div class="dash-welcome-text">
            <h1>Community Forum</h1>
            <p>Connect with other founders and investors in the Investrade ecosystem.</p>
          </div>
        </div>

        ${(p.subscriptionStatus === 'active' || p.subscriptionTier) ? `
          <div class="dash-panel" style="margin-bottom:2rem; padding:1.5rem;">
            <form onsubmit="handleForumPost(event)" style="display:flex; flex-direction:column; gap:1rem;">
              <textarea id="forumMessageInput" placeholder="Share an update, ask a question, or introduce yourself..." 
                style="width:100%; min-height:100px; padding:1rem; border-radius:0.75rem; border:1px solid var(--border); background:var(--background); color:var(--foreground); font-family:inherit; resize:vertical;" required></textarea>
              <div style="display:flex; justify-content:flex-end;">
                <button type="submit" class="btn btn-primary">Post Message</button>
              </div>
            </form>
          </div>

          <div id="forumMessagesContainer">
            <div style="padding:2rem; text-align:center; color:var(--muted-fg);">Loading discussions...</div>
          </div>
        ` : `
          <div class="dash-panel" style="align-items:center; padding:4rem; text-align:center;">
            <div style="font-size:3rem; margin-bottom:1.5rem;">🔒</div>
            <h3 style="font-size:1.5rem; font-weight:700; margin-bottom:1rem;">Subscription Required</h3>
            <p style="color:var(--muted-fg); font-size:1rem; max-width:450px; margin:0 auto 2rem;">
              The Community Forum is exclusive to our Starter, Pro, and Venture members. 
              Join the conversation to connect with top-tier founders and investors.
            </p>
            <a href="#pricing" onclick="closeDashboard()" class="btn btn-primary">View Plans & Subscribe</a>
          </div>
        `}
      </div>
    `;

    // Fetch Startup Directory content
    fetchStartupDirectory();
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

    // Trigger email verification flow if email is changing
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
    
    // Update profile
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

window.fetchMyCourses = async function(uid, email) {
  try {
    const qByUid = query(collection(db, "courseEnrollments"), where("userId", "==", uid));
    let snapshot = await getDocs(qByUid);

    // Backward compatibility for old enrollment docs created before userId existed.
    if (snapshot.empty && email) {
      const qByEmail = query(collection(db, "courseEnrollments"), where("email", "==", email));
      snapshot = await getDocs(qByEmail);
    }
    
    const container = document.getElementById('enrolledCourseContainer');
    if(!container) return;

    if (snapshot.empty) {
      container.innerHTML = `
        <div style="font-size:3rem;margin-bottom:1rem;">📚</div>
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:0.5rem;">You haven't enrolled yet</h3>
        <p style="color:var(--muted-fg);font-size:0.875rem;max-width:400px;">Browse the Course Marketplace to enroll in your first masterclass.</p>
        <button onclick="dashTabSwitch(document.querySelector('[onclick=\\'dashTabSwitch(this,\\'dashMarketCourses\\')\\']'), 'dashMarketCourses')" class="btn btn-outline" style="margin-top:1.5rem;">Browse Courses</button>
      `;
    } else {
      let html = '';
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        html += `
          <div style="text-align:left; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <h3 style="font-weight:700;font-size:1.2rem;">${data.course}</h3>
                <p style="font-size:0.85rem;color:var(--muted-fg);margin-top:0.3rem;">Status: <span style="color:var(--primary);">${data.paymentStatus.toUpperCase()}</span> · Session Date: ${data.sessionDate}</p>
              </div>
              <div style="text-align:center;">
                 <img src="${data.qrUrl}" style="width:80px;height:80px;border-radius:8px;border:1px solid var(--border);" />
                 <div style="font-family:monospace; font-size:0.75rem; color:var(--primary); margin-top:0.3rem;">${data.accessCode}</div>
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
        `;
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

// ---- Dynamic Course Marketplace ----
async function fetchMarketCourses() {
  const container = $('#courseMarketList');
  if (!container) return;

  try {
    // 1. Fetch available courses
    const q = query(collection(db, "courses"), where("isActive", "==", true));
    const snap = await getDocs(q);
    
    // 2. Fetch current user's enrollments to disable 'Apply Now' buttons
    const user = auth.currentUser;
    const enrolledCourseIds = new Set();
    
    if (user) {
      const qEnrollments = query(collection(db, "courseEnrollments"), where("userId", "==", user.uid));
      const enrollSnap = await getDocs(qEnrollments);
      enrollSnap.forEach(doc => {
        enrolledCourseIds.add(doc.data().courseId);
      });
    }

    if (snap.empty) {
      container.innerHTML = '<p style="text-align:center;padding:2rem;">No courses available at the moment.</p>';
      return;
    }

    let html = '';
    snap.forEach(docSnap => {
      const c = docSnap.data();
      const courseId = docSnap.id;
      const isEnrolled = enrolledCourseIds.has(courseId);
      
      const buttonHtml = isEnrolled 
        ? `<button class="btn" style="background: var(--muted); border-color: var(--muted-fg); color: var(--muted-fg); cursor: not-allowed;" disabled>Applied ✓</button>`
        : `<button onclick="openEnrollModal('${courseId}', '${c.title}', ${c.price})" class="btn btn-primary">Apply Now</button>`;

      html += `
        <div class="dash-panel" style="display:flex;flex-direction:row;justify-content:space-between;align-items:center;padding:2rem;margin-bottom:1rem;">
          <div>
            <h3 style="font-size:1.1rem;font-weight:700;">${c.title}</h3>
            <p style="color:var(--muted-fg);font-size:0.875rem;margin-top:0.5rem;max-width:500px;">${c.description}</p>
            <p style="font-weight:600;margin-top:1rem;color:var(--primary);">$${c.price} — Next Live Session: ${c.nextSession}</p>
          </div>
          ${buttonHtml}
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error("Error fetching market courses:", err);
    container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--destructive);">Error loading courses.</p>';
  }
}

window.openEnrollModal = function(courseId, title, price, customPaypalLink, customStripeLink) {
    if (!auth.currentUser) {
      showToast("Please sign in or create an account to proceed.", "info", 4000);
      window.location.hash = "#register";
      return;
    }

    window.selectedCourseId = courseId;
    window.selectedCourseTitle = title;
    window.selectedCoursePrice = price;
    window.selectedPaypalMeLink = customPaypalLink || `https://paypal.me/CobraAhmed/${price}`;
    window.selectedStripeLink = customStripeLink || "https://buy.stripe.com/test_00wcN6enq50mbR7bLO5c401";
    
    // Update labels in payment modal
    $('#paymentModalItemName').innerHTML = `${title} — <strong style="color: var(--primary);" id="paymentModalItemPrice">$${price}</strong>`;
    
    openModal('paymentMethodModal');

    // Render PayPal buttons fresh after modal opens
    setTimeout(renderPayPalButtons, 150);
};

window.handleDirectStripeCheckout = async function() {
    showToast("Card payments are coming soon! Please use the PayPal option for immediate access.", "info", 5000);
};

window.handleManualPayPalCheckout = async function() {
    const paypalMeLink = window.selectedPaypalMeLink || "https://paypal.me/CobraAhmed/300";
    const user = auth.currentUser;
    if (!user) return;

    // Show loading state
    showToast("Initiating registration...", "info", 2000);

    // If it's a course enrollment, create the "unpaid" record automatically
    if (window.selectedCourseId && window.selectedCourseId !== 'starter-plan') {
      try {
        const enrollmentId = `MANUAL-${Date.now()}`;
        const accessCode = generateAccessCode();
        // Generate a placeholder QR URL
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${accessCode}`;
        
        const enrollmentData = {
          id: enrollmentId,
          user_id: user.uid,
          email: courseApplicantData.email || user.email,
          course_id: window.selectedCourseId,
          course: window.selectedCourseTitle,
          price: window.selectedCoursePrice,
          payment_status: 'unpaid',
          payment_provider: 'paypal',
          first_name: courseApplicantData.firstName || '',
          last_name: courseApplicantData.lastName || '',
          age: courseApplicantData.age || '',
          country: courseApplicantData.country || '',
          education: courseApplicantData.education || '',
          professional: courseApplicantData.professional || '',
          motivation: courseApplicantData.motivation || '',
          access_code: accessCode,
          qr_url: qrUrl,
          session_date: 'Pending Admin Approval'
        };

        const { error } = await supabase.from('course_enrollments').insert(enrollmentData);
        if (error) throw error;

        showToast("Registration pending! Redirecting to PayPal...", "success", 4000);
      } catch (err) {
        console.error("Error creating manual enrollment:", err);
        showToast("Note: Registration will be finalized after payment review.", "warning", 5000);
      }
    } else if (window.selectedCourseId && window.selectedCourseId.includes('-plan')) {
      // For subscriptions (starter-plan, pro-plan, venture-plan), update the user profile to "unpaid"
      try {
        const tier = window.selectedCourseId.split('-')[0]; // starter, pro, or venture
        await supabase.from('users').update({
          subscription_status: 'unpaid',
          subscription_tier: tier
        }).eq('id', user.uid);
      } catch (err) {
        console.error("Error updating subscription status:", err);
      }
    }

    // Open PayPal link in new tab
    window.open(paypalMeLink, '_blank');
    
    setTimeout(() => {
        showToast("Payment link opened. Once you pay, our admin will activate your access!", "info", 8000);
        closeModal('paymentMethodModal');
        // If enrollModal is open, close it too
        if (typeof closeModal === 'function') {
            const enrollModal = document.getElementById('enrollModal');
            if (enrollModal) closeModal('enrollModal');
        }
    }, 2000);
};

// ---- Analytics: Log Visit ----
window.logStartupVisit = async function(startupId) {
  if (!currentUserProfile || currentUserProfile.role !== 'investor') return;

  // FIX: use auth.currentUser.uid (always defined for authenticated users)
  // instead of currentUserProfile.uid which was previously never stored.
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  try {
    // Use auto-generated DB ID
    await addDoc(collection(db, "startups", startupId, "visits"), {
      visitorUid: uid,
      visitorName: `${currentUserProfile.firstName} ${currentUserProfile.lastName}`,
      visitorFund: currentUserProfile.investorFund || 'Angel',
      timestamp: serverTimestamp()
    });
    // Increment total visit count
    await updateDoc(doc(db, "startups", startupId), {
      investorVisits: increment(1)
    });
  } catch (err) {
    console.warn("Analytics error:", err);
  }
};

// ---- Investor: Startup Directory ----
async function fetchStartupDirectory() {
  const container = $('#dashDirectory'); // We need to make sure this div exists or create it
  if (!container) return;

  try {
    const q = query(collection(db, "startups"), limit(20));
    const snap = await getDocs(q);
    
    let html = `
      <div class="dash-welcome"><div class="dash-welcome-text"><h1>Startup Directory</h1><p>Explore verified startups looking for funding.</p></div></div>
      <div class="directory-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
    `;

    if (snap.empty) {
      html += '<p style="grid-column: 1/-1; text-align:center; padding:3rem;">No startups found yet.</p>';
    } else {
      snap.forEach(docSnap => {
        const s = docSnap.data();
        html += `
          <div class="dash-panel" style="display:flex; flex-direction:column; gap:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="dash-panel-badge">${s.stage}</span>
              <span style="font-size:0.75rem; color:var(--muted-fg);">Visits: ${s.investorVisits || 0}</span>
            </div>
            <h3 style="font-weight:700;">${s.name}</h3>
            <p style="font-size:0.85rem; color:var(--muted-fg); line-height:1.4; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${s.description}</p>
            <div style="margin-top:auto; padding-top:1rem; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.8rem; font-weight:600; color:var(--primary);">${s.field}</span>
              <button onclick="logStartupVisit('${docSnap.id}'); showToast('Viewing ${s.name}...')" class="btn btn-outline btn-sm">View Profile</button>
            </div>
          </div>
        `;
      });
    }

    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    console.error("Error fetching startups:", err);
  }
}



// ----------------------------------------------------------------------
// COMMUNITY FORUM LOGIC
// ----------------------------------------------------------------------

window.loadForumMessages = async function() {
  const container = document.getElementById('forumMessagesContainer');
  if (!container) return;
  
  try {
    const { data, error } = await supabase
      .from('forum_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) throw error;
    
    if (!data || data.length === 0) {
      container.innerHTML = '<div class="dash-panel" style="padding:4rem; text-align:center; color:var(--muted-fg);">No discussions yet. Be the first to post!</div>';
      return;
    }
    
    container.innerHTML = data.map(msg => `
      <div class="dash-panel" style="margin-bottom:1rem; padding:1.5rem; animation: fadeIn 0.3s ease;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div style="width:36px; height:36px; border-radius:50%; background:var(--primary); color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.9rem;">
              ${(msg.user_name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:600; font-size:0.9rem; color:var(--foreground);">${msg.user_name}</div>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span class="dash-role-badge ${msg.user_role}" style="font-size:0.65rem; padding:0.1rem 0.4rem;">${msg.user_role}</span>
              </div>
            </div>
          </div>
          <div style="font-size:0.75rem; color:var(--muted-fg);">
            ${new Date(msg.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        </div>
        <div style="font-size:0.95rem; line-height:1.6; color:var(--foreground); white-space:pre-wrap; background:rgba(255,255,255,0.03); padding:1rem; border-radius:0.5rem; border:1px solid rgba(255,255,255,0.05);">${msg.message}</div>
      </div>
    `).join('');
    
  } catch (err) {
    console.error("Error loading forum:", err);
    container.innerHTML = '<div class="dash-panel" style="padding:2rem; text-align:center; color:var(--error);">Failed to load messages. Check console.</div>';
  }
};

window.handleForumPost = async function(event) {
  event.preventDefault();
  const input = document.getElementById('forumMessageInput');
  const btn = event.target.querySelector('button');
  const msg = input.value.trim();
  
  if (!msg) return;
  if (!currentUserProfile) {
    showToast('Please sign in to post.', 'error');
    return;
  }
  
  btn.disabled = true;
  btn.textContent = 'Posting...';
  
  try {
    const { error } = await supabase.from('forum_messages').insert({
      user_id: currentUserProfile.uid,
      user_name: `${currentUserProfile.firstName} ${currentUserProfile.lastName}`,
      user_role: currentUserProfile.role,
      message: msg
    });
    
    if (error) throw error;
    
    input.value = '';
    showToast('Message posted successfully!', 'success');
    await loadForumMessages();
  } catch (err) {
    console.error("Error posting to forum:", err);
    showToast('Error posting: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post Message';
  }
};

// ---- Training Session Logic ----
let trainingFormData = {};

window.openTrainingModal = function() {
  trainingFormData = {};
  const step1 = $('#trainingStep1');
  const step2 = $('#trainingStep2');
  const success = $('#trainingSuccess');
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';
  if (success) success.style.display = 'none';
  openModal('trainingModal');
};

window.closeBanner = function() {
  const banner = $('#promoBanner');
  if (banner) {
    banner.style.display = 'none';
    document.body.classList.remove('has-banner');
  }
};

window.handleTrainingRegister = async function(e) {
  e.preventDefault();
  const btn = $('#trainSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  try {
    trainingFormData = {
      training_session_id: 'a1b2c3d4-e5f6-4a5b-b6c7-d8e9f0a1b2c3', 
      first_name: $('#trainFirstName').value.trim(),
      last_name: $('#trainLastName').value.trim(),
      email: $('#trainEmail').value.trim().toLowerCase(),
      occupation: $('#trainOccupation').value.trim(),
      phone_number: $('#trainCountryCode').value + ' ' + $('#trainPhone').value.trim(),
    };

    // Check if already registered
    const { data: existing, error: checkError } = await supabase
      .from('training_registrations')
      .select('id')
      .eq('training_session_id', trainingFormData.training_session_id)
      .eq('email', trainingFormData.email)
      .maybeSingle();

    if (existing) {
      showToast('You are already registered for this session!', 'error');
      btn.disabled = false;
      btn.textContent = 'Continue Registration';
      return;
    }

    // Move to step 2 (referral)
    $('#trainingStep1').style.display = 'none';
    $('#trainingStep2').style.display = 'block';
  } catch (err) {
    console.error('Registration error:', err);
    showToast('Something went wrong. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Continue Registration';
  }
};

window.submitReferral = async function(source) {
  try {
    trainingFormData.referral_source = source;
    
    // Final submission to Supabase
    const { error } = await supabase
      .from('training_registrations')
      .insert([trainingFormData]);

    if (error) {
      if (error.code === '23505') { 
        showToast('You are already registered with this email!', 'error');
        return;
      }
      throw error;
    }

    // Show success
    $('#trainingStep2').style.display = 'none';
    $('#trainingSuccess').style.display = 'block';
    if (typeof celebrate === 'function') celebrate();
    if (typeof triggerConfetti === 'function') triggerConfetti();
    
  } catch (err) {
    console.error('Referral submission error:', err);
    showToast('Registration Error: ' + (err.message || 'Check console'), 'error');
  }
};

// Initialize page state
document.addEventListener('DOMContentLoaded', () => {
  // Any page initialization logic goes here
});

/* =============================================
   ADMIN DASHBOARD LOGIC
   ============================================= */
window.openAdminDashboard = function() {
  const adminEmails = [
    'omarboudaya1@gmail.com',
    'dr.maherkhedher@wisdomnets.com',
    'mohammedkhedher222@gmail.com'
  ];
  if (!currentUserProfile || !adminEmails.includes(currentUserProfile.email)) {
    showToast('Unauthorized access.', 'error');
    return;
  }
  
  $('#adminDashboardPage').classList.add('open');
  document.body.style.overflow = 'hidden';
  switchAdminTab('overview');
};

window.closeAdminDashboard = function() {
  $('#adminDashboardPage').classList.remove('open');
  document.body.style.overflow = '';
};

window.switchAdminTab = function(tabId) {
  // Update sidebar UI
  document.querySelectorAll('#adminSidebar .db-sidebar-item').forEach(el => {
    el.classList.remove('active');
    if (el.dataset.tab === tabId) el.classList.add('active');
  });

  // Switch tabs
  document.querySelectorAll('.admin-tab-content').forEach(tab => {
    tab.style.display = (tab.id === `admin-tab-${tabId}`) ? 'block' : 'none';
  });

  // Trigger data load if needed
  if (tabId === 'overview') populateAdminDashboard();
  if (tabId === 'users') loadAdminUsers();
  if (tabId === 'startups') loadAdminStartups();
  if (tabId === 'enrollments') loadAdminEnrollments();
  if (tabId === 'trainings') loadAdminTrainings();
  if (tabId === 'financials') loadAdminFinancials();
};

async function populateAdminDashboard() {
  try {
    // Basic stats
    const { count: userCount, error: uErr } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: startupCount, error: sErr } = await supabase.from('startups').select('*', { count: 'exact', head: true });
    const { count: enrollmentCount, error: eErr } = await supabase.from('course_enrollments').select('*', { count: 'exact', head: true });

    if (uErr || sErr || eErr) {
       console.warn("RLS or Database Error:", uErr || sErr || eErr);
       $('#admin-recent-activity').innerHTML = `
         <div style="padding: 2rem; text-align: center; background: #fff1f2; color: #991b1b; border-radius: 12px; border: 1px solid #fecaca;">
           <p style="font-weight: 700; margin-bottom: 0.5rem;">Database Access Restricted</p>
           <p style="font-size: 0.85rem; opacity: 0.8;">Please ensure Row Level Security (RLS) policies are configured in Supabase to allow admin access.</p>
         </div>
       `;
       return;
    }

    if ($('#stat-total-users')) $('#stat-total-users').textContent = userCount || 0;
    if ($('#stat-total-startups')) $('#stat-total-startups').textContent = startupCount || 0;
    if ($('#stat-total-enrollments')) $('#stat-total-enrollments').textContent = enrollmentCount || 0;

    // Load recent activity
    const { data: recentUsers } = await supabase.from('users').select('*').order('joined_at', { ascending: false }).limit(5);
    
    if (recentUsers && recentUsers.length > 0) {
      let html = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            ${recentUsers.map(u => `
              <tr>
                <td>${u.first_name} ${u.last_name}</td>
                <td>${u.email}</td>
                <td><span class="admin-badge badge-${u.role}">${u.role}</span></td>
                <td>${new Date(u.joined_at).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      $('#admin-recent-activity').innerHTML = html;
    } else {
      $('#admin-recent-activity').innerHTML = '<p style="padding: 1rem; color: var(--muted-fg);">No recent activity found.</p>';
    }

  } catch (err) {
    console.error("Admin dash error:", err);
    showToast('Error loading admin data.', 'error');
  }
}

async function loadAdminUsers() {
  const container = $('#admin-users-list');
  container.innerHTML = '<p style="padding:1rem;">Loading users...</p>';
  try {
    const { data: users, error } = await supabase.from('users').select('*').order('joined_at', { ascending: false });
    
    if (error) {
      container.innerHTML = `<p style="padding:2rem; color:var(--destructive); text-align:center;">Access Denied: ${error.message}</p>`;
      return;
    }

    if (!users || users.length === 0) {
      container.innerHTML = '<p style="padding:2rem; text-align:center;">No users found in database.</p>';
      return;
    }

    let html = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Plan</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${u.first_name} ${u.last_name}</td>
              <td>${u.email}</td>
              <td><span class="admin-badge badge-${u.role}">${u.role}</span></td>
              <td>${u.subscription_tier || 'Free'}</td>
              <td>
                <button class="admin-action-btn" onclick="showToast('Edit feature coming soon')">✏️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.innerHTML = html;
  } catch (err) { 
    console.error(err);
    container.innerHTML = '<p style="padding:2rem; color:var(--destructive);">Unexpected error loading users.</p>';
  }
}

async function loadAdminStartups() {
  const container = $('#admin-startups-list');
  container.innerHTML = '<p style="padding:1rem;">Loading startups...</p>';
  try {
    const { data: startups, error } = await supabase.from('startups').select('*').order('created_at', { ascending: false });
    
    if (error) {
      container.innerHTML = `<p style="padding:2rem; color:var(--destructive); text-align:center;">Access Denied: ${error.message}</p>`;
      return;
    }

    if (!startups || startups.length === 0) {
      container.innerHTML = '<p style="padding:2rem; text-align:center;">No startups found in database.</p>';
      return;
    }

    let html = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Startup Name</th>
            <th>Field</th>
            <th>Stage</th>
            <th>Capital</th>
            <th>Visits</th>
          </tr>
        </thead>
        <tbody>
          ${startups.map(s => `
            <tr>
              <td><strong>${s.name}</strong></td>
              <td>${s.field}</td>
              <td><span class="admin-badge badge-pending">${s.stage}</span></td>
              <td>${s.capital}</td>
              <td>${s.investor_visits || 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.innerHTML = html;
  } catch (err) { 
    console.error(err);
    container.innerHTML = '<p style="padding:2rem; color:var(--destructive);">Unexpected error loading startups.</p>';
  }
}

async function loadAdminEnrollments() {
  const container = $('#admin-enrollments-list');
  const filter = $('#admin-course-filter').value;
  container.innerHTML = '<p style="padding:1rem;">Loading enrollments...</p>';
  try {
    let q = supabase.from('course_enrollments').select('*').order('enrolled_at', { ascending: false });
    if (filter !== 'all') {
      q = q.eq('course_id', filter);
    }
    
    const { data: enrolls, error } = await q;
    
    if (error) {
      container.innerHTML = `<p style="padding:2rem; color:var(--destructive); text-align:center;">Access Denied: ${error.message}</p>`;
      return;
    }

    if (!enrolls || enrolls.length === 0) {
      container.innerHTML = '<p style="padding:2rem; text-align:center;">No enrollments found matching this filter.</p>';
      return;
    }

    let html = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Course</th>
            <th>Price</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${enrolls.map(e => `
            <tr>
              <td>${e.email}</td>
              <td>${e.course}</td>
              <td>$${e.price}</td>
              <td><span class="admin-badge badge-${e.payment_status === 'paid' ? 'active' : 'pending'}">${e.payment_status}</span></td>
              <td>${new Date(e.enrolled_at).toLocaleDateString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.innerHTML = html;
  } catch (err) { 
    console.error(err);
    container.innerHTML = '<p style="padding:2rem; color:var(--destructive);">Unexpected error loading enrollments.</p>';
  }
}

async function loadAdminTrainings() {
  const container = $('#admin-trainings-list');
  container.innerHTML = '<p style="padding:1rem;">Loading training registrations...</p>';
  try {
    const { data: regs, error } = await supabase.from('training_registrations').select('*').order('registered_at', { ascending: false });
    
    if (error) {
      container.innerHTML = `<p style="padding:2rem; color:var(--destructive); text-align:center;">Access Denied: ${error.message}</p>`;
      return;
    }

    if (!regs || regs.length === 0) {
      container.innerHTML = '<p style="padding:2rem; text-align:center;">No registrations found.</p>';
      return;
    }

    let html = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>WhatsApp</th>
            <th>Occupation</th>
            <th>Referral</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${regs.map(r => `
            <tr>
              <td>${r.first_name} ${r.last_name}</td>
              <td>${r.email}</td>
              <td style="font-family: monospace;">${r.phone_number || '-'}</td>
              <td>${r.occupation || '-'}</td>
              <td><span class="admin-badge badge-pending" style="background:rgba(99,102,241,0.1); color:var(--primary); border:none;">${r.referral_source || 'Direct'}</span></td>
              <td>${new Date(r.registered_at).toLocaleDateString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.innerHTML = html;
  } catch (err) { 
    console.error(err);
    container.innerHTML = '<p style="padding:2rem; color:var(--destructive);">Unexpected error loading trainings.</p>';
  }
}

async function loadAdminFinancials() {
  const container = $('#admin-financial-details');
  container.innerHTML = '<p style="padding:1rem;">Calculating financial reports...</p>';
  
  try {
    // 1. Fetch Course Revenue
    const { data: enrollments, error: eErr } = await supabase.from('course_enrollments').select('price, payment_status, course, email, enrolled_at').eq('payment_status', 'paid');
    
    // 2. Fetch Subscriptions (calculated from user tiers)
    const { data: users, error: uErr } = await supabase.from('users').select('subscription_tier, email, joined_at');

    if (eErr || uErr) throw eErr || uErr;

    let courseTotal = 0;
    enrollments.forEach(e => courseTotal += parseFloat(e.price || 0));

    let subTotal = 0;
    const tierPrices = { starter: 29, pro: 79, venture: 249 };
    const subBreakdown = [];
    
    users.forEach(u => {
      if (u.subscription_tier && tierPrices[u.subscription_tier]) {
        const price = tierPrices[u.subscription_tier];
        subTotal += price;
        subBreakdown.push({
          type: 'Subscription',
          source: `${u.subscription_tier.charAt(0).toUpperCase() + u.subscription_tier.slice(1)} Plan`,
          amount: price,
          user: u.email,
          date: u.joined_at
        });
      }
    });

    const totalRevenue = courseTotal + subTotal;

    // Update UI Stats
    $('#stat-total-revenue').textContent = `$${totalRevenue.toLocaleString()}`;
    $('#stat-revenue-courses').textContent = `$${courseTotal.toLocaleString()}`;
    $('#stat-revenue-subs').textContent = `$${subTotal.toLocaleString()}`;

    // Combine for details table
    const allRevenue = [
      ...enrollments.map(e => ({ type: 'Course', source: e.course, amount: e.price, user: e.email, date: e.enrolled_at })),
      ...subBreakdown
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Source</th>
            <th>User</th>
            <th>Amount</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${allRevenue.map(item => `
            <tr>
              <td><span class="admin-badge" style="background:${item.type === 'Course' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)'}; color:${item.type === 'Course' ? '#10b981' : 'var(--primary)'}; border:none;">${item.type}</span></td>
              <td>${item.source}</td>
              <td>${item.user}</td>
              <td><strong>$${item.amount}</strong></td>
              <td>${new Date(item.date).toLocaleDateString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.innerHTML = html;

  } catch (err) {
    console.error("Financial error:", err);
    container.innerHTML = '<p style="padding:2rem; color:var(--destructive);">Error generating financial reports.</p>';
  }
}


