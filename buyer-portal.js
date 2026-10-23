const auth = document.querySelector('#portal-auth');
const state = { clerk: null };

function setMessage(message) {
  if (!auth) return;
  auth.replaceChildren(Object.assign(document.createElement('p'), { textContent: message }));
}

function loadScript(src, attributes = {}) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    Object.entries(attributes).forEach(([name, value]) => script.setAttribute(name, value));
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error('Authentication service failed to load.')), { once: true });
    script.src = src;
    document.head.append(script);
  });
}

function clerkDomainFromKey(publishableKey) {
  const encodedDomain = publishableKey.split('_')[2];
  if (!encodedDomain) throw new Error('Authentication configuration is invalid.');
  return atob(encodedDomain).replace(/\$$/, '');
}

async function start() {
  try {
    const response = await fetch('/api/portal/config', { cache: 'no-store' });
    const config = await response.json();
    if (!response.ok || !config.ok || !config.publishableKey) throw new Error('Authentication is not ready.');

    const clerkDomain = clerkDomainFromKey(config.publishableKey);
    await loadScript(`https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`);
    await loadScript(`https://${clerkDomain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, {
      'data-clerk-publishable-key': config.publishableKey,
    });

    await window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
    state.clerk = window.Clerk;
    const returnUrl = `${location.origin}/buyer-portal.html`;

    if (state.clerk.user) {
      const name = state.clerk.user.firstName || state.clerk.user.primaryEmailAddress?.emailAddress || 'Buyer';
      auth.replaceChildren(Object.assign(document.createElement('p'), { textContent: `Signed in as ${name}. Your secure dashboard is being prepared.` }));
      return;
    }

    document.querySelector('[data-portal-sign-in]')?.addEventListener('click', () => {
      state.clerk.openSignIn({ afterSignInUrl: returnUrl, afterSignUpUrl: returnUrl });
    });
    document.querySelector('[data-portal-sign-up]')?.addEventListener('click', () => {
      state.clerk.openSignUp({ afterSignInUrl: returnUrl, afterSignUpUrl: returnUrl });
    });
  } catch {
    setMessage('Secure sign-in is finishing setup. Please try again shortly.');
  }
}

if (document.readyState === 'complete') {
  start();
} else {
  window.addEventListener('load', start, { once: true });
}
