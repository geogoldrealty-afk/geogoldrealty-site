function clerkDomainFromKey(publishableKey) {
  const encodedDomain = String(publishableKey || '').split('_')[2];
  if (!encodedDomain) return '';
  try { return atob(encodedDomain).replace(/\$$/, ''); } catch { return ''; }
}

async function loadClerkForHeader() {
  const link = document.querySelector('[data-buyer-login]');
  if (!link) return;
  link.href = '/buyer-portal.html';
  try {
    const response = await fetch('/api/portal/config', { cache: 'no-store' });
    const config = await response.json();
    if (!response.ok || !config.ok || !config.publishableKey) return;
    const domain = clerkDomainFromKey(config.publishableKey);
    if (!domain) return;
    const loadScript = src => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = src;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.append(script);
    });
    await loadScript('https://' + domain + '/npm/@clerk/ui@1/dist/ui.browser.js');
    await loadScript('https://' + domain + '/npm/@clerk/clerk-js@6/dist/clerk.browser.js');
    const ClerkClient = window.Clerk;
    const clerk = typeof ClerkClient === 'function' ? new ClerkClient(config.publishableKey) : ClerkClient;
    await clerk?.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
    const user = clerk?.user;
    const name = user?.firstName || user?.primaryEmailAddress?.emailAddress;
    if (name) {
      link.textContent = 'Hi, ' + String(name).slice(0, 24);
      link.setAttribute('aria-label', 'Open your Buyer Portal');
    } else {
      link.addEventListener('click', event => {
        event.preventDefault();
        clerk.openSignIn({ fallbackRedirectUrl: location.href, signUpFallbackRedirectUrl: location.href });
      });
    }
  } catch {
    // The Buyer Portal remains available even if its optional header status cannot load.
  }
}

loadClerkForHeader();
