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

// ============================================================
// MEET THE TEAM — carousel
// ============================================================

const SUPABASE_URL = 'https://bosvbnjhsimqtnwkkcvn.supabase.co';

const TEAM_FALLBACK = [
  {
    id: 'samuel-barlow',
    name: 'Samuel Barlow',
    title: 'Founder, Elama Consulting',
    synopsis: 'Technology-driven business strategist, growth consultant, and executive advisor',
    about: 'Samuel Barlow is a technology-driven business strategist, growth consultant, and executive advisor with a strong background in software, AI, and commercial operations. With expertise spanning business development, systems design, automation, and strategic scaling, Samuel helps founders and leadership teams break through growth ceilings, streamline operations, and build businesses that perform efficiently without constant owner involvement.\n\nCombining technical insight with commercial execution, Samuel works with companies to modernise workflows, improve profitability, strengthen sales performance, and unlock new revenue opportunities. His approach blends practical business strategy with emerging technology, enabling organisations to scale smarter in an increasingly digital economy.\n\nIn addition to consulting, Samuel brings a unique advantage to U.S. businesses through access to the PCMP (Preventive Care Management Program), a federally funded wellness and benefits solution that can save employers $620+ per employee annually with zero reduction in employee take-home pay. This allows companies to improve workforce wellbeing while reducing operating costs.',
    image_data: 'images/samuel.jpg',
    display_order: 0,
  },
];

async function loadTeam() {
  const loadingEl  = document.getElementById('teamLoading');
  const carouselEl = document.getElementById('teamCarousel');
  if (!loadingEl || !carouselEl) return;

  let members = TEAM_FALLBACK;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/team_members?select=*&order=display_order.asc`,
      {
        signal: controller.signal,
        headers: {
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.length) members = data;
    }
  } catch (_) { /* fall through to fallback */ }

  buildTeamCarousel(members, carouselEl, loadingEl);
}

function buildTeamCarousel(members, carouselEl, loadingEl) {
  const indicatorsEl = document.getElementById('teamIndicators');
  const innerEl      = document.getElementById('teamInner');

  // Indicators: slot 0 = overview, slots 1…N = individual members
  const totalSlides = members.length + 1;
  indicatorsEl.innerHTML = Array.from({ length: totalSlides }, (_, i) =>
    `<button type="button" data-bs-target="#teamCarousel" data-bs-slide-to="${i}"
       ${i === 0 ? 'class="active" aria-current="true"' : ''}
       aria-label="Slide ${i + 1}"></button>`
  ).join('');

  // Slides
  innerEl.innerHTML = teamOverviewSlide(members)
    + members.map(m => teamMemberSlide(m)).join('');

  // Show carousel
  loadingEl.classList.add('d-none');
  carouselEl.classList.remove('d-none');

  new bootstrap.Carousel(carouselEl, {
    interval: false,
    ride:     false,
    wrap:     true,
    touch:    true,
  });
}

function teamOverviewSlide(members) {
  const cards = members.map(m => `
    <div class="ec-team-card">
      <div class="ec-team-avatar">
        ${m.image_data
          ? `<img src="${htmlEnc(m.image_data)}" alt="${htmlEnc(m.name)}" class="ec-team-avatar-img" />`
          : `<div class="ec-team-avatar-placeholder"><i class="bi bi-person"></i></div>`
        }
      </div>
      <h4 class="ec-team-name">${htmlEnc(m.name)}</h4>
      <p class="ec-team-role">${htmlEnc(m.title)}</p>
      <p class="ec-team-synopsis">${htmlEnc(m.synopsis)}</p>
    </div>
  `).join('');

  return `
    <div class="carousel-item active">
      <div class="ec-team-overview-slide">
        <div class="text-center mb-5">
          <p class="ec-eyebrow mb-2">Our Team</p>
        </div>
        <div class="ec-team-grid">${cards}</div>
      </div>
    </div>`;
}

function teamMemberSlide(m) {
  const firstName  = htmlEnc(m.name.split(' ')[0]);
  const paragraphs = (m.about || m.synopsis || '')
    .split('\n\n')
    .filter(p => p.trim())
    .map(p => `<p class="ec-body-text mb-4">${htmlEnc(p.trim())}</p>`)
    .join('');

  const photoHTML = m.image_data
    ? `<img src="${htmlEnc(m.image_data)}" alt="${htmlEnc(m.name)}" class="ec-photo-img ec-photo-bw" />`
    : `<div class="ec-photo-placeholder"><i class="bi bi-person"></i><p>No photo</p></div>`;

  return `
    <div class="carousel-item">
      <div class="ec-team-member-slide">
        <div class="row align-items-center gy-5">
          <div class="col-12 col-lg-5 text-center">
            <div class="ec-photo-frame mx-auto">${photoHTML}</div>
          </div>
          <div class="col-12 col-lg-7">
            <p class="ec-eyebrow mb-2">Team Member</p>
            <h2 class="ec-section-title mb-4">${htmlEnc(m.name)}<br/>
              <span class="ec-gold">${htmlEnc(m.title)}</span></h2>
            ${paragraphs}
            <a href="book.html" class="btn ec-btn-navy btn-lg">Work With ${firstName}</a>
          </div>
        </div>
      </div>
    </div>`;
}

function htmlEnc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Kick off on index page only
if (document.getElementById('teamCarousel')) {
  loadTeam();
}
