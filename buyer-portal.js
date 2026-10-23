const auth = document.querySelector('#portal-auth');
const state = { clerk: null };

function setMessage(message) {
  if (!auth) return;
  auth.replaceChildren(Object.assign(document.createElement('p'), { textContent: message }));
}

async function start() {
  try {
    const response = await fetch('/api/portal/config', { cache: 'no-store' });
    const config = await response.json();
    if (!response.ok || !config.ok || !config.publishableKey) throw new Error('Authentication is not ready.');

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.clerkPublishableKey = config.publishableKey;
    script.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@6/dist/clerk.browser.js';
    await new Promise((resolve, reject) => {
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.append(script);
    });
    await window.Clerk.load();
    state.clerk = window.Clerk;
    const returnUrl = `${location.origin}/buyer-portal.html`;
    if (state.clerk.user) {
      const name = state.clerk.user.firstName || state.clerk.user.primaryEmailAddress?.emailAddress || 'Buyer';
      auth.replaceChildren(Object.assign(document.createElement('p'), { textContent: `Signed in as ${name}. Your secure dashboard is being prepared.` }));
      return;
    }
    document.querySelector('[data-portal-sign-in]')?.addEventListener('click', () => state.clerk.openSignIn({ afterSignInUrl: returnUrl, afterSignUpUrl: returnUrl }));
    document.querySelector('[data-portal-sign-up]')?.addEventListener('click', () => state.clerk.openSignUp({ afterSignInUrl: returnUrl, afterSignUpUrl: returnUrl }));
  } catch {
    setMessage('Secure sign-in is finishing setup. Please try again shortly.');
  }
}

start();
