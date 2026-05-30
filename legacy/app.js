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

// ---- Smart Client-Side Cache Manager ----
const clientCache = {
  docs: new Map(), // key: "table:id", value: { data, timestamp }
  queries: new Map(), // key: "table:queryJSON", value: { data, timestamp }
  TTL: 5 * 60 * 1000, // 5 minutes TTL

  setDoc(table, id, data) {
    this.docs.set(`${table}:${id}`, { data, timestamp: Date.now() });
    this.invalidateQueries(table);
  },

  getDoc(table, id) {
    const entry = this.docs.get(`${table}:${id}`);
    if (entry && (Date.now() - entry.timestamp) < this.TTL) {
      return entry.data;
    }
    return null;
  },

  setQuery(table, queryKey, data) {
    this.queries.set(`${table}:${queryKey}`, { data, timestamp: Date.now() });
  },

  getQuery(table, queryKey) {
    const entry = this.queries.get(`${table}:${queryKey}`);
    if (entry && (Date.now() - entry.timestamp) < this.TTL) {
      return entry.data;
    }
    return null;
  },

  invalidate(table, id) {
    this.docs.delete(`${table}:${id}`);
    this.invalidateQueries(table);
  },

  invalidateQueries(table) {
    for (const key of this.queries.keys()) {
      if (key.startsWith(`${table}:`)) {
        this.queries.delete(key);
      }
    }
  }
};

async function setDoc(docRef, payload) {
  const { table, id, startupId } = mapTableFromSegments(docRef.segments);
  const row = camelToSnakeObject(payload);
  if (startupId) row.startup_id = startupId;
  if (id) row.id = id;
  const { error } = await supabase.from(table).upsert(row);
  if (error) throw error;
  
  if (id) {
    clientCache.invalidate(table, id);
  } else {
    clientCache.invalidateQueries(table);
  }
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
  
  clientCache.invalidate(table, id);
}

async function getDoc(docRef) {
  const { table, id } = mapTableFromSegments(docRef.segments);
  if (id) {
    const cachedData = clientCache.getDoc(table, id);
    if (cachedData) {
      return {
        exists: () => true,
        data: () => cachedData
      };
    }
  }

  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;

  const mappedData = snakeToCamelObject(data);
  if (id && mappedData) {
    clientCache.setDoc(table, id, mappedData);
  }

  return {
    exists: () => !!data,
    data: () => mappedData
  };
}

async function addDoc(collectionRef, payload) {
  const { table, startupId } = mapTableFromSegments(collectionRef.segments);
  const row = camelToSnakeObject(payload);
  if (startupId) row.startup_id = startupId;
  const { data, error } = await supabase.from(table).insert(row).select("id").single();
  if (error) throw error;

  clientCache.invalidateQueries(table);
  return { id: data.id };
}

async function getDocs(refOrQuery) {
  const queryRef = refOrQuery.collectionRef ? refOrQuery : { collectionRef: refOrQuery, constraints: [] };
  const { table, startupId } = mapTableFromSegments(queryRef.collectionRef.segments);

  const queryKey = JSON.stringify({ startupId, constraints: queryRef.constraints });
  const cachedData = clientCache.getQuery(table, queryKey);
  if (cachedData) {
    return {
      empty: cachedData.length === 0,
      forEach: (cb) => cachedData.forEach((mapped) => {
        cb({ id: mapped.id, data: () => mapped });
      })
    };
  }

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
  const mappedRows = rows.map(row => snakeToCamelObject(row));

  clientCache.setQuery(table, queryKey, mappedRows);

  return {
    empty: mappedRows.length === 0,
    forEach: (cb) => mappedRows.forEach((mapped) => {
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
  hamburger.classList.toggle('active', menuOpen);
});

// Close mobile menu on link click
$$('.mobile-link').forEach(link => {
  link.addEventListener('click', () => {
    menuOpen = false;
    mobileMenu.classList.remove('open');
    hamburger.classList.remove('active');
  });
});

// Close menu on outside click
document.addEventListener('click', (e) => {
  if (menuOpen && !hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
    menuOpen = false;
    mobileMenu.classList.remove('open');
    hamburger.classList.remove('active');
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
  const landingPage = document.getElementById('landingPage');
  const webAppShell = document.getElementById('webAppShell');
  
  if (currentUserProfile) {
    if (landingPage) landingPage.style.display = 'none';
    if (webAppShell) {
      webAppShell.style.display = 'flex';
      
      const appAvatarTop = document.getElementById('appAvatarTop');
      if (appAvatarTop) appAvatarTop.textContent = currentUserProfile.firstName?.charAt(0).toUpperCase() || 'U';
      
      const isAdmin = currentUserProfile.role === 'admin';
      const adminSidebarGroup = document.getElementById('adminSidebarGroup');
      if (adminSidebarGroup) adminSidebarGroup.style.display = isAdmin ? 'block' : 'none';
      
      if (!window.currentAppView) {
        switchAppView('feed');
      }
    }
  } else {
    if (landingPage) landingPage.style.display = 'block';
    if (webAppShell) webAppShell.style.display = 'none';
    
    if (loginBtn) {
      loginBtn.textContent = 'Sign In';
      loginBtn.href = '#login';
      loginBtn.style.fontWeight = '500';
    }
    if (getStartedBtn) {
      getStartedBtn.textContent = 'Get Started';
      getStartedBtn.onclick = null;
      getStartedBtn.href = '#register';
    }
  }
}

window.switchAppView = function(viewId) {
  // Update sidebar active states
  document.querySelectorAll('.sidebar-item').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.sidebar-item[onclick="switchAppView('${viewId}')"]`);
  if (activeBtn) activeBtn.classList.add('active');

  window.currentAppView = viewId;

  // Mapping viewId to legacy dashboard tab IDs
  const tabMap = {
    'feed': 'dashOverview',
    'community': 'dashCommunityForum',
    'directory': 'dashDirectory',
    'courses': 'dashMarketCourses',
    'events': 'dashEvents',
    'messages': 'dashMessages',
    'audience': 'dashAudience'
  };

  const tabId = tabMap[viewId];
  
  // Update tabs dynamically by selecting children of appMainContent
  const mainTabs = document.getElementById('appMainContent')?.children;
  if (mainTabs) {
    let found = false;
    Array.from(mainTabs).forEach(tab => {
      if (tab.id) {
        if (tab.id === tabId) {
          tab.style.display = 'block';
          found = true;
        } else {
          tab.style.display = 'none';
        }
      }
    });

    // If the tab wasn't found, it might be a new feature (like events, messages)
    // We can inject a placeholder for now.
    if (!found && tabId) {
       let placeholder = document.getElementById(tabId);
       if (!placeholder) {
         placeholder = document.createElement('div');
         placeholder.id = tabId;
         placeholder.innerHTML = `<div class="dash-welcome"><div class="dash-welcome-text"><h1>${viewId.charAt(0).toUpperCase() + viewId.slice(1)}</h1><p>This feature is being rolled out.</p></div></div>`;
         document.getElementById('appMainContent').appendChild(placeholder);
       }
       placeholder.style.display = 'block';
    }
  }

  // Load community spaces if community is active
  if (viewId === 'community' && window.loadCommunitySpaces) {
    window.loadCommunitySpaces();
  }
  
  if (viewId === 'messages' && window.loadDirectMessageThreads) {
    window.loadDirectMessageThreads();
  }
  
  if (viewId === 'events' && window.loadEvents) {
    window.loadEvents();
  }
  
  if (viewId === 'audience' && window.loadAudience) {
    window.loadAudience();
  }
  
  if (viewId === 'feed' && window.loadFeed) {
    window.loadFeed();
  }
};

window.renderAppView = function(viewId) {
  // Legacy: Populate all tabs into appMainContent once
  const appMain = document.getElementById('appMainContent');
  if (appMain && appMain.children.length === 0) {
    if (window.populateDashboard) window.populateDashboard().then(() => {
       switchAppView(viewId);
    });
  } else {
    switchAppView(viewId);
  }
};

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
    const hasNum = /[0-9]/.test(pass);
    const hasSpec = /[^A-Za-z0-9]/.test(pass);
    if (pass.length < 8 || !hasNum || !hasSpec) {
      showToast('Password must be at least 8 characters and contain at least 1 number and 1 special character.', 'error');
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

// $('#loginBtn').addEventListener('click', (e) => {
//   // Link handled by HTML href
// });

// $('#getStartedBtn').addEventListener('click', (e) => {
//   // Link handled by HTML href
// });

// // CTA buttons → register
// $$('a[href="#register"]').forEach(btn => {
//   // Link handled by HTML href
// });
// $$('a[href="#login"]').forEach(btn => {
//   // Link handled by HTML href
// });

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
  const hasNum = /[0-9]/.test(password);
  const hasSpec = /[^A-Za-z0-9]/.test(password);
  if (password.length < 8 || !hasNum || !hasSpec) {
    showToast('Password must be at least 8 characters and contain at least 1 number and 1 special character.', 'error');
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

  if (tabId === 'dashCommunityForum') {
    if (window.loadCommunitySpaces) window.loadCommunitySpaces();
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

const startupProfileViewPageHTML = `
      <!-- STARTUP PROFILE VIEW (PAGE) -->
      <div id="dashStartupProfileView" style="display:none;">
        <div class="dash-welcome" style="display:flex; justify-content:space-between; align-items:center;">
          <div class="dash-welcome-text">
            <h1 id="spPageName">Startup Name</h1>
            <p id="spPageField">Industry / Field</p>
          </div>
          <button onclick="window.goBackFromProfileView()" class="btn btn-outline" style="font-size:0.8rem; padding:0.4rem 0.875rem;">
            &larr; Back
          </button>
        </div>
        
        <div class="dash-grid wide" style="display:grid; grid-template-columns: 250px 1fr; gap:2rem; margin-top:2rem;">
          <!-- Left Column: Media & Quick Actions -->
          <div class="dash-panel" style="display:flex; flex-direction:column; align-items:center; gap:1.5rem; text-align:center; padding:2rem;">
            <div id="spPageImageContainer" style="width:140px; height:140px; border-radius:50%; background:var(--muted); overflow:hidden; display:flex; align-items:center; justify-content:center; border:3px solid var(--border); position:relative; box-shadow:var(--shadow-sm);">
              <img id="spPageImg" src="" alt="Startup Logo" style="width: 100%; height: 100%; object-fit: cover; display: none;" />
              <svg id="spPagePlaceholder" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted-fg)"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            </div>
            
            <div id="spPagePhotoUploadSection" style="display:none; margin-top:0.5rem;">
              <label for="spPagePhotoUpload" class="btn btn-outline btn-sm" style="cursor:pointer; font-size:0.75rem; padding:0.25rem 0.5rem;">
                Change Photo
              </label>
              <input type="file" id="spPagePhotoUpload" accept="image/*" style="display:none;" onchange="handleStartupPhotoUploadPage(event)" />
            </div>
            
            <a href="#" id="spPageWebsite" target="_blank" class="btn btn-outline w-full" style="justify-content:center; margin-top:1rem; font-size:0.85rem;">Visit Website</a>
          </div>
          
          <!-- Right Column: Details -->
          <div class="dash-panel" style="display:flex; flex-direction:column; gap:1.5rem; padding:2rem;">
            <div class="dash-panel-header" style="border-bottom:1px solid var(--border); padding-bottom:1rem; margin-bottom:0.5rem;">
              <span class="dash-panel-title" style="font-size:1.1rem; font-weight:700;">Startup Specifications</span>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
              <div>
                <span style="font-size:0.75rem; color:var(--muted-fg); display:block; margin-bottom:0.25rem; text-transform:uppercase; letter-spacing:0.5px;">Current Stage</span>
                <span style="font-weight:600; font-size:1rem;" id="spPageStage">-</span>
              </div>
              <div>
                <span style="font-size:0.75rem; color:var(--muted-fg); display:block; margin-bottom:0.25rem; text-transform:uppercase; letter-spacing:0.5px;">Capital Raised</span>
                <span style="font-weight:600; font-size:1rem;" id="spPageCapital">-</span>
              </div>
              <div>
                <span style="font-size:0.75rem; color:var(--muted-fg); display:block; margin-bottom:0.25rem; text-transform:uppercase; letter-spacing:0.5px;">Employees</span>
                <span style="font-weight:600; font-size:1rem;" id="spPageEmployees">-</span>
              </div>
              <div>
                <span style="font-size:0.75rem; color:var(--muted-fg); display:block; margin-bottom:0.25rem; text-transform:uppercase; letter-spacing:0.5px;">Year Founded</span>
                <span style="font-weight:600; font-size:1rem;" id="spPageYear">-</span>
              </div>
            </div>
            
            <div style="border-top:1px solid var(--border); padding-top:1.5rem; margin-top:0.5rem;">
              <h4 style="margin-bottom:0.75rem; font-weight:700;">Pitch & Description</h4>
              <p style="color:var(--muted-fg); line-height:1.6; font-size:0.9rem; white-space:pre-wrap;" id="spPageDescription">-</p>
            </div>
          </div>
        </div>
      </div>
`;

window.goBackFromProfileView = function() {
  const isFounder = currentUserProfile && currentUserProfile.role === 'founder';
  if (isFounder) {
    const overviewBtn = document.querySelector('button[onclick*="dashOverview"]');
    dashTabSwitch(overviewBtn, 'dashOverview');
  } else {
    const dirBtn = document.querySelector('button[onclick*="dashDirectory"]');
    dashTabSwitch(dirBtn, 'dashDirectory');
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
  const main = $('#appMainContent');

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
      <div id="dashCommunityForum" style="display:none; height:100%; padding-top: 1rem;">
        ${(p.subscriptionStatus === 'active' || p.subscriptionTier) ? `
          <div class="community-layout">
            <aside class="community-sidebar">
              <div class="community-spaces-title">Spaces</div>
              <div id="communitySpacesList">Loading spaces...</div>
            </aside>
            <main class="community-main">
              <div class="community-header">
                <h2 id="communityCurrentSpaceName">Loading...</h2>
                <button class="btn btn-primary" onclick="openCreatePostModal()">New Post</button>
              </div>
              <div id="communityPostsFeed">Loading posts...</div>
            </main>
          </div>
        ` : `
          <div class="dash-panel" style="align-items:center; padding:4rem; text-align:center;">
            <div style="font-size:3rem; margin-bottom:1.5rem;">🔒</div>
            <h3 style="font-size:1.5rem; font-weight:700; margin-bottom:1rem;">Subscription Required</h3>
            <p style="color:var(--muted-fg); font-size:1rem; max-width:450px; margin:0 auto 2rem;">
              The Community Platform is exclusive to our Starter, Pro, and Venture members. 
              Join the conversation to connect with top-tier founders and investors.
            </p>
            <a href="#pricing" onclick="closeDashboard()" class="btn btn-primary">View Plans & Subscribe</a>
          </div>
        `}
      </div>
      ${startupProfileViewPageHTML}
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
      <div id="dashCommunityForum" style="display:none; height:100%; padding-top: 1rem;">
        ${(p.subscriptionStatus === 'active' || p.subscriptionTier) ? `
          <div class="community-layout">
            <aside class="community-sidebar">
              <div class="community-spaces-title">Spaces</div>
              <div id="communitySpacesList2">Loading spaces...</div>
            </aside>
            <main class="community-main">
              <div class="community-header">
                <h2 id="communityCurrentSpaceName2">Loading...</h2>
                <button class="btn btn-primary" onclick="openCreatePostModal()">New Post</button>
              </div>
              <div id="communityPostsFeed2">Loading posts...</div>
            </main>
          </div>
        ` : `
          <div class="dash-panel" style="align-items:center; padding:4rem; text-align:center;">
            <div style="font-size:3rem; margin-bottom:1.5rem;">🔒</div>
            <h3 style="font-size:1.5rem; font-weight:700; margin-bottom:1rem;">Subscription Required</h3>
            <p style="color:var(--muted-fg); font-size:1rem; max-width:450px; margin:0 auto 2rem;">
              The Community Platform is exclusive to our Starter, Pro, and Venture members. 
              Join the conversation to connect with top-tier founders and investors.
            </p>
            <a href="#pricing" onclick="closeDashboard()" class="btn btn-primary">View Plans & Subscribe</a>
          </div>
        `}
      </div>
      ${startupProfileViewPageHTML}
    `;
  main.innerHTML += `
    <!-- FEED -->
    <div id="dashFeed" style="display:none; padding: 2rem; max-width: 800px; margin: 0 auto;">
      <div class="dash-welcome" style="margin-bottom: 2rem;">
        <div class="dash-welcome-text">
          <h1>Feed</h1>
          <p>See what's happening across the Investraders community.</p>
        </div>
      </div>
      
      <!-- Create Post Box -->
      <div class="dash-panel" style="margin-bottom: 2rem; padding: 1.5rem;">
        <div style="display:flex; gap:1rem;">
          <div class="app-avatar" id="feedUserAvatar" style="flex-shrink:0;">U</div>
          <div style="flex:1;">
            <textarea id="feedPostInput" placeholder="Start a post..." style="width:100%; border:none; outline:none; background:transparent; resize:none; font-family:inherit; font-size:1rem; min-height:60px; color:var(--foreground);"></textarea>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px solid var(--border); padding-top: 1rem; margin-top: 1rem;">
          <div style="display:flex; gap: 1rem;">
            <button class="btn btn-ghost" style="padding:0.4rem 0.8rem; color:var(--muted-fg);" onclick="alert('Media upload coming soon!')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:0.4rem; vertical-align:middle;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              Media
            </button>
          </div>
          <button class="btn btn-primary" onclick="handleFeedPostSubmit()">Post</button>
        </div>
      </div>
      
      <!-- Feed Posts Area -->
      <div id="feedPostsArea">
        <div style="text-align:center; padding:3rem; color:var(--muted-fg);">Loading feed...</div>
      </div>
    </div>
    
    <!-- DIRECT MESSAGES -->
    <div id="dashMessages" style="display:none; height:100%;">
      <div style="display:flex; height:100%; width:100%;">
        <div style="width: 320px; border-right: 1px solid var(--border); background: var(--background); display:flex; flex-direction:column;">
          <div style="padding: 1.5rem; border-bottom: 1px solid var(--border);">
            <div class="app-search" style="width:100%;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Search messages..." style="outline:none;background:transparent;border:none;width:100%;" />
            </div>
          </div>
          <div style="flex:1; overflow-y:auto;" id="chatThreadsList">
            <div style="padding:1.5rem; text-align:center; color:var(--muted-fg);">Loading conversations...</div>
          </div>
        </div>
        <div style="flex:1; display:flex; flex-direction:column; background: var(--card);">
          <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display:flex; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap: 1rem;">
              <div class="app-avatar" id="activeChatAvatar" style="display:none;"></div>
              <div>
                <h3 id="activeChatName" style="font-weight:600; margin:0;">Select a conversation</h3>
                <p id="activeChatRole" style="font-size:0.8rem; color:var(--muted-fg); margin:0;"></p>
              </div>
            </div>
            <button class="btn btn-outline" style="padding:0.4rem 0.8rem; font-size:0.8rem;">View Profile</button>
          </div>
          <div style="flex:1; overflow-y:auto; padding: 1.5rem; display:flex; flex-direction:column; gap:1rem;" id="chatMessagesArea">
            <div style="text-align:center; color:var(--muted-fg); margin:auto;">Click a conversation on the left to start chatting.</div>
          </div>
          <div style="padding: 1.5rem; border-top: 1px solid var(--border); background: var(--background);">
            <form onsubmit="handleSendDM(event)" style="display:flex; gap:1rem; align-items:center;">
              <input type="text" id="chatMessageInput" placeholder="Write a message..." style="flex:1; padding:1rem; border:1px solid var(--border); border-radius:99px; background:var(--card); color:var(--foreground);" disabled />
              <button type="submit" class="btn btn-primary" style="border-radius:99px; padding: 0.8rem 1.5rem;" id="chatSendBtn" disabled>Send</button>
            </form>
          </div>
        </div>
      </div>
    </div>
    
    <!-- EVENTS -->
    <div id="dashEvents" style="display:none;">
      <div class="dash-welcome"><div class="dash-welcome-text"><h1>Events & Live Rooms</h1><p>Join live masterclasses, AMAs, and networking sessions.</p></div></div>
      <div id="eventsBannerArea" style="margin-top: 2rem;"></div>
      <div class="dash-grid wide" style="margin-top: 2rem;">
        <div class="dash-panel" style="width:100%;">
           <div class="dash-panel-header" style="display:flex; justify-content:space-between; width:100%;">
             <span class="dash-panel-title">Upcoming Schedule</span>
             <button class="btn btn-outline" style="font-size:0.8rem; padding:0.4rem 0.8rem; display:none;" id="adminCreateEventBtn" onclick="openCreateEventModal()">+ Create Event</button>
           </div>
           <div id="eventsListArea" class="dash-info-list">
             <div style="padding:2rem; text-align:center; color:var(--muted-fg);">Loading events...</div>
           </div>
        </div>
      </div>
    </div>
    
    <!-- AUDIENCE (CRM) -->
    <div id="dashAudience" style="display:none; padding:2rem;">
      <div class="dash-welcome"><div class="dash-welcome-text"><h1>Manage Audience</h1><p>Admin control center for users and segments.</p></div></div>
      <div class="dash-panel" style="margin-top:2rem;">
        <div class="dash-panel-header" style="border-bottom: 1px solid var(--border); padding-bottom:1rem; margin-bottom:1rem; display:flex; justify-content:space-between;">
           <div style="display:flex; gap:2rem;">
             <span style="font-weight:600; border-bottom:2px solid var(--primary); padding-bottom:1rem; margin-bottom:-1rem;">All Members</span>
           </div>
        </div>
        <table style="width:100%; border-collapse: collapse; text-align:left;">
          <thead>
            <tr style="border-bottom:1px solid var(--border); color:var(--muted-fg); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em;">
              <th style="padding:1rem;">Name</th>
              <th style="padding:1rem;">Role</th>
              <th style="padding:1rem;">Joined</th>
            </tr>
          </thead>
          <tbody id="audienceTableBody">
            <tr><td colspan="3" style="padding:2rem; text-align:center;">Loading audience data...</td></tr>
          </tbody>
        </table>
      </div>
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
        : `<button onclick="openEnrollModal('${courseId}', '${c.title}', ${c.price}, 'https://paypal.me/CobraAhmed/150', '')" class="btn btn-primary">Enroll Now — $150</button>`;

      html += `
        <div class="dash-panel" style="display:flex;flex-direction:column;gap:1.5rem;padding:2rem;margin-bottom:1rem;border-radius:1rem;border:1px solid var(--border);background:var(--card);">
          <div style="display:flex;flex-direction:row;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;">
            <div style="flex:1;min-width:280px;">
              <h3 style="font-size:1.2rem;font-weight:800;margin-bottom:0.5rem;color:var(--foreground);">${c.title}</h3>
              <p style="color:var(--muted-fg);font-size:0.9rem;line-height:1.6;max-width:600px;">${c.description}</p>
            </div>
            <div style="background:var(--muted);padding:1rem;border-radius:0.75rem;border:1px solid var(--border);min-width:220px;">
              <div style="margin-bottom:0.5rem;font-size:0.85rem;color:var(--muted-fg);font-weight:600;">Next Cohort:</div>
              <div style="font-weight:700;color:var(--foreground);margin-bottom:1rem;">June 3rd, 19:00 KSA</div>
              
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
                <span style="text-decoration:line-through;color:var(--muted-fg);font-weight:700;font-size:1rem;">$300</span>
                <span style="font-weight:900;color:var(--primary);font-size:1.5rem;display:flex;align-items:center;">$150 <span style="font-size:0.7rem;font-weight:800;background:var(--accent);color:var(--foreground);padding:0.15rem 0.4rem;border-radius:4px;margin-left:0.4rem;">50% OFF</span></span>
              </div>
              
              ${buttonHtml}
            </div>
          </div>
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

let currentViewedStartupId = null;

window.viewStartupProfile = async function(startupId) {
  try {
    const docSnap = await getDoc(doc(db, "startups", startupId));
    if (!docSnap.exists()) {
      showToast('Startup not found', 'error');
      return;
    }
    const s = docSnap.data();
    currentViewedStartupId = startupId; // Keep track for photo upload

    // Log the visit if the viewer is not the startup owner
    const isOwner = auth.currentUser && auth.currentUser.uid === s.ownerUid;
    if (!isOwner) {
      logStartupVisit(startupId);
      // Locally increment visits count so UI updates instantly
      s.investorVisits = (s.investorVisits || 0) + 1;
    }

    // Populate the page
    const qs = (sel) => document.querySelector(sel);
    if(qs('#spPageName')) qs('#spPageName').textContent = s.name;
    if(qs('#spPageField')) qs('#spPageField').textContent = s.field;
    if(qs('#spPageStage')) qs('#spPageStage').textContent = s.stage;
    if(qs('#spPageCapital')) qs('#spPageCapital').textContent = s.capital;
    if(qs('#spPageEmployees')) qs('#spPageEmployees').textContent = s.employees;
    if(qs('#spPageYear')) qs('#spPageYear').textContent = s.year;
    if(qs('#spPageDescription')) qs('#spPageDescription').textContent = s.description;
    
    if (s.website) {
      if(qs('#spPageWebsite')) {
        qs('#spPageWebsite').href = s.website.startsWith('http') ? s.website : `https://${s.website}`;
        qs('#spPageWebsite').style.display = 'flex';
      }
    } else {
      if(qs('#spPageWebsite')) qs('#spPageWebsite').style.display = 'none';
    }

    // Handle photo
    const img = qs('#spPageImg');
    const placeholder = qs('#spPagePlaceholder');
    if (s.photoUrl || s.photo_url) {
      const pUrl = s.photoUrl || s.photo_url;
      if(img) { img.src = pUrl; img.style.display = 'block'; }
      if(placeholder) placeholder.style.display = 'none';
    } else {
      if(img) { img.src = ''; img.style.display = 'none'; }
      if(placeholder) placeholder.style.display = 'block';
    }

    // Handle upload button visibility
    if(qs('#spPagePhotoUploadSection')) qs('#spPagePhotoUploadSection').style.display = isOwner ? 'block' : 'none';

    // Show the page
    dashTabSwitch(null, 'dashStartupProfileView');
  } catch(err) {
    console.error("Error fetching profile:", err);
    showToast('Failed to load profile', 'error');
  }
};

window.handleStartupPhotoUploadPage = async function(event) {
  const file = event.target.files[0];
  if (!file || !currentViewedStartupId) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const dataUrl = e.target.result;
    
    // Resize/compress the image before saving
    const img = new Image();
    img.onload = async function() {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 400;
      const MAX_HEIGHT = 400;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);

      try {
        await updateDoc(doc(db, "startups", currentViewedStartupId), {
          photo_url: compressedDataUrl
        });
        
        const qs = (sel) => document.querySelector(sel);
        if(qs('#spPageImg')) {
          qs('#spPageImg').src = compressedDataUrl;
          qs('#spPageImg').style.display = 'block';
        }
        if(qs('#spPagePlaceholder')) qs('#spPagePlaceholder').style.display = 'none';
        
        showToast('Photo updated successfully!', 'success');
      } catch (err) {
        console.error("Error updating photo:", err);
        showToast('Failed to update photo', 'error');
      }
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
};

// ---- Analytics: Log Visit ----
window.logStartupVisit = async function(startupId) {
  if (!currentUserProfile) return;

  const uid = auth.currentUser?.uid;
  if (!uid) return;

  try {
    // Use auto-generated DB ID
    await addDoc(collection(db, "startups", startupId, "visits"), {
      visitorUid: uid,
      visitorName: `${currentUserProfile.firstName} ${currentUserProfile.lastName}`,
      visitorFund: currentUserProfile.investorFund || currentUserProfile.role || 'Visitor',
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
              <button onclick="viewStartupProfile('${docSnap.id}')" class="btn btn-outline btn-sm">View Profile</button>
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

let currentCommunitySpaceId = null;
let currentCommunityPostId = null;

window.loadCommunitySpaces = async function() {
  const container = document.getElementById('communitySpacesList');
  const container2 = document.getElementById('communitySpacesList2');
  if (!container && !container2) return;
  
  try {
    const { data: spaces, error } = await supabase
      .from('community_spaces')
      .select('*')
      .order('order_idx', { ascending: true });
      
    if (error) throw error;
    
    if (!spaces || spaces.length === 0) return;
    
    const renderSpaces = (spacesData) => spacesData.map(s => `
      <div class="community-space-item ${s.id === currentCommunitySpaceId ? 'active' : ''}" onclick="selectCommunitySpace('${s.id}', '${s.name}')">
        <span>${s.icon || '💬'}</span>
        <span>${s.name}</span>
      </div>
    `).join('');

    if (container) container.innerHTML = renderSpaces(spaces);
    if (container2) container2.innerHTML = renderSpaces(spaces);
    
    // Select first space by default if none selected
    if (!currentCommunitySpaceId && spaces.length > 0) {
      selectCommunitySpace(spaces[0].id, spaces[0].name);
    }
  } catch (err) {
    console.error("Error loading community spaces:", err);
  }
};

window.selectCommunitySpace = function(spaceId, spaceName) {
  currentCommunitySpaceId = spaceId;
  const name1 = document.getElementById('communityCurrentSpaceName');
  const name2 = document.getElementById('communityCurrentSpaceName2');
  if (name1) name1.textContent = spaceName;
  if (name2) name2.textContent = spaceName;
  
  // Re-render spaces to show active state
  loadCommunitySpaces();
  loadSpacePosts(spaceId);
};

window.loadSpacePosts = async function(spaceId) {
  const container = document.getElementById('communityPostsFeed');
  const container2 = document.getElementById('communityPostsFeed2');
  if (container) container.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--muted-fg);">Loading posts...</div>';
  if (container2) container2.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--muted-fg);">Loading posts...</div>';
  
  try {
    const { data: posts, error } = await supabase
      .from('community_posts')
      .select('*, community_comments(count), community_reactions(*)')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    const renderFeed = (postsData) => {
      if (!postsData || postsData.length === 0) {
        return '<div class="dash-panel" style="padding:4rem; text-align:center; color:var(--muted-fg);">No posts yet. Be the first!</div>';
      }
      return postsData.map(post => `
        <div class="post-card" onclick="openPostDetails('${post.id}')">
          <div class="post-header">
            <div class="post-avatar">${(post.user_name || '?').charAt(0).toUpperCase()}</div>
            <div class="post-meta">
              <div class="post-author">${post.user_name} <span class="post-author-role">${post.user_role}</span></div>
              <div class="post-time">${new Date(post.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
            </div>
          </div>
          ${post.title ? `<h3 style="font-weight:700; font-size:1.1rem; margin-top:0.5rem;">${post.title}</h3>` : ''}
          <div class="post-content" style="display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${post.content}</div>
          ${post.media_url ? `
            <div class="post-media" style="max-height:200px;">
              <img src="${post.media_url}" alt="Post media">
            </div>
          ` : ''}
          <div class="post-footer" onclick="event.stopPropagation()">
            <button class="reaction-btn" onclick="toggleReaction('post', '${post.id}', '👍')">👍 ${post.community_reactions.filter(r => r.emoji === '👍').length || ''}</button>
            <button class="reaction-btn" onclick="toggleReaction('post', '${post.id}', '❤️')">❤️ ${post.community_reactions.filter(r => r.emoji === '❤️').length || ''}</button>
            <button class="comment-btn" onclick="openPostDetails('${post.id}')">💬 ${post.community_comments[0]?.count || 0} Comments</button>
          </div>
        </div>
      `).join('');
    };

    if (container) container.innerHTML = renderFeed(posts);
    if (container2) container2.innerHTML = renderFeed(posts);
  } catch (err) {
    console.error("Error loading posts:", err);
    const errHtml = '<div class="dash-panel" style="padding:2rem; text-align:center; color:var(--destructive);">Failed to load posts.</div>';
    if (container) container.innerHTML = errHtml;
    if (container2) container2.innerHTML = errHtml;
  }
};

window.openCreatePostModal = function() {
  if (!currentUserProfile) {
    showToast('Please sign in to post.', 'error');
    return;
  }
  document.getElementById('createPostModal').style.display = 'flex';
};

window.closeCreatePostModal = function() {
  document.getElementById('createPostModal').style.display = 'none';
  document.getElementById('postTitleInput').value = '';
  document.getElementById('postContentInput').value = '';
  document.getElementById('postMediaInput').value = '';
};

window.handleCommunityPostSubmit = async function(e) {
  e.preventDefault();
  if (!currentCommunitySpaceId) return showToast('Please select a space first.', 'error');
  
  const title = document.getElementById('postTitleInput').value.trim();
  const content = document.getElementById('postContentInput').value.trim();
  const fileInput = document.getElementById('postMediaInput');
  const btn = document.getElementById('postSubmitBtn');
  
  if (!content) return;
  
  btn.disabled = true;
  btn.textContent = 'Posting...';
  
  try {
    let mediaUrl = null;
    if (fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${currentUserProfile.uid}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('community_media')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      const { data: publicUrlData } = supabase.storage
        .from('community_media')
        .getPublicUrl(filePath);
        
      mediaUrl = publicUrlData.publicUrl;
    }
    
    const { error } = await supabase.from('community_posts').insert({
      space_id: currentCommunitySpaceId,
      user_id: currentUserProfile.uid,
      user_name: `${currentUserProfile.firstName} ${currentUserProfile.lastName}`,
      user_role: currentUserProfile.role,
      title: title || null,
      content: content,
      media_url: mediaUrl
    });
    
    if (error) throw error;
    
    closeCreatePostModal();
    showToast('Post created successfully!', 'success');
    loadSpacePosts(currentCommunitySpaceId);
  } catch (err) {
    console.error("Error creating post:", err);
    showToast('Error creating post: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post';
  }
};

window.openPostDetails = async function(postId) {
  currentCommunityPostId = postId;
  const modal = document.getElementById('postDetailModal');
  modal.classList.add('open');
  
  document.getElementById('detailPostAuthor').innerHTML = 'Loading...';
  document.getElementById('detailPostTitle').textContent = '';
  document.getElementById('detailPostContent').innerHTML = '';
  document.getElementById('detailPostMedia').style.display = 'none';
  document.getElementById('detailCommentThread').innerHTML = '<div style="text-align:center; padding:2rem;">Loading comments...</div>';
  
  try {
    const { data: post, error } = await supabase
      .from('community_posts')
      .select('*, community_comments(*)')
      .eq('id', postId)
      .single();
      
    if (error) throw error;
    
    document.getElementById('detailPostAuthor').innerHTML = `<div class="post-avatar">${post.user_name.charAt(0).toUpperCase()}</div> ${post.user_name} <span class="post-author-role">${post.user_role}</span>`;
    document.getElementById('detailPostTitle').textContent = post.title || '';
    document.getElementById('detailPostContent').textContent = post.content;
    
    if (post.media_url) {
      document.getElementById('detailPostMedia').innerHTML = `<img src="${post.media_url}" alt="Media">`;
      document.getElementById('detailPostMedia').style.display = 'block';
    }
    
    const comments = post.community_comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    document.getElementById('detailCommentThread').innerHTML = comments.length > 0 ? comments.map(c => `
      <div class="comment-item">
        <div class="comment-avatar">${c.user_name.charAt(0).toUpperCase()}</div>
        <div class="comment-body">
          <div class="comment-author">${c.user_name} <span style="font-size:0.7rem; color:var(--muted-fg); font-weight:normal;">${new Date(c.created_at).toLocaleString()}</span></div>
          <div class="comment-text">${c.content}</div>
        </div>
      </div>
    `).join('') : '<div style="color:var(--muted-fg); font-size:0.9rem;">No comments yet.</div>';
    
  } catch (err) {
    console.error("Error loading post details:", err);
    showToast('Failed to load post.', 'error');
    closePostDetailModal();
  }
};

window.closePostDetailModal = function() {
  document.getElementById('postDetailModal').classList.remove('open');
  currentCommunityPostId = null;
};

window.handleCommunityCommentSubmit = async function() {
  if (!currentCommunityPostId) return;
  const input = document.getElementById('commentInput');
  const content = input.value.trim();
  if (!content) return;
  
  if (!currentUserProfile) {
    showToast('Please sign in to comment.', 'error');
    return;
  }
  
  try {
    const { error } = await supabase.from('community_comments').insert({
      post_id: currentCommunityPostId,
      user_id: currentUserProfile.uid,
      user_name: `${currentUserProfile.firstName} ${currentUserProfile.lastName}`,
      user_role: currentUserProfile.role,
      content: content
    });
    
    if (error) throw error;
    
    input.value = '';
    openPostDetails(currentCommunityPostId);
    if (currentCommunitySpaceId) loadSpacePosts(currentCommunitySpaceId);
  } catch (err) {
    console.error("Error posting comment:", err);
    showToast('Error posting comment.', 'error');
  }
};

window.toggleReaction = async function(entityType, entityId, emoji) {
  if (!currentUserProfile) return showToast('Please sign in to react.', 'error');
  
  try {
    const query = supabase
      .from('community_reactions')
      .select('id')
      .eq('user_id', currentUserProfile.uid)
      .eq('emoji', emoji);
      
    if (entityType === 'post') {
      query.eq('post_id', entityId);
    } else {
      query.eq('comment_id', entityId);
    }
    
    const { data: existing } = await query.single();
      
    if (existing) {
      await supabase.from('community_reactions').delete().eq('id', existing.id);
    } else {
      const insertData = {
        user_id: currentUserProfile.uid,
        emoji: emoji
      };
      if (entityType === 'post') insertData.post_id = entityId;
      else insertData.comment_id = entityId;
      
      await supabase.from('community_reactions').insert(insertData);
    }
    
    if (currentCommunitySpaceId) loadSpacePosts(currentCommunitySpaceId);
  } catch (err) {
    console.error("Error toggling reaction:", err);
  }
};

window.handleContactSubmit = async function(e) {
  e.preventDefault();
  const name = $('#contactName').value.trim();
  const email = $('#contactEmail').value.trim();
  const message = $('#contactMessage').value.trim();

  if (!name || !email || !message) {
    showToast('Please fill in all fields.', 'error');
    return;
  }

  const submitBtn = $('#contactSubmitBtn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const { error } = await supabase
      .from('contact_messages')
      .insert([{ name, email, message }]);

    if (error) throw error;
    
    showToast('Your message has been sent successfully!', 'success');
    e.target.reset();
  } catch (err) {
    console.error('Contact error:', err);
    showToast('Failed to send message. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
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
  if (!currentUserProfile || currentUserProfile.role !== 'admin') {
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
  if (tabId === 'messages') loadAdminMessages();
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

async function loadAdminMessages() {
  const container = $('#admin-messages-list');
  container.innerHTML = '<p style="padding:1rem;">Loading messages...</p>';
  try {
    const { data: messages, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      container.innerHTML = `<p style="padding:2rem; color:var(--destructive); text-align:center;">Access Denied: ${error.message}</p>`;
      return;
    }

    if (!messages || messages.length === 0) {
      container.innerHTML = '<p style="padding:2rem; text-align:center;">No contact messages found.</p>';
      return;
    }

    let html = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Email</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          ${messages.map(m => `
            <tr>
              <td>${new Date(m.created_at).toLocaleString()}</td>
              <td><strong>${m.name}</strong></td>
              <td><a href="mailto:${m.email}" style="color: var(--primary); text-decoration: underline;">${m.email}</a></td>
              <td style="max-width: 400px; white-space: pre-wrap; word-break: break-word;">${m.message}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.innerHTML = html;
  } catch (err) {
    console.error("Messages load error:", err);
    container.innerHTML = '<p style="padding:2rem; color:var(--destructive);">Unexpected error loading messages.</p>';
  }
}

// ======================================================================
// DIRECT MESSAGING (CHAT) LOGIC
// ======================================================================

window.currentActiveThreadId = null;
let chatMessagesSubscription = null;

window.loadDirectMessageThreads = async function() {
  if (!currentUserProfile) return;
  
  const threadsList = document.getElementById('chatThreadsList');
  if (!threadsList) return;
  
  try {
    const { data: myParticipations, error: pErr } = await supabase
      .from('chat_thread_participants')
      .select('thread_id')
      .eq('user_id', currentUserProfile.uid);
      
    if (pErr) throw pErr;
    
    if (!myParticipations || myParticipations.length === 0) {
      threadsList.innerHTML = '<div style="padding:1.5rem; text-align:center; color:var(--muted-fg);">No conversations yet.</div>';
      return;
    }
    
    const threadIds = myParticipations.map(p => p.thread_id);
    
    const { data: otherParticipants, error: opErr } = await supabase
      .from('chat_thread_participants')
      .select('thread_id, user_id')
      .in('thread_id', threadIds)
      .neq('user_id', currentUserProfile.uid);
      
    if (opErr) throw opErr;
    
    const otherUserIds = otherParticipants.map(op => op.user_id);
    
    let otherUsers = [];
    if (otherUserIds.length > 0) {
      const { data: users, error: uErr } = await supabase
        .from('users')
        .select('id, first_name, last_name, role')
        .in('id', otherUserIds);
        
      if (uErr) throw uErr;
      otherUsers = users;
    }
    
    let html = '';
    const threadsMap = {};
    for (const op of otherParticipants) {
      const user = otherUsers.find(u => u.id === op.user_id);
      if (user) {
        threadsMap[op.thread_id] = user;
      }
    }
    
    for (const threadId of threadIds) {
      const otherUser = threadsMap[threadId];
      if (!otherUser) continue;
      
      const avatarStr = otherUser.first_name ? otherUser.first_name.charAt(0).toUpperCase() : 'U';
      const nameStr = `${otherUser.first_name || 'User'} ${otherUser.last_name || ''}`;
      
      html += `
        <div class="chat-thread-item" onclick="openDirectMessageThread('${threadId}', '${otherUser.id}', '${nameStr.replace(/'/g, "\\'")}', '${otherUser.role}')" style="display:flex; align-items:center; gap:1rem; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); cursor:pointer; transition:background 0.2s;">
          <div class="app-avatar">${avatarStr}</div>
          <div>
            <div style="font-weight:600; font-size:0.95rem; color:var(--foreground);">${nameStr}</div>
            <div style="font-size:0.8rem; color:var(--muted-fg); text-transform:capitalize;">${otherUser.role || 'Member'}</div>
          </div>
        </div>
      `;
    }
    
    threadsList.innerHTML = html || '<div style="padding:1.5rem; text-align:center; color:var(--muted-fg);">No active conversations.</div>';
    
  } catch (err) {
    console.error("Error loading DM threads:", err);
    threadsList.innerHTML = '<div style="padding:1.5rem; text-align:center; color:red;">Failed to load messages.</div>';
  }
};

window.openDirectMessageThread = async function(threadId, otherUserId, nameStr, roleStr) {
  window.currentActiveThreadId = threadId;
  
  // Update header
  const nameEl = document.getElementById('activeChatName');
  const roleEl = document.getElementById('activeChatRole');
  const avatarEl = document.getElementById('activeChatAvatar');
  const inputEl = document.getElementById('chatMessageInput');
  const sendBtn = document.getElementById('chatSendBtn');
  
  if (nameEl) nameEl.textContent = nameStr;
  if (roleEl) roleEl.textContent = roleStr;
  if (avatarEl) {
    avatarEl.style.display = 'flex';
    avatarEl.textContent = nameStr.charAt(0).toUpperCase();
  }
  
  if (inputEl) {
    inputEl.disabled = false;
    inputEl.focus();
  }
  if (sendBtn) sendBtn.disabled = false;
  
  // Load messages
  const messagesArea = document.getElementById('chatMessagesArea');
  messagesArea.innerHTML = '<div style="text-align:center; color:var(--muted-fg); margin:auto;">Loading messages...</div>';
  
  try {
    const { data: messages, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    renderChatMessages(messages);
    
    // Subscribe to new messages
    if (chatMessagesSubscription) chatMessagesSubscription.unsubscribe();
    
    chatMessagesSubscription = supabase
      .channel(`chat_messages_${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          if (payload.new.sender_id !== currentUserProfile.uid) {
            appendChatMessage(payload.new);
          }
        }
      )
      .subscribe();
      
  } catch(err) {
    console.error("Error loading messages:", err);
    messagesArea.innerHTML = '<div style="text-align:center; color:red; margin:auto;">Error loading messages.</div>';
  }
};

function renderChatMessages(messages) {
  const messagesArea = document.getElementById('chatMessagesArea');
  if (!messages || messages.length === 0) {
    messagesArea.innerHTML = '<div style="text-align:center; color:var(--muted-fg); margin:auto;">No messages yet. Say hi!</div>';
    return;
  }
  
  messagesArea.innerHTML = '';
  messages.forEach(msg => appendChatMessage(msg));
}

function appendChatMessage(msg) {
  const messagesArea = document.getElementById('chatMessagesArea');
  
  if (messagesArea.innerHTML.includes('No messages yet')) {
    messagesArea.innerHTML = '';
  }
  
  const isMe = msg.sender_id === currentUserProfile.uid;
  const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const align = isMe ? 'flex-end' : 'flex-start';
  const bg = isMe ? 'var(--primary)' : 'var(--muted)';
  const color = isMe ? '#fff' : 'var(--foreground)';
  const borderRadius = isMe ? '12px 12px 0 12px' : '12px 12px 12px 0';
  
  const msgEl = document.createElement('div');
  msgEl.style.display = 'flex';
  msgEl.style.flexDirection = 'column';
  msgEl.style.alignSelf = align;
  msgEl.style.maxWidth = '70%';
  msgEl.style.marginBottom = '1rem';
  
  msgEl.innerHTML = `
    <div style="background:${bg}; color:${color}; padding:0.75rem 1rem; border-radius:${borderRadius}; font-size:0.95rem; line-height:1.4;">
      ${msg.content}
    </div>
    <div style="font-size:0.7rem; color:var(--muted-fg); margin-top:0.25rem; align-self:${isMe ? 'flex-end' : 'flex-start'};">
      ${timeStr}
    </div>
  `;
  
  messagesArea.appendChild(msgEl);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

window.handleSendDM = async function(e) {
  e.preventDefault();
  if (!currentActiveThreadId) return;
  
  const inputEl = document.getElementById('chatMessageInput');
  const content = inputEl.value.trim();
  if (!content) return;
  
  inputEl.value = '';
  
  // Optimistic UI
  const tempMsg = {
    id: 'temp_' + Date.now(),
    thread_id: currentActiveThreadId,
    sender_id: currentUserProfile.uid,
    content: content,
    created_at: new Date().toISOString()
  };
  appendChatMessage(tempMsg);
  
  try {
    const { error } = await supabase
      .from('direct_messages')
      .insert([
        {
          thread_id: currentActiveThreadId,
          sender_id: currentUserProfile.uid,
          content: content
        }
      ]);
      
    if (error) throw error;
  } catch(err) {
    console.error("Error sending DM:", err);
    alert("Failed to send message.");
  }
};

window.startChatWithUser = async function(userId) {
  if (!currentUserProfile) return;
  if (userId === currentUserProfile.uid) return alert("You can't chat with yourself.");
  
  try {
    // Check if thread exists
    const { data: myThreads, error: err1 } = await supabase
      .from('chat_thread_participants')
      .select('thread_id')
      .eq('user_id', currentUserProfile.uid);
      
    if (err1) throw err1;
    
    let existingThreadId = null;
    if (myThreads && myThreads.length > 0) {
      const threadIds = myThreads.map(t => t.thread_id);
      
      const { data: otherUserThreads, error: err2 } = await supabase
        .from('chat_thread_participants')
        .select('thread_id')
        .eq('user_id', userId)
        .in('thread_id', threadIds);
        
      if (err2) throw err2;
      
      if (otherUserThreads && otherUserThreads.length > 0) {
        existingThreadId = otherUserThreads[0].thread_id;
      }
    }
    
    if (existingThreadId) {
      // Thread exists, open it
      switchAppView('messages');
      // wait a bit for dom to render
      setTimeout(() => {
        loadDirectMessageThreads(); // reload threads to be safe
        
        supabase.from('users').select('id, first_name, last_name, role').eq('id', userId).single().then(({data}) => {
          if (data) {
            const nameStr = `${data.first_name} ${data.last_name || ''}`;
            openDirectMessageThread(existingThreadId, userId, nameStr, data.role);
          }
        });
      }, 100);
      return;
    }
    
    // Create new thread
    const { data: newThread, error: err3 } = await supabase
      .from('chat_threads')
      .insert([{}])
      .select()
      .single();
      
    if (err3) throw err3;
    
    // Add participants
    const { error: err4 } = await supabase
      .from('chat_thread_participants')
      .insert([
        { thread_id: newThread.id, user_id: currentUserProfile.uid },
        { thread_id: newThread.id, user_id: userId }
      ]);
      
    if (err4) throw err4;
    
    switchAppView('messages');
    setTimeout(() => {
      loadDirectMessageThreads();
      
      supabase.from('users').select('id, first_name, last_name, role').eq('id', userId).single().then(({data}) => {
        if (data) {
          const nameStr = `${data.first_name} ${data.last_name || ''}`;
          openDirectMessageThread(newThread.id, userId, nameStr, data.role);
        }
      });
    }, 100);
    
  } catch(err) {
    console.error("Error starting chat:", err);
    alert("Failed to start chat.");
  }
};

// ======================================================================
// EVENTS LOGIC
// ======================================================================

window.loadEvents = async function() {
  if (!currentUserProfile) return;
  
  const eventsListArea = document.getElementById('eventsListArea');
  const eventsBannerArea = document.getElementById('eventsBannerArea');
  const adminCreateBtn = document.getElementById('adminCreateEventBtn');
  
  if (!eventsListArea) return;
  
  if (currentUserProfile.role === 'admin' && adminCreateBtn) {
    adminCreateBtn.style.display = 'block';
  }
  
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('start_time', { ascending: true });
      
    if (error) throw error;
    
    const { data: myRegs, error: rErr } = await supabase
      .from('event_registrations')
      .select('event_id')
      .eq('user_id', currentUserProfile.uid);
      
    if (rErr) throw rErr;
    
    const myRegSet = new Set(myRegs.map(r => r.event_id));
    
    const now = new Date();
    const upcomingEvents = events.filter(e => new Date(e.start_time) >= now);
    const pastEvents = events.filter(e => new Date(e.start_time) < now);
    
    if (upcomingEvents.length > 0) {
      const nextEvent = upcomingEvents[0];
      const isReg = myRegSet.has(nextEvent.id);
      const coverUrl = nextEvent.cover_image || 'https://images.unsplash.com/photo-1556761175-5973dc0f32d7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
      
      if (eventsBannerArea) {
        eventsBannerArea.innerHTML = `
          <div class="dash-panel" style="background: linear-gradient(135deg, var(--primary) 0%, hsl(230, 84%, 40%) 100%); color:white; padding: 3rem; position:relative; overflow:hidden;">
            <div style="position:relative; z-index:2; max-width: 60%;">
               <span style="background:rgba(255,255,255,0.2); padding:0.4rem 1rem; border-radius:99px; font-size:0.8rem; font-weight:600; text-transform:uppercase;">Next Event • ${new Date(nextEvent.start_time).toLocaleDateString()}</span>
               <h2 style="font-size:2.5rem; font-weight:800; margin:1rem 0;">${nextEvent.title}</h2>
               <p style="opacity:0.9; margin-bottom: 2rem;">${nextEvent.description || 'Join us for this exciting live session.'}</p>
               <button class="btn" onclick="handleEventRegistration('${nextEvent.id}', ${isReg})" style="background:${isReg ? 'transparent' : 'white'}; color:${isReg ? 'white' : 'var(--primary)'}; border:${isReg ? '1px solid white' : 'none'}; cursor:pointer;">
                 ${isReg ? 'Registered (Cancel)' : 'Register Now'}
               </button>
            </div>
            <div style="position:absolute; right: -50px; top: 50%; transform:translateY(-50%); width: 400px; height: 250px; background:url('${coverUrl}') center/cover; border-radius: 12px; box-shadow: -10px 0 30px rgba(0,0,0,0.3);"></div>
          </div>
        `;
      }
    } else {
      if (eventsBannerArea) eventsBannerArea.innerHTML = '';
    }
    
    let html = '';
    
    for (const e of upcomingEvents) {
      const isReg = myRegSet.has(e.id);
      const d = new Date(e.start_time);
      const monthStr = d.toLocaleString('default', { month: 'short' }).toUpperCase();
      const dayStr = d.getDate().toString().padStart(2, '0');
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      html += `
        <div class="dash-info-row" style="align-items:center; padding: 1.5rem; border-bottom: 1px solid var(--border);">
          <div style="background:var(--muted); padding:1rem; border-radius:8px; text-align:center; min-width:80px;">
            <div style="font-weight:700; font-size:1.2rem; color:var(--muted-fg);">${monthStr}</div>
            <div style="font-size:1.5rem; font-weight:800; color:var(--primary);">${dayStr}</div>
          </div>
          <div class="dash-info-content" style="margin-left: 1.5rem;">
            <h4 style="font-size:1.2rem; font-weight:600; margin:0 0 0.5rem 0;">${e.title}</h4>
            <p style="color:var(--muted-fg); margin:0;">${timeStr} &bull; <span style="text-transform:capitalize;">${(e.event_type || 'event').replace('_', ' ')}</span></p>
          </div>
          <button class="btn ${isReg ? 'btn-ghost' : 'btn-outline'}" onclick="handleEventRegistration('${e.id}', ${isReg})" style="margin-left:auto;">
            ${isReg ? 'Registered' : 'RSVP'}
          </button>
        </div>
      `;
    }
    
    if (upcomingEvents.length === 0) {
      html = '<div style="padding:2rem; text-align:center; color:var(--muted-fg);">No upcoming events scheduled.</div>';
    }
    
    eventsListArea.innerHTML = html;
    
  } catch (err) {
    console.error("Error loading events:", err);
    eventsListArea.innerHTML = '<div style="padding:2rem; text-align:center; color:red;">Failed to load events.</div>';
  }
};

window.handleEventRegistration = async function(eventId, isRegistered) {
  if (!currentUserProfile) return;
  
  try {
    if (isRegistered) {
      const { error } = await supabase
        .from('event_registrations')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', currentUserProfile.uid);
      if (error) throw error;
      alert("Registration cancelled.");
    } else {
      const { error } = await supabase
        .from('event_registrations')
        .insert([{ event_id: eventId, user_id: currentUserProfile.uid }]);
      if (error) throw error;
      alert("Successfully registered for the event!");
    }
    
    loadEvents();
  } catch(err) {
    console.error("Error toggling event registration:", err);
    alert("Failed to process registration.");
  }
};

// ======================================================================
// AUDIENCE / CRM LOGIC
// ======================================================================

window.loadAudience = async function() {
  if (!currentUserProfile || currentUserProfile.role !== 'admin') {
    const el = document.getElementById('dashAudience');
    if (el) el.innerHTML = '<div style="padding:4rem; text-align:center;"><h2>Access Denied</h2><p>You must be an admin to view this page.</p></div>';
    return;
  }
  
  const tbody = document.getElementById('audienceTableBody');
  if (!tbody) return;
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    if (!users || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="padding:2rem; text-align:center;">No users found.</td></tr>';
      return;
    }
    
    let html = '';
    for (const u of users) {
      const name = `${u.first_name || 'Unknown'} ${u.last_name || ''}`;
      const joined = u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A';
      
      let roleColor = 'var(--muted-fg)';
      let roleBg = 'var(--muted)';
      if (u.role === 'founder') { roleColor = '#2563eb'; roleBg = '#dbeafe'; }
      if (u.role === 'investor') { roleColor = '#16a34a'; roleBg = '#dcfce7'; }
      if (u.role === 'admin') { roleColor = '#dc2626'; roleBg = '#fee2e2'; }
      
      html += `
        <tr style="border-bottom:1px solid var(--border); transition:background 0.2s;" onmouseover="this.style.background='var(--muted)'" onmouseout="this.style.background='transparent'">
          <td style="padding:1rem;">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <div class="app-avatar" style="width:32px; height:32px; font-size:0.8rem;">${name.charAt(0).toUpperCase()}</div>
              <div>
                <div style="font-weight:500;">${name}</div>
                <div style="font-size:0.8rem; color:var(--muted-fg);">${u.email || ''}</div>
              </div>
            </div>
          </td>
          <td style="padding:1rem;">
            <span style="background:${roleBg}; color:${roleColor}; padding:0.25rem 0.5rem; border-radius:99px; font-size:0.75rem; font-weight:600; text-transform:uppercase;">${u.role || 'Member'}</span>
          </td>
          <td style="padding:1rem; color:var(--muted-fg); font-size:0.9rem;">${joined}</td>
        </tr>
      `;
    }
    
    tbody.innerHTML = html;
    
  } catch (err) {
    console.error("Error loading audience:", err);
    tbody.innerHTML = '<tr><td colspan="3" style="padding:2rem; text-align:center; color:red;">Failed to load audience data.</td></tr>';
  }
};

// ======================================================================
// FEED LOGIC
// ======================================================================

const DEFAULT_FEED_SPACE_ID = '00000000-0000-0000-0000-000000000001'; // General Discussion

window.loadFeed = async function() {
  if (!currentUserProfile) return;
  
  const avatarEl = document.getElementById('feedUserAvatar');
  if (avatarEl) {
    avatarEl.textContent = currentUserProfile.first_name ? currentUserProfile.first_name.charAt(0).toUpperCase() : 'U';
  }
  
  const postsArea = document.getElementById('feedPostsArea');
  if (!postsArea) return;
  
  try {
    const { data: posts, error } = await supabase
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) throw error;
    
    if (!posts || posts.length === 0) {
      postsArea.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--muted-fg);">No posts yet. Be the first to share!</div>';
      return;
    }
    
    let html = '';
    for (const p of posts) {
      const avatarStr = p.user_name ? p.user_name.charAt(0).toUpperCase() : 'U';
      const timeStr = new Date(p.created_at).toLocaleString();
      
      html += `
        <div class="dash-panel" style="margin-bottom: 1.5rem; padding: 1.5rem;">
          <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1rem;">
            <div class="app-avatar">${avatarStr}</div>
            <div>
              <div style="font-weight:600;">${p.user_name}</div>
              <div style="font-size:0.8rem; color:var(--muted-fg); text-transform:capitalize;">${p.user_role} &bull; ${timeStr}</div>
            </div>
          </div>
          <div style="font-size:1rem; line-height:1.6; color:var(--foreground); white-space:pre-wrap;">${p.content}</div>
          
          <div style="display:flex; gap:1rem; margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--border);">
            <button class="btn btn-ghost" style="padding:0.4rem 0.8rem; color:var(--muted-fg);" onclick="alert('Likes coming soon!')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:0.4rem; vertical-align:middle;"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg> Like
            </button>
            <button class="btn btn-ghost" style="padding:0.4rem 0.8rem; color:var(--muted-fg);" onclick="alert('Comments coming soon!')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:0.4rem; vertical-align:middle;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> Comment
            </button>
          </div>
        </div>
      `;
    }
    
    postsArea.innerHTML = html;
    
  } catch(err) {
    console.error("Error loading feed:", err);
    postsArea.innerHTML = '<div style="text-align:center; padding:3rem; color:red;">Failed to load feed.</div>';
  }
};

window.handleFeedPostSubmit = async function() {
  if (!currentUserProfile) return;
  
  const inputEl = document.getElementById('feedPostInput');
  const content = inputEl.value.trim();
  if (!content) return;
  
  const btn = event.currentTarget;
  btn.disabled = true;
  btn.textContent = 'Posting...';
  
  try {
    const { error } = await supabase
      .from('community_posts')
      .insert([{
        space_id: DEFAULT_FEED_SPACE_ID,
        user_id: currentUserProfile.uid,
        user_name: `${currentUserProfile.first_name} ${currentUserProfile.last_name || ''}`.trim(),
        user_role: currentUserProfile.role || 'member',
        content: content
      }]);
      
    if (error) throw error;
    
    inputEl.value = '';
    loadFeed();
  } catch(err) {
    console.error("Error posting to feed:", err);
    alert("Failed to post. Please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post';
  }
};







