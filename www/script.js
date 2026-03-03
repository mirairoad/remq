/**
 * remq docs site — shared script
 * Bar chart animation, sidebar active link, scroll-in animations
 */
// deno-lint-ignore-file
(function () {
  'use strict';

  // §17 Bar chart: animate bar width on scroll into view
  function initBarChart() {
    const bars = document.querySelectorAll('.bar-fill[data-width]');
    if (!bars.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const w = el.getAttribute('data-width');
          if (w != null) el.style.width = w + '%';
        });
      },
      { threshold: 0.2, rootMargin: '0px' }
    );

    bars.forEach((bar) => observer.observe(bar));
  }

  // §19 Scroll-in: add .visible to .anim when in view
  function initScrollAnim() {
    const anims = document.querySelectorAll('.anim');
    if (!anims.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    anims.forEach((el) => observer.observe(el));
  }

  // §11 Docs sidebar: set active link based on scroll position
  function initSidebarActive() {
    const sidebar = document.querySelector('.docs-sidebar');
    if (!sidebar) return;

    const links = sidebar.querySelectorAll('.menu-list a[href^="#"]');
    const sections = [];

    links.forEach((a) => {
      const id = a.getAttribute('href').slice(1);
      const section = document.getElementById(id);
      if (section) sections.push({ id, link: a, section });
    });

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          links.forEach((l) => l.classList.remove('is-active'));
          const active = sidebar.querySelector('a[href="#' + id + '"]');
          if (active) active.classList.add('is-active');
        });
      },
      { threshold: 0.2, rootMargin: '-80px 0px -60% 0px' }
    );

    sections.forEach(({ section }) => observer.observe(section));

    // Set initial active from hash
    const hash = window.location.hash.slice(1);
    if (hash) {
      links.forEach((l) => {
        l.classList.toggle('is-active', l.getAttribute('href') === '#' + hash);
      });
    } else if (sections[0]) {
      sections[0].link.classList.add('is-active');
    }
  }

  function init() {
    initBarChart();
    initScrollAnim();
    initSidebarActive();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
