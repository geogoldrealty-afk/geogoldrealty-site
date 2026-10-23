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

    const ClerkClient = window.Clerk;
    if (!ClerkClient) throw new Error('Authentication service is unavailable.');
    state.clerk = typeof ClerkClient === 'function' ? new ClerkClient(config.publishableKey) : ClerkClient;
    await state.clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
    const returnUrl = `${location.origin}/buyer-portal.html`;

    if (state.clerk.user) {
      const name = state.clerk.user.firstName || state.clerk.user.primaryEmailAddress?.emailAddress || 'Buyer';
      const token = await state.clerk.session?.getToken();
      const headers = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
      const dashboardResponse = await fetch('/api/portal/state', { headers });
      if (!dashboardResponse.ok) throw new Error('Your dashboard is not ready.');
      const dashboard = (await dashboardResponse.json()).dashboard;
      document.querySelector('#portal-saved-count').textContent = dashboard.saved.length;
      document.querySelector('#portal-collection-count').textContent = dashboard.collections.length;
      document.querySelector('#portal-tour-count').textContent = dashboard.tours.length;
      auth.replaceChildren(Object.assign(document.createElement('p'), { textContent: `Signed in as ${name}. Your secure dashboard is ready.` }));
      const createCollection = document.querySelector('[data-create-collection]');
      createCollection.disabled = false;
      createCollection.addEventListener('click', async () => {
        const name = window.prompt('Name this collection (for example, Top Contenders):');
        if (!name?.trim()) return;
        createCollection.disabled = true;
        try {
          const response = await fetch('/api/portal/actions', { method: 'POST', headers, body: JSON.stringify({ action: 'collection', name }) });
          if (!response.ok) throw new Error('Collection unavailable.');
          document.querySelector('#portal-collection-count').textContent = String(dashboard.collections.length + 1);
        } finally {
          createCollection.disabled = false;
        }
      }, { once: true });
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
