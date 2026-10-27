function clerkDomainFromKey(publishableKey) {
  const encodedDomain = String(publishableKey || '').split('_')[2];
  if (!encodedDomain) return '';
  try { return atob(encodedDomain).replace(/\$$/, ''); } catch { return ''; }
}

function signInOptions() {
  return {
    fallbackRedirectUrl: location.href,
    signUpFallbackRedirectUrl: location.href,
  };
}

async function loadClerkForHeader() {
  const link = document.querySelector('[data-buyer-login]');
  if (!link) return;

  let clerk = null;
  let signInRequested = false;
  const openSignIn = () => {
    if (!clerk || typeof clerk.openSignIn !== 'function') return false;
    signInRequested = false;
    link.removeAttribute('aria-busy');
    link.textContent = 'Login';
    clerk.openSignIn(signInOptions());
    return true;
  };

  // Attach this immediately. The original destination remains useful without
  // JavaScript, while a JavaScript-enabled visitor never gets redirected during
  // the asynchronous Clerk loader.
  link.addEventListener('click', event => {
    event.preventDefault();
    if (openSignIn()) return;
    signInRequested = true;
    link.textContent = 'Opening sign in…';
    link.setAttribute('aria-busy', 'true');
  });

  try {
    const response = await fetch('/api/portal/config', { cache: 'no-store' });
    const config = await response.json();
    if (!response.ok || !config.ok || !config.publishableKey) throw new Error('Missing public sign-in configuration.');

    const domain = clerkDomainFromKey(config.publishableKey);
    if (!domain) throw new Error('Invalid public sign-in configuration.');

    const loadScript = (src, attributes = {}) => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      Object.entries(attributes).forEach(([name, value]) => script.setAttribute(name, value));
      script.src = src;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.append(script);
    });

    await loadScript('https://' + domain + '/npm/@clerk/ui@1/dist/ui.browser.js');
    await loadScript('https://' + domain + '/npm/@clerk/clerk-js@6/dist/clerk.browser.js', {
      'data-clerk-publishable-key': config.publishableKey,
    });

    const ClerkClient = window.Clerk;
    clerk = typeof ClerkClient === 'function' ? new ClerkClient(config.publishableKey) : ClerkClient;
    await clerk?.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });

    const user = clerk?.user;
    const name = user?.firstName || user?.primaryEmailAddress?.emailAddress;
    if (name) {
      link.textContent = 'Hi, ' + String(name).slice(0, 24);
      link.removeAttribute('aria-busy');
      link.setAttribute('aria-label', 'Open your Buyer Portal');
      link.addEventListener('click', () => { location.href = '/buyer-portal.html'; });
    } else if (!openSignIn()) {
      link.textContent = 'Login';
      link.removeAttribute('aria-busy');
    }
  } catch {
    link.textContent = 'Login unavailable';
    link.removeAttribute('aria-busy');
    link.setAttribute('aria-label', 'Login is temporarily unavailable');
  }
}

loadClerkForHeader();
