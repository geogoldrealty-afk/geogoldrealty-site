const auth = document.querySelector('#portal-auth');
const state = { clerk: null, intentInProgress: false };

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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
}

function portalLink(item) {
  return '/property.html?mls=' + encodeURIComponent(item.mlsNumber) + '&market=' + encodeURIComponent(item.market);
}

function collectionOptions(item, collections) {
  return '<option value="">No collection</option>' + collections.map(collection => '<option value="' + escapeHtml(collection.id) + '"' + (Number(item.collectionId) === Number(collection.id) ? ' selected' : '') + '>' + escapeHtml(collection.name) + '</option>').join('');
}

function updateCounts(dashboard) {
  document.querySelector('#portal-saved-count').textContent = dashboard.saved.length;
  document.querySelector('#portal-collection-count').textContent = dashboard.collections.length;
  document.querySelector('#portal-tour-count').textContent = dashboard.tours.length;
}

async function sendAction(headers, body) {
  const response = await fetch('/api/portal/actions', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Your Buyer Portal change could not be saved.');
  return result;
}

function renderDashboard(dashboard, headers) {
  const savedList = document.querySelector('#portal-saved-list');
  if (savedList) {
    savedList.innerHTML = dashboard.saved.length
      ? dashboard.saved.map(item => '<p><a href="' + portalLink(item) + '">MLS #' + escapeHtml(item.mlsNumber) + '</a><br><small>' + escapeHtml(item.note || 'No private note yet.') + (item.rating ? ' · Rating: ' + escapeHtml(item.rating) + '/5' : '') + '</small><br><label><small>Collection</small><select data-collection-home="' + escapeHtml(item.mlsNumber) + '" data-market="' + escapeHtml(item.market) + '">' + collectionOptions(item, dashboard.collections) + '</select></label><br><button class="button button-outline" data-edit-home="' + escapeHtml(item.mlsNumber) + '" data-market="' + escapeHtml(item.market) + '">Edit note / rating</button></p>').join('')
      : '<div><div class="portal-empty__icon" aria-hidden="true">♡</div><h3>Start your shortlist</h3><p>Save a property from a property page to see it here.</p><a class="button button-dark" href="/property-search.html?market=buy">Browse homes</a></div>';
    savedList.querySelectorAll('[data-edit-home]').forEach(button => button.addEventListener('click', async () => {
      const item = dashboard.saved.find(saved => saved.mlsNumber === button.dataset.editHome && saved.market === button.dataset.market);
      const note = window.prompt('Private note for this home:', item?.note || '');
      if (note === null) return;
      const rating = window.prompt('Your rating from 1 to 5 (optional):', item?.rating || '');
      if (rating === null) return;
      try {
        await sendAction(headers, { action: 'save', mlsNumber: button.dataset.editHome, market: button.dataset.market, note, rating });
        location.reload();
      } catch {
        window.alert('Your note could not be saved. Please try again.');
      }
    }));
  }

  savedList?.querySelectorAll('[data-collection-home]').forEach(select => select.addEventListener('change', async () => {
    const item = dashboard.saved.find(saved => saved.mlsNumber === select.dataset.collectionHome && saved.market === select.dataset.market);
    try {
      await sendAction(headers, {
        action: 'save',
        mlsNumber: select.dataset.collectionHome,
        market: select.dataset.market,
        collectionId: select.value || null,
        note: item?.note || '',
        rating: item?.rating || '',
      });
      location.reload();
    } catch {
      window.alert('That collection could not be updated. Please try again.');
    }
  }));

  const collectionList = document.querySelector('#portal-collection-list');
  if (collectionList) {
    collectionList.innerHTML = dashboard.collections.length
      ? dashboard.collections.map(item => '<p><strong>' + escapeHtml(item.name) + '</strong></p>').join('')
      : '<p><small>Create a collection to group saved homes.</small></p>';
  }

  const recentList = document.querySelector('#portal-recent-list');
  if (recentList) {
    recentList.innerHTML = dashboard.recent.length
      ? dashboard.recent.map(item => '<p><a href="' + portalLink(item) + '">MLS #' + escapeHtml(item.mlsNumber) + '</a><br><small>Viewed recently</small></p>').join('')
      : '<div><div class="portal-empty__icon" aria-hidden="true">◷</div><p>Your recently viewed listings will appear here.</p></div>';
  }

  const tourList = document.querySelector('#portal-tour-list');
  if (tourList) {
    tourList.innerHTML = dashboard.tours.length
      ? dashboard.tours.map(item => {
          const notification = item.notificationStatus === 'sent'
            ? ' · sent to Geo Gold Realty'
            : item.notificationStatus === 'pending'
              ? ' · saved; notification pending'
              : '';
          return '<p><a href="' + portalLink(item) + '">MLS #' + escapeHtml(item.mlsNumber) + '</a><br><small>' + escapeHtml(item.requestType.replace('-', ' ')) + ' · ' + escapeHtml(item.status) + escapeHtml(notification) + '</small><br><button class="button button-outline" data-reschedule-tour="' + escapeHtml(item.id) + '">Request a different time</button></p>';
        }).join('')
      : '<p><small>Your showing requests will appear here.</small></p>';
    tourList.querySelectorAll('[data-reschedule-tour]').forEach(button => button.addEventListener('click', async () => {
      const preferredAt = window.prompt('What new date and time would you prefer?');
      if (preferredAt === null || !preferredAt.trim()) return;
      const contactConsent = window.confirm('Geo Gold Realty will receive your account name and email to help reschedule this tour. Continue?');
      if (!contactConsent) return;
      try {
        await sendAction(headers, { action: 'reschedule', id: button.dataset.rescheduleTour, preferredAt, contactConsent: true });
        location.reload();
      } catch (error) {
        window.alert(error?.message || 'That change could not be requested. Please try again.');
      }
    }));
  }
}

function clerkDomainFromKey(publishableKey) {
  const encodedDomain = publishableKey.split('_')[2];
  if (!encodedDomain) throw new Error('Authentication configuration is invalid.');
  return atob(encodedDomain).replace(/\$$/, '');
}

async function getDashboard(headers) {
  const response = await fetch('/api/portal/state', { headers });
  if (!response.ok) throw new Error('Your dashboard is not ready.');
  return (await response.json()).dashboard;
}

async function start() {
  if (window.__geoGoldBuyerPortalStarted) return;
  window.__geoGoldBuyerPortalStarted = true;
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
    const returnUrl = location.href;

    if (state.clerk.user) {
      const name = state.clerk.user.firstName || state.clerk.user.primaryEmailAddress?.emailAddress || 'Buyer';
      const token = await state.clerk.session?.getToken();
      const headers = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
      const intent = new URLSearchParams(location.search);
      const isTour = intent.has('tour');
      const isOpenHouse = intent.has('openHouse');
      const mlsNumber = intent.get('save') || intent.get('tour') || intent.get('openHouse');
      const market = intent.get('market') || 'buy';
      if (mlsNumber && /^[0-9]{5,12}$/.test(mlsNumber) && !state.intentInProgress) {
        state.intentInProgress = true;
        const isShowingRequest = isTour || isOpenHouse;
        const requestLabel = isOpenHouse ? 'open house' : 'tour';
        auth.replaceChildren(Object.assign(document.createElement('p'), { textContent: `Signed in as ${name}. Complete your ${requestLabel} request below.` }));
        await new Promise(resolve => window.setTimeout(resolve, 0));
        const preferredAt = isShowingRequest ? window.prompt('What date and time would you prefer for this ' + requestLabel + '?\nExample: November 1, 2026 at 11:00 AM') : '';
        const contactConsent = isShowingRequest && preferredAt !== null
          ? window.confirm('Geo Gold Realty will receive your account name and email to follow up about this ' + requestLabel + '. Continue?')
          : false;

        if (isShowingRequest && preferredAt !== null && contactConsent && (!preferredAt.trim() || Number.isNaN(new Date(preferredAt).getTime()))) {
          window.alert('Enter a date and time such as November 1, 2026 at 11:00 AM.');
          history.replaceState({}, '', '/buyer-portal.html');
        } else {
          try {
            if (!isShowingRequest || (preferredAt !== null && contactConsent)) {
              await sendAction(headers, isShowingRequest
                ? { action: 'tour', mlsNumber, market, requestType: isOpenHouse ? 'open-house' : 'private-tour', preferredAt, contactConsent: true }
                : { action: 'save', mlsNumber, market });
              if (isShowingRequest) window.alert('Your request was submitted.');
            }
          } catch (error) {
            setMessage(error?.message || 'Your request could not be submitted. Please try again from the property page.');
            return;
          } finally {
            state.intentInProgress = false;
          }
          history.replaceState({}, '', '/buyer-portal.html');
        }
        state.intentInProgress = false;
      }
      const dashboard = await getDashboard(headers);
      updateCounts(dashboard);
      renderDashboard(dashboard, headers);
      auth.replaceChildren(Object.assign(document.createElement('p'), { textContent: `Signed in as ${name}. Your secure dashboard is ready.` }));
      const createCollection = document.querySelector('[data-create-collection]');
      createCollection.disabled = false;
      createCollection.addEventListener('click', async () => {
        const name = window.prompt('Name this collection (for example, Top Contenders):');
        if (!name?.trim()) return;
        createCollection.disabled = true;
        try {
          await sendAction(headers, { action: 'collection', name });
          location.reload();
        } catch {
          window.alert('That collection could not be created. Please try again.');
        } finally {
          createCollection.disabled = false;
        }
      });
      return;
    }

    document.querySelector('[data-portal-sign-in]')?.addEventListener('click', () => {
      state.clerk.openSignIn({ fallbackRedirectUrl: returnUrl, signUpFallbackRedirectUrl: returnUrl });
    });
    document.querySelector('[data-portal-sign-up]')?.addEventListener('click', () => {
      state.clerk.openSignUp({ fallbackRedirectUrl: returnUrl, signUpFallbackRedirectUrl: returnUrl });
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
