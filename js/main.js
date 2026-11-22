/**
 * Lo/Be Lab — Main JavaScript
 *
 * - Active nav link
 * - Work page filter
 * - Smooth scroll for anchors
 * - Internal link previews (the site's one animation)
 * - Homepage hero: type "Lo/Be Lab", then split letters across the page
 */

// ========== HOMEPAGE HERO ANIMATION ==========
//
// Two-layer hero:
//   1) Canvas particles drift in from off-screen and form "LO/BE LAB"
//      in the center of the viewport (slow, hundreds of paper rects).
//   2) Once the word is formed, solid DOM letters crossfade in on top
//      and the canvas fades out. The DOM letters then FLIP-split out
//      to the Paul Rand–style scattered positions around the viewport
//      edges, where the columns "cut" them.
//
// Timeline (ms from page load):
//    0 - 2000   PHRASE   - the lab's positioning line displayed as solid
//                          black text at huge size, filling the viewport
//                          (longer lines bleeding past the edges)
// 2000 - 2900   DISSOLVE - solid text fades out while particles fade in
//                          at the same pixel positions (still stationary)
// 2900 - 4100   SHATTER  - particles fly from phrase pixels toward each
//                          particle's random wander point (1200ms)
// 4100 - 5300   WANDER   - particles float freely (Lissajous-like)
// 5300 - 7100   SWARM    - particles converge into LO/BE LAB centered
// 7100 - 7500   HOLD     - particles settle at letter positions
// 7500 - 8400   crossfade  - canvas fades out, DOM letters fade in
// 8250 - 9750   FLIP-split - DOM letters slide from centered word to
//                            their final scattered positions (1500ms)
// 9000 - 9900   the 5-column grid fades in over the top (during the
//                latter half of the split)

function initHeroAnimation() {
  const canvas = document.querySelector('.hero-canvas');
  const hero = document.querySelector('.hero-letters');
  const grid = document.querySelector('.landing-grid');
  if (!canvas || !hero || !grid) return;

  const letters = Array.from(hero.querySelectorAll('.lobe-letter'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let alreadyPlayed = null;
  try { alreadyPlayed = sessionStorage.getItem('lobe-hero-played-v9'); } catch (e) {}

  // Arriving from another page of this site (the Lo/Be Lab logo, a nav
  // link, a reload): go straight to the home page. The animation only
  // plays for visitors coming in from outside.
  let fromSite = false;
  try {
    fromSite = !!document.referrer &&
      new URL(document.referrer).origin === location.origin;
  } catch (e) {}

  // Repeat visits / in-site navigation / reduced motion: jump straight
  // to the final state, no particles, no transitions.
  if (reducedMotion || alreadyPlayed || fromSite) {
    canvas.style.display = 'none';
    hero.classList.add('skip-anim', 'visible', 'split');
    grid.classList.add('revealed');
    return;
  }

  // Full sequence on first visit.
  runHeroParticles(canvas, {
    onLettersFormed: () => {
      // 1) Fade DOM letters in (centered) + fade canvas out
      //    The canvas already sampled the DOM's exact positions, so
      //    the crossfade lands in the same pixels.
      hero.classList.add('visible');
      canvas.classList.add('fading-out');

      // 2) After the crossfade, FLIP-split the DOM letters outward
      setTimeout(() => {
        flipSplit(hero, letters);
      }, 750);

      // 3) Reveal the columns during the latter half of the split
      setTimeout(() => {
        grid.classList.add('revealed');
        sessionStorage.setItem('lobe-hero-played-v9', '1');
      }, 1500);

      // 4) Once the canvas has fully faded, take it out of the
      //    paint tree so it stops consuming any resources.
      setTimeout(() => {
        canvas.style.display = 'none';
      }, 1100);
    },
  });
}

/**
 * FLIP — animate each letter from its current (centered) position to
 * its final (scattered) position. Same technique as the old typewriter
 * version: First, Last, Invert, Play.
 */
function flipSplit(hero, letters) {
  const first = letters.map(l => l.getBoundingClientRect());
  hero.classList.add('split');
  const last = letters.map(l => l.getBoundingClientRect());

  letters.forEach((l, i) => {
    const f = first[i];
    const t = last[i];
    if (!t.width) return; // hidden (the space)
    const dx = f.left - t.left;
    const dy = f.top - t.top;
    const sx = f.width / t.width;
    const sy = f.height / t.height;
    l.style.transformOrigin = 'top left';
    l.style.transition = 'none';
    l.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
  });

  hero.offsetHeight; // force reflow

  requestAnimationFrame(() => {
    letters.forEach(l => {
      l.style.transition = 'transform 1500ms cubic-bezier(0.16, 1, 0.3, 1)';
      l.style.transform = '';
    });
  });
}

function runHeroParticles(canvas, opts) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Phase timings (ms from start). Six-stage hero, with the
  // transitions (DISSOLVE + SHATTER) deliberately slow so the
  // viewer can absorb each beat.
  //    0 - 2000   PHRASE   - solid black text rendered huge, no particles
  // 2000 - 2900   DISSOLVE - text fades out (900ms), particles fade in
  //                          at the same pixel positions (no movement)
  // 2900 - 4100   SHATTER  - particles fly from phrase pixels toward
  //                          their wander points (1200ms)
  // 4100 - 5300   WANDER   - free-floating (Lissajous-ish)
  // 5300 - 7100   SWARM    - converge onto LO/BE LAB letter targets
  // 7100 - 7500   HOLD     - settle at letter positions, hand off
  const T_PHRASE_END   = 2000;
  const T_DISSOLVE_END = 2900;
  const T_SHATTER_END  = 4100;
  const T_WANDER_END   = 5300;
  const T_SWARM_END    = 7100;
  const T_HOLD_END     = 7500;

  let W = 0, H = 0;
  let targets = [];           // LO/BE LAB letter pixel positions
  let phraseTargets = [];     // PHRASE text pixel positions
  let phraseLayout = null;    // { fontSize, lines: [{text, indent, y}] }
  let particles = [];
  let centerFontSize = 0;
  let startTime = null;
  let handedOff = false;

  function sizeCanvas() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Compute the layout of the opening PHRASE — five stacked lines,
  // rendered huge so the text fills the viewport with intentional
  // overflow at the right edge on the longer lines. Returns an object
  // describing where each line should be drawn.
  function computePhraseLayout() {
    const lines = [
      'An applied research',
      'and design practice',
      'building environments',
      'where people can hear',
      'themselves think.',
    ];
    // BIG: 24% of viewport height per line, tight leading.
    // 5 lines x 24% x 0.92 leading = ~110% of viewport (slight top/
    // bottom bleed). Longer lines also bleed past the right edge.
    const fontSize = H * 0.24;
    const lineHeight = fontSize * 0.92;
    const startY = (H - lineHeight * lines.length) / 2 + fontSize * 0.04;
    // Alternate negative-indent variation so the lines don't all
    // start at the same x — looks more deliberately composed.
    const layoutLines = lines.map((text, i) => ({
      text,
      indent: -fontSize * 0.20 + (i % 2 === 0 ? 0 : fontSize * 0.10),
      y: startY + i * lineHeight,
    }));
    return { fontSize, lineHeight, lines: layoutLines };
  }

  // Draw the phrase as solid text on the MAIN canvas at the given
  // alpha. Used during the PHRASE and DISSOLVE phases.
  function drawPhrase(alpha) {
    if (!phraseLayout || alpha <= 0) return;
    ctx.font = `700 ${phraseLayout.fontSize}px 'Crimson Pro', Georgia, serif`;
    ctx.fillStyle = `rgba(20, 20, 20, ${alpha.toFixed(3)})`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    for (const line of phraseLayout.lines) {
      ctx.fillText(line.text, line.indent, line.y);
    }
  }

  // Sample pixel positions inside the rendered phrase, using the
  // shared layout. Returns an array of {x, y} screen-space targets.
  function samplePhraseTargets() {
    if (!phraseLayout) return [];
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const octx = off.getContext('2d');
    octx.font = `700 ${phraseLayout.fontSize}px 'Crimson Pro', Georgia, serif`;
    octx.fillStyle = '#000';
    octx.textBaseline = 'top';
    octx.textAlign = 'left';
    for (const line of phraseLayout.lines) {
      octx.fillText(line.text, line.indent, line.y);
    }
    const img = octx.getImageData(0, 0, W, H).data;
    const step = W < 700 ? 8 : 10; // sparser sampling now that text is huge
    const list = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const i = (y * W + x) * 4;
        if (img[i + 3] > 128) {
          list.push({
            x: x + (Math.random() - 0.5) * step * 0.4,
            y: y + (Math.random() - 0.5) * step * 0.4,
          });
        }
      }
    }
    return list;
  }

  // Sample pixel positions inside the rendered "LO/BE LAB" mark.
  //
  // We use the DOM letters as the layout source of truth: each <span>
  // in .hero-letters is already laid out (opacity 0, position fixed,
  // flex-centered). For each one we read its boundingClientRect and
  // computed font properties, then render the same character at the
  // same center on an off-screen canvas. This guarantees the canvas
  // particles land in exactly the same pixels as the DOM letters
  // they crossfade into - same size, same weight, same letter
  // spacing, same per-letter overrides (e.g. the lighter slash).
  function sampleLetterTargets() {
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const octx = off.getContext('2d');

    const heroEl = document.querySelector('.hero-letters');
    const letterEls = heroEl ? Array.from(heroEl.querySelectorAll('.lobe-letter')) : [];

    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillStyle = '#000';

    let captured = false;
    for (const el of letterEls) {
      if (el.classList.contains('space')) continue;
      const text = el.textContent.trim();
      if (!text) continue;

      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;

      const cs = window.getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize);
      const fontWeight = cs.fontWeight || '800';

      if (!captured) { centerFontSize = fontSize; captured = true; }

      octx.font = `${fontWeight} ${fontSize}px 'Crimson Pro', Georgia, serif`;
      octx.fillText(
        text,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
    }

    const img = octx.getImageData(0, 0, W, H).data;
    const step = W < 700 ? 6 : 8;
    const list = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const i = (y * W + x) * 4;
        if (img[i + 3] > 128) {
          list.push({
            x: x + (Math.random() - 0.5) * step * 0.5,
            y: y + (Math.random() - 0.5) * step * 0.5,
          });
        }
      }
    }
    return list;
  }

  function buildParticles() {
    // Particle count = number of phrase pixel positions. Each particle
    // also gets a LO/BE LAB letter target (cycled through if the phrase
    // sample is larger than the letter sample, which it usually is).
    return phraseTargets.map((phr, i) => {
      const lt = targets[i % targets.length] || { x: W / 2, y: H / 2 };
      // Wander point — a random in-viewport location the particle
      // drifts around during the free-floating phase.
      const wx = W * (0.08 + Math.random() * 0.84);
      const wy = H * (0.10 + Math.random() * 0.80);
      return {
        // Phrase pixel position (the particle's starting point)
        phx: phr.x, phy: phr.y,
        wx, wy,
        tx: lt.x, ty: lt.y,
        // Per-particle delay so they don't all shatter together
        delay: Math.random() * 400,
        // Paper rect geometry — small enough that dense particles
        // at the phrase positions read as text, while still showing
        // as discrete paper bits when scattered.
        w: 3 + Math.random() * 3,
        h: 4 + Math.random() * 3.5,
        rot: Math.random() * Math.PI * 2,
        // Per-particle wander phase / frequency offsets
        seed: Math.random() * 1000,
        freqA: 0.0011 + Math.random() * 0.0008,
        freqB: 0.0013 + Math.random() * 0.0010,
        // How much this particle wanders (some drift more than others)
        ampX: 35 + Math.random() * 50,
        ampY: 30 + Math.random() * 45,
      };
    });
  }

  function rebuild() {
    sizeCanvas();
    phraseLayout = computePhraseLayout();
    phraseTargets = samplePhraseTargets();
    targets = sampleLetterTargets();
    particles = buildParticles();
  }

  // Easings
  const easeOutCubic   = t => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  const clamp01        = t => Math.max(0, Math.min(1, t));

  // Free-drift wander position around (p.wx, p.wy). Two summed sin
  // waves at different frequencies give a Lissajous-like curve that
  // doesn't repeat over the wander window, so motion looks alive.
  function wanderPoint(p, now) {
    const slowX = Math.sin(now * 0.00035 + p.seed * 2.0) * 30;
    const slowY = Math.cos(now * 0.00042 + p.seed * 1.7) * 24;
    const oscX  = Math.sin(now * p.freqA + p.seed) * p.ampX;
    const oscY  = Math.cos(now * p.freqB + p.seed * 1.3) * p.ampY;
    return { x: p.wx + slowX + oscX, y: p.wy + slowY + oscY };
  }

  function frame(now) {
    if (document.hidden) {
      requestAnimationFrame(frame);
      return;
    }
    if (startTime === null) startTime = now;
    const t = now - startTime;

    ctx.clearRect(0, 0, W, H);

    // === LAYER 1: solid phrase text ===
    // Fully visible during PHRASE; fades out during DISSOLVE; gone after.
    if (t < T_DISSOLVE_END) {
      const textAlpha = t < T_PHRASE_END
        ? 1
        : 1 - (t - T_PHRASE_END) / (T_DISSOLVE_END - T_PHRASE_END);
      drawPhrase(textAlpha);
    }

    // === LAYER 2: particles ===
    // Invisible during PHRASE; fade in during DISSOLVE (at phrase pixels,
    // no movement); fly outward during SHATTER; then existing flow.
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      let x, y, alpha;

      if (t < T_PHRASE_END) {
        // PHRASE: skip — solid text is showing
        continue;
      } else if (t < T_DISSOLVE_END) {
        // DISSOLVE: particle fades in at its phrase pixel position
        const tt = (t - T_PHRASE_END) / (T_DISSOLVE_END - T_PHRASE_END);
        x = p.phx + Math.sin(now * 0.001 + p.seed) * 0.4;
        y = p.phy + Math.cos(now * 0.001 + p.seed * 1.3) * 0.4;
        // Crossfade: as text drops from 1 to 0, particles climb from 0 to ~0.9
        alpha = tt * 0.9;
      } else if (t < T_SHATTER_END) {
        // SHATTER: fly from phrase pixel to wander point
        const tt = easeOutCubic(clamp01((t - T_DISSOLVE_END) / (T_SHATTER_END - T_DISSOLVE_END)));
        const wp = wanderPoint(p, now);
        x = p.phx + (wp.x - p.phx) * tt;
        y = p.phy + (wp.y - p.phy) * tt;
        alpha = 0.9 - 0.1 * tt;
      } else if (t < T_WANDER_END) {
        // WANDER: free-floating motion around the wander point
        const wp = wanderPoint(p, now);
        x = wp.x;
        y = wp.y;
        alpha = 0.8;
      } else if (t < T_SWARM_END) {
        // SWARM: converge from current wander position to letter target.
        const tt = easeInOutCubic(clamp01((t - T_WANDER_END) / (T_SWARM_END - T_WANDER_END)));
        const wp = wanderPoint(p, now);
        x = wp.x + (p.tx - wp.x) * tt;
        y = wp.y + (p.ty - wp.y) * tt;
        alpha = 0.8 + tt * 0.2;
      } else {
        // HOLD: at letter target, subtle breathing wobble
        x = p.tx + Math.sin(now * 0.0024 + p.seed) * 0.7;
        y = p.ty + Math.cos(now * 0.0024 + p.seed * 1.3) * 0.7;
        alpha = 1;
      }

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.rot);
      ctx.fillStyle = `rgba(22, 22, 22, ${alpha.toFixed(3)})`;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    // Once we've held long enough, hand off to the DOM letters and
    // stop the animation loop entirely.
    if (!handedOff && t >= T_HOLD_END) {
      handedOff = true;
      if (typeof opts.onLettersFormed === 'function') {
        opts.onLettersFormed();
      }
      return; // exit the rAF loop — the last frame stays as the canvas fades
    }

    requestAnimationFrame(frame);
  }

  // Wait for Inter to be ready so the letter sampling matches what
  // the DOM letters will render with.
  function start() {
    rebuild();
    requestAnimationFrame(frame);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
  } else {
    start();
  }

  // Resize handler — only useful during the swarm; once we've handed
  // off to DOM letters, the canvas is removed from the layout.
  let resizeTimer;
  window.addEventListener('resize', () => {
    if (handedOff) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const oldT = startTime;
      rebuild();
      startTime = oldT;
    }, 180);
  });
}

// ========== ACTIVE NAV LINK ==========

function initActiveNavLink() {
  const currentPath = window.location.pathname.replace(/\/index\.html?$/, '/');
  document.querySelectorAll('.nav-right a').forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href') || '';
    // Strip out empty parts and any "..","." path-up segments so a
    // relative href like "../library/index.html" matches as "library".
    const parts = href.split('/').filter(p => p && p !== '..' && p !== '.');
    const segment = parts[0] || '';
    if (segment && currentPath.includes('/' + segment + '/')) {
      link.classList.add('active');
    }
  });
}

// ========== WORK PAGE FILTER ==========

function initWorkFilters() {
  const buttons = document.querySelectorAll('.filter-btn');
  const items = document.querySelectorAll('.project-list-item[data-category]');
  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', function () {
      const filter = this.getAttribute('data-filter');
      buttons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      items.forEach(item => {
        if (filter === 'all') item.style.display = '';
        else item.style.display = (item.getAttribute('data-category') === filter) ? '' : 'none';
      });
    });
  });
}

// ========== SMOOTH SCROLL ==========

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ========== INTERNAL LINK PREVIEWS ==========

/**
 * Preview manifest. Keys are the last 1–2 path segments of a URL.
 * Matched against any internal link the cursor hovers.
 */
const PAGE_PREVIEWS = {
  // Homepage
  'index.html': {
    kind: 'Lo/Be Lab',
    title: 'Home',
    excerpt: 'A design-based research practice studying how spatial, narrative, and computational environments support reflective learning. Public working notebook.'
  },

  // Working reports
  'work/index.html': {
    kind: 'Index · 5 reports',
    title: 'Working reports',
    excerpt: 'Five projects in active iteration. Each report has front-matter, method, findings, and an iteration log.'
  },
  'work/dartworld.html': {
    kind: 'Report 01 · Active · v6',
    title: 'DartWorld',
    excerpt: 'Spatial narrative platform with reflective onboarding, navigable 3D environment, and longitudinal journaling. Built with DALI Lab at Dartmouth.'
  },
  'work/synapse.html': {
    kind: 'Report 02 · Active · v3',
    title: 'Synapse',
    excerpt: 'An exploration instrument that replaces the ranked list with a spatial map. 13 questions, 460 occupations from BLS and O*NET.'
  },
  'work/career-design-lab.html': {
    kind: 'Report 03 · Active · v12',
    title: 'Career Design Lab',
    excerpt: 'Six tools woven into a semester-long deliberation system at Dartmouth\'s CCD. Each term is both a program and a research cycle.'
  },
  'work/narrative-by-design.html': {
    kind: 'Report 04 · Pilot · v2',
    title: 'Narrative by Design',
    excerpt: 'A 90-minute workshop built around narrative compression: paragraph → sentence → single word. Paired with card sorts and an AI-as-mirror layer.'
  },
  'work/threshold.html': {
    kind: 'Report 05 · Active · v4',
    title: 'Threshold',
    excerpt: 'A discipline-specific career toolkit for architecture, landscape architecture, and urban design. Test case for field-specific reflection tools.'
  },

  // Section indexes
  'research/index.html': {
    kind: 'Research program',
    title: 'Animating questions',
    excerpt: 'Five open questions that organize the lab\'s projects, with current findings and open threads. The research map across all reports.'
  },
  'methods/index.html': {
    kind: 'Catalog · 9 methods',
    title: 'Methods',
    excerpt: 'Working write-ups of the methods that recur across projects: narrative compression, card-sort triangulation, AI-as-mirror, spatial mapping, archetype clustering.'
  },
  'library/index.html': {
    kind: 'Annotated bibliography',
    title: 'Library',
    excerpt: 'The intellectual lineage of the lab: identity development, reflective learning, sensemaking, distributed cognition, narrative psychology, design-based research.'
  },
  'notes/index.html': {
    kind: 'Field notes',
    title: 'Working memory',
    excerpt: 'Short essays from the working memory of the lab. Things we noticed in the field, methods we\'re trying, ideas we\'re still pulling on.'
  },
  'publications/index.html': {
    kind: 'Publications & talks',
    title: 'Where this is written up',
    excerpt: 'Working papers, conference talks, recorded presentations, and teaching materials.'
  },
  'about/index.html': {
    kind: 'About the lab',
    title: 'About',
    excerpt: 'An applied research and design practice at the intersection of identity, learning, and design. Team, affiliations, and what the lab is and isn\'t.'
  },
  'get-started/index.html': {
    kind: 'Correspondence',
    title: 'Write to the lab',
    excerpt: 'For citation, collaboration, practitioner inquiries, and pushback. The lab is small and replies within a week.'
  },

  // Field notes
  'notes/discipline-specific-or-universal.html': {
    kind: 'Field note · 2026-05-12',
    title: 'Discipline-specific or universal?',
    excerpt: "RQ 5 isn't theoretical — it's a daily question."
  },
  'notes/ai-as-mirror.html': {
    kind: 'Field note · 2026-05-05',
    title: 'AI as mirror, not advisor',
    excerpt: 'The design choice in NBD to use AI for reflection-surfacing rather than recommendation.'
  },
  'notes/ninety-minute-constraint.html': {
    kind: 'Field note · 2026-04-22',
    title: 'The 90-minute constraint',
    excerpt: "Why NBD is 90 minutes — and why that's pedagogical, not logistical."
  },
  'notes/what-studios-know-about-reflection.html': {
    kind: 'Field note · 2026-04-08',
    title: 'What architecture studios know about reflection',
    excerpt: 'Critique-as-reflection, ported from design education to career deliberation.'
  },
  'notes/compression-as-method.html': {
    kind: 'Field note · 2026-03-25',
    title: 'Compression as a method',
    excerpt: "A method that keeps showing up across the lab's projects, often unannounced."
  },
  'notes/maps-over-lists.html': {
    kind: 'Field note · 2026-03-11',
    title: 'Maps over lists',
    excerpt: "A pattern that has shown up independently in two of the lab's projects."
  },
  'notes/research-cycles-not-curricula.html': {
    kind: 'Field note · 2026-02-26',
    title: 'Research cycles, not curricula',
    excerpt: 'What changes when you treat teaching as data collection.'
  },
  'notes/environments-not-advice.html': {
    kind: 'Field note · 2026-02-12',
    title: 'Environments, not advice',
    excerpt: "The lab's design ethic, and what it means in practice."
  },
  'notes/throughput-vs-understanding.html': {
    kind: 'Field note · 2026-01-29',
    title: 'Throughput vs. understanding',
    excerpt: 'The institutional design problem the lab is responding to.'
  },
  'notes/career-development-as-learning.html': {
    kind: 'Field note · 2026-01-15',
    title: 'Career development as learning',
    excerpt: "The lab's one substantive commitment — and what changes downstream when you accept it."
  },
};

/**
 * Match an href against the preview manifest.
 * Tries the last two path segments, then the last one.
 */
function lookupPreview(href) {
  if (!href) return null;
  if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;

  let pathname;
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin && !href.startsWith('/') && !href.match(/^[a-zA-Z]/)) return null;
    if (url.origin && url.origin !== window.location.origin && url.protocol !== 'file:') return null;
    pathname = url.pathname;
  } catch {
    return null;
  }

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return PAGE_PREVIEWS['index.html'];

  const lastTwo = parts.slice(-2).join('/');
  const lastOne = parts[parts.length - 1];

  return PAGE_PREVIEWS[lastTwo] || PAGE_PREVIEWS[lastOne] || null;
}

/**
 * The single preview card element, reused across all hovers.
 */
let previewEl = null;
let hoverTimer = null;
let hideTimer = null;
let activeLink = null;

function ensurePreviewEl() {
  if (previewEl) return previewEl;
  previewEl = document.createElement('div');
  previewEl.className = 'link-preview';
  previewEl.setAttribute('role', 'tooltip');
  previewEl.setAttribute('aria-hidden', 'true');
  previewEl.innerHTML =
    '<div class="link-preview__kind"></div>' +
    '<div class="link-preview__title"></div>' +
    '<div class="link-preview__excerpt"></div>';
  document.body.appendChild(previewEl);

  // If the cursor moves onto the preview itself, keep it open
  previewEl.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  previewEl.addEventListener('mouseleave', () => scheduleHide(120));
  return previewEl;
}

function positionPreview(link) {
  const el = ensurePreviewEl();
  const linkRect = link.getBoundingClientRect();
  const previewRect = el.getBoundingClientRect();
  const padding = 12;
  const arrowOffset = 14;

  // Horizontal: center on link, then clamp to viewport
  let left = linkRect.left + (linkRect.width / 2) - (previewRect.width / 2);
  left = Math.max(padding, Math.min(left, window.innerWidth - previewRect.width - padding));

  // Where does the arrow point — relative to the preview
  const arrowX = Math.max(arrowOffset, Math.min(
    linkRect.left + (linkRect.width / 2) - left,
    previewRect.width - arrowOffset
  ));

  // Vertical: prefer below the link; flip above if not enough space
  const spaceBelow = window.innerHeight - linkRect.bottom;
  const spaceAbove = linkRect.top;
  const showAbove = spaceBelow < previewRect.height + 24 && spaceAbove > previewRect.height + 24;

  let top;
  if (showAbove) {
    top = linkRect.top + window.scrollY - previewRect.height - 10;
    el.classList.add('is-above');
  } else {
    top = linkRect.bottom + window.scrollY + 10;
    el.classList.remove('is-above');
  }

  el.style.left = (left + window.scrollX) + 'px';
  el.style.top = top + 'px';
  el.style.setProperty('--arrow-x', arrowX + 'px');
}

function showPreview(link, preview) {
  const el = ensurePreviewEl();
  el.querySelector('.link-preview__kind').textContent = preview.kind || '';
  el.querySelector('.link-preview__title').textContent = preview.title || '';
  el.querySelector('.link-preview__excerpt').textContent = preview.excerpt || '';

  // Make it briefly invisible to measure, then position, then reveal
  el.style.visibility = 'hidden';
  el.style.left = '0px';
  el.style.top = '0px';
  el.classList.remove('is-above');

  // Wait a frame so the DOM measures the new content
  requestAnimationFrame(() => {
    positionPreview(link);
    el.style.visibility = '';
    el.setAttribute('aria-hidden', 'false');
    el.classList.add('is-visible');
  });
}

function hidePreview() {
  if (!previewEl) return;
  previewEl.classList.remove('is-visible');
  previewEl.setAttribute('aria-hidden', 'true');
  activeLink = null;
}

function scheduleHide(delay) {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hidePreview, delay);
}

function initLinkPreviews() {
  // Touch devices: bail out — hover doesn't translate
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

  document.body.addEventListener('mouseover', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    // Skip nav links — they're already obvious destinations
    if (link.closest('.site-nav')) return;
    // Skip the link if it's inside the preview itself
    if (link.closest('.link-preview')) return;

    const href = link.getAttribute('href');
    const preview = lookupPreview(href);
    if (!preview) return;

    if (link === activeLink) {
      clearTimeout(hideTimer);
      return;
    }

    activeLink = link;
    clearTimeout(hoverTimer);
    clearTimeout(hideTimer);

    hoverTimer = setTimeout(() => {
      showPreview(link, preview);
    }, 380); // delay to avoid drive-by hover triggers
  });

  document.body.addEventListener('mouseout', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    if (link !== activeLink) return;
    // If the cursor is moving onto the preview, ignore
    const related = e.relatedTarget;
    if (related && related.closest && related.closest('.link-preview')) return;

    clearTimeout(hoverTimer);
    scheduleHide(180);
  });

  // Dismiss on scroll or click
  window.addEventListener('scroll', () => {
    if (previewEl && previewEl.classList.contains('is-visible')) {
      hidePreview();
    }
  }, { passive: true });

  document.addEventListener('click', (e) => {
    if (previewEl && !e.target.closest('.link-preview')) hidePreview();
  });

  // Hide on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hidePreview();
  });
}

// ========== INIT ==========

document.addEventListener('DOMContentLoaded', function () {
  document.body.classList.add('js-loaded');
  initActiveNavLink();
  initWorkFilters();
  initSmoothScroll();
  initLinkPreviews();
  initHeroAnimation();
});
