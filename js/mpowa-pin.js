/* MPowa prototype interface — "Why MPowa Exists" stacking-card crossfade.
   Same visual effect measured on orchid.security (header stays put while cards
   stack over it) but built without GSAP's pin/spacer mechanism, which turned out
   fragile here: it requires GSAP to precisely reconcile the pinned element's
   natural height against manually-set scroll distance, and a mismatch between
   when GSAP measures that height (relative to when this script repositions the
   cards) produced a large dead scroll gap in testing. Native CSS
   `position: sticky` (see .mp-why-sticky) handles the "stays in place" part with
   zero manual math — GSAP is only used here for the scrub-driven crossfade
   between cards, which is what it's actually good at.

   Progressive enhancement: .mp-why-scroll's tall height and .mp-why-sticky's
   sticky position are added by THIS SCRIPT (via classList), not baked into the
   page's CSS — see the html.mp-pin-active gate in styles.css. Without GSAP, or
   under prefers-reduced-motion, the section stays a normal-height block with
   cards in ordinary document flow. */
(function () {
  'use strict';

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    return;
  }

  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  function setupWhyStack() {
    var scrollBox = document.querySelector('.mp-why-scroll');
    var stackWrap = document.querySelector('.mp-reason-stack');
    var cards = stackWrap ? Array.prototype.slice.call(stackWrap.querySelectorAll('.mp-reason-card')) : [];

    if (!scrollBox || !stackWrap || cards.length < 2) {
      return;
    }

    document.documentElement.classList.add('mp-pin-active');

    var tallest = Math.max.apply(null, cards.map(function (c) { return c.offsetHeight; }));
    gsap.set(stackWrap, { position: 'relative', height: tallest });
    cards.forEach(function (card, i) {
      gsap.set(card, {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        opacity: i === 0 ? 1 : 0,
        y: i === 0 ? 0 : 40,
        scale: 1,
      });
    });

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: scrollBox,
        start: 'top top+=96',
        end: 'bottom bottom',
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });

    // Sequential, no gaps: each pair starts exactly when the previous ends, so
    // the whole .mp-why-scroll height maps cleanly onto the crossfade with no
    // dead scroll at either end.
    cards.forEach(function (card, i) {
      if (i === 0) return;
      tl.to(cards[i - 1], { scale: 0.94, opacity: 0.35, duration: 1 }, i === 1 ? 0 : '<')
        .to(card, { opacity: 1, y: 0, duration: 1 }, '<');
    });
  }

  // Product window: scales/fades in as it scrolls into view, like a device
  // screenshot coming into focus — a common pattern on product marketing pages
  // (Apple/Stripe/Linear-style), implemented independently here with GSAP scrub,
  // no pin involved. Starts already visible (opacity 1, scale 0.92) so it never
  // depends on JS for basic visibility, only for the extra polish of the zoom.
  function setupWindowZoom() {
    var win = document.querySelector('.mp-window');
    if (!win) return;

    gsap.set(win, { scale: 0.92, opacity: 0.85, transformOrigin: 'center center' });
    gsap.to(win, {
      scale: 1,
      opacity: 1,
      ease: 'power1.out',
      scrollTrigger: {
        trigger: win,
        start: 'top 90%',
        end: 'top 40%',
        scrub: 0.6,
      },
    });
  }

  // Ask/console frame: a much stronger version of the window-zoom above —
  // starts noticeably small and grows to full size as it scrolls into view,
  // so it reads as "zooming in to focus" on the console rather than a subtle
  // polish tween. This is the section's whole point (the "window into the
  // system"), so the effect is deliberately more dramatic than elsewhere.
  function setupAskFrameZoom() {
    var frame = document.querySelector('.mp-ask-frame');
    if (!frame) return;

    gsap.set(frame, { scale: 0.72, opacity: 0.5, transformOrigin: 'center top' });
    gsap.to(frame, {
      scale: 1,
      opacity: 1,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: frame,
        start: 'top 95%',
        end: 'top 28%',
        scrub: 0.6,
      },
    });
  }

  function setup() {
    setupWhyStack();
    setupWindowZoom();
    setupAskFrameZoom();
  }

  if (document.readyState === 'complete') {
    setup();
  } else {
    window.addEventListener('load', setup);
  }
})();
