/* ============================================================
   ELAMA CONSULTING — main.js
   - AOS init
   - Navbar scroll behaviour
   - Smooth scroll for nav links
   - Contact form → Supabase lead capture
   ============================================================ */

'use strict';

// ---- AOS (Animate on Scroll) ----
AOS.init({
  duration: 700,
  once: true,
  offset: 60,
});

// ---- Navbar: add .scrolled class on scroll ----
const nav = document.getElementById('mainNav');

function handleNavScroll() {
  if (window.scrollY > 60) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}

window.addEventListener('scroll', handleNavScroll, { passive: true });
handleNavScroll(); // run on load

// ---- Close mobile navbar on link click ----
document.querySelectorAll('#navbarNav .nav-link').forEach(link => {
  link.addEventListener('click', () => {
    const collapse = document.getElementById('navbarNav');
    const bsCollapse = bootstrap.Collapse.getInstance(collapse);
    if (bsCollapse) bsCollapse.hide();
  });
});

// ---- Active nav link on scroll ----
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('#mainNav .nav-link');

function highlightNav() {
  const scrollPos = window.scrollY + 120;
  sections.forEach(section => {
    const top    = section.offsetTop;
    const bottom = top + section.offsetHeight;
    const id     = section.getAttribute('id');
    const link   = document.querySelector(`#mainNav .nav-link[href="#${id}"]`);
    if (link) {
      if (scrollPos >= top && scrollPos < bottom) {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    }
  });
}

window.addEventListener('scroll', highlightNav, { passive: true });

// ---- Contact Form → Edge Function ----
// Posts directly to the Supabase Edge Function which handles DB insert + email server-side.
// This avoids all browser-level header issues (MetaMask SES etc.)
const EDGE_FUNCTION_URL  = 'https://bosvbnjhsimqtnwkkcvn.supabase.co/functions/v1/notify-lead';
const SUPABASE_ANON_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvc3Zibmpoc2ltcXRud2trY3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNjA0OTMsImV4cCI6MjA5MTkzNjQ5M30.4F1XJarCvJ2ESpL71h-0wMBF1iH5VAesx-EANMhTbyg';

const contactForm  = document.getElementById('contactForm');
const submitBtn    = document.getElementById('submitBtn');
const formSuccess  = document.getElementById('formSuccess');
const formError    = document.getElementById('formError');

if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Read fields by ID to avoid form.name ambiguity
    const name     = document.getElementById('fname').value.trim();
    const email    = document.getElementById('femail').value.trim();
    const company  = document.getElementById('fcompany').value.trim();
    const interest = document.getElementById('finterest').value;
    const message  = document.getElementById('fmessage').value.trim();

    if (!name || !email) {
      showFormError('Please fill in your name and email.');
      return;
    }

    if (!isValidEmail(email)) {
      showFormError('Please enter a valid email address.');
      return;
    }

    // UI: loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    formSuccess.classList.add('d-none');
    formError.classList.add('d-none');

    // POST to Edge Function — DB insert + email handled server-side
    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          name,
          email,
          company:  company  || null,
          interest: interest || null,
          message:  message  || null,
        }),
      });

      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Message';

      if (!response.ok) {
        const errText = await response.text();
        console.error('[Elama] Supabase error:', response.status, errText);
        showFormError();
      } else {
        showFormSuccess();
        contactForm.reset();
      }
    } catch (err) {
      console.error('[Elama] Network error:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Message';
      showFormError();
    }
  });
}

// ---- Helpers ----
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFormSuccess() {
  formSuccess.classList.remove('d-none');
  formError.classList.add('d-none');
}

function showFormError(msg) {
  formError.classList.remove('d-none');
  formSuccess.classList.add('d-none');
  if (msg) {
    formError.querySelector('span, :last-child') ;
    formError.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>${msg}`;
  }
}

function simulateDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
