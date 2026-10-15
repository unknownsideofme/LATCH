// ./latch Landing Page Interactive Logic

function initLandingApp() {
  // 1. Mobile Navigation Toggle
  const mobileToggle = document.getElementById('mobile-toggle');
  const primaryNav = document.getElementById('primary-nav');

  if (mobileToggle && primaryNav) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = primaryNav.classList.toggle('is-open');
      mobileToggle.setAttribute('aria-expanded', isOpen);
    });

    // Close menu when clicking outside or on a link
    document.addEventListener('click', (e) => {
      if (!mobileToggle.contains(e.target) && !primaryNav.contains(e.target)) {
        primaryNav.classList.remove('is-open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      }
    });

    primaryNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        primaryNav.classList.remove('is-open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // 2. Terminal Copy to Clipboard
  const copyBtn = document.getElementById('copy-btn');
  const copyText = document.getElementById('copy-text');
  const terminalCommands = `npm install -g @latch/cli\nlatch login\nlatch init\nlatch serve`;

  if (copyBtn && copyText) {
    copyBtn.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(terminalCommands);
        } else {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = terminalCommands;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }

        const originalText = copyText.textContent;
        copyText.textContent = 'Copied!';
        copyBtn.style.borderColor = 'var(--green)';
        copyBtn.style.color = 'var(--green)';

        setTimeout(() => {
          copyText.textContent = originalText;
          copyBtn.style.borderColor = '';
          copyBtn.style.color = '';
        }, 2200);
      } catch (err) {
        console.error('Failed to copy', err);
      }
    });
  }

  // 3. Live Console Activity Stream Generator
  const consoleStream = document.getElementById('console-stream');
  if (consoleStream) {
    const liveEvents = [
      { time: '10:11', icon: 'Claude.png', name: 'Claude Code', actionClass: 'c-action-locked', action: 'locked', path: 'src/api/auth.ts', dur: '1s' },
      { time: '10:12', icon: 'cursor.png', name: 'Cursor', actionClass: 'c-action-editing', action: 'editing', path: 'src/components/Header.tsx', dur: 'now' },
      { time: '10:14', icon: 'github-copilot.png', name: 'Copilot', actionClass: 'c-action-synced', action: 'synced', path: 'lib/db/pool.ts', dur: '4s' },
      { time: '10:15', icon: 'Codex.png', name: 'Codex', actionClass: 'c-action-running', action: 'running', path: 'cargo check', dur: '8s' },
      { time: '10:17', icon: 'Claude.png', name: 'Claude Code', actionClass: 'c-action-synced', action: 'synced', path: 'patch propagated to 3 peers', dur: 'now' },
      { time: '10:19', icon: 'cursor.png', name: 'Cursor', actionClass: 'c-action-locked', action: 'locked', path: 'src/schema.graphql', dur: '3s' }
    ];

    let eventIdx = 0;
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reducedMotion) {
      const intervalId = setInterval(() => {
        const nextEvt = liveEvents[eventIdx % liveEvents.length];
        eventIdx++;

        const newRow = document.createElement('div');
        newRow.className = 'console-row';
        newRow.style.opacity = '0';
        newRow.style.transform = 'translateY(-6px)';
        newRow.style.transition = 'all 240ms ease';
        newRow.innerHTML = `
          <span class="c-time">${nextEvt.time}</span>
          <img src="${nextEvt.icon}" alt="" class="c-icon" />
          <span class="c-name">${nextEvt.name}</span>
          <span class="${nextEvt.actionClass}">${nextEvt.action}</span>
          <span class="c-path">${nextEvt.path}</span>
          <span class="c-dur">${nextEvt.dur}</span>
        `;

        consoleStream.insertBefore(newRow, consoleStream.firstChild);
        
        // Trigger reflow & fade in
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            newRow.style.opacity = '1';
            newRow.style.transform = 'translateY(0)';
          });
        }

        // Keep maximum 5 rows visible
        if (consoleStream.children.length > 5) {
          const lastChild = consoleStream.lastElementChild;
          if (lastChild) {
            consoleStream.removeChild(lastChild);
          }
        }
      }, 4200);
      return intervalId;
    }
  }
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && window.location) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLandingApp);
  } else {
    initLandingApp();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initLandingApp,
  };
}
