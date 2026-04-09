// OCPMS — Smooth scroll and UI enhancements
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

document.addEventListener('DOMContentLoaded', function () {
  var greet = document.getElementById('ocpms-user-greet');
  if (greet) {
    var name = sessionStorage.getItem('ocpms_user_name');
    if (name) {
      greet.hidden = false;
      greet.textContent = '';
      greet.appendChild(document.createTextNode('Signed in as ' + name + '. '));
      var a = document.createElement('a');
      a.href = 'logout.html';
      a.textContent = 'Sign out';
      greet.appendChild(a);
    }
  }

  // Theme switcher (shared across all pages)
  var THEME_KEY = 'ocpms_theme';
  var themes = ['night', 'sunset', 'forest'];
  var root = document.documentElement;
  var stored = localStorage.getItem(THEME_KEY);
  var current = themes.indexOf(stored) >= 0 ? stored : 'night';
  root.setAttribute('data-theme', current);

  var nav = document.querySelector('.nav');
  if (nav) {
    var wrap = document.createElement('div');
    wrap.className = 'theme-switch';
    wrap.setAttribute('aria-label', 'Theme switcher');
    var label = document.createElement('span');
    label.className = 'theme-switch__label';
    label.textContent = 'Theme';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-switch__btn';
    btn.title = 'Change website theme';

    function pretty(t) {
      if (t === 'night') return 'Night';
      if (t === 'sunset') return 'Sunset';
      return 'Forest';
    }
    function applyTheme(t) {
      root.setAttribute('data-theme', t);
      btn.textContent = pretty(t);
      btn.setAttribute('aria-label', 'Current theme: ' + pretty(t));
      localStorage.setItem(THEME_KEY, t);
    }
    applyTheme(current);
    btn.addEventListener('click', function () {
      var idx = themes.indexOf(root.getAttribute('data-theme'));
      var next = themes[(idx + 1) % themes.length];
      applyTheme(next);
    });

    wrap.appendChild(label);
    wrap.appendChild(btn);
    nav.appendChild(wrap);
  }

  // Scroll reveal animation for sections/cards
  var revealTargets = document.querySelectorAll(
    '.page-section, .feature-card, .order-card, .benefit-item, .portal-link-card, .tracking-history__item'
  );
  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-in');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealTargets.forEach(function (el) {
      el.classList.add('reveal-on-scroll');
      obs.observe(el);
    });
  } else {
    revealTargets.forEach(function (el) {
      el.classList.add('reveal-in');
    });
  }
});
