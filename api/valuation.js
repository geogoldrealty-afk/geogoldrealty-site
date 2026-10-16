const unavailable = 'An automatic estimate is not available right now. John can prepare a custom CMA for your home—use the contact button below.';
const text = value => typeof value === 'string' ? value.trim() : '';
const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;

export function validateAddress(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Enter your property address.');
  const street = text(input.street), city = text(input.city), zip = text(input.zip);
  if (!street || street.length > 200 || !/\d/.test(street) || !city || city.length > 80 || !/^0[78]\d{3}$/.test(zip)) throw new Error('Enter a New Jersey street address, city, and five-digit ZIP code.');
  return { street, city, zip };
}

export function publicValuation(payload, requested) {
  const homes = payload?.property;
  if (!Array.isArray(homes) || homes.length !== 1) return null;
  const home = homes[0], amount = positive(home.avm?.amount?.value);
  const address = home.address || {};
  // Never attach an estimate for a different ZIP or an ambiguous match.
  if (!amount || address.countrySubd?.toUpperCase() !== 'NJ' || address.postal1 !== requested.zip || !address.line1 || address.matchCode !== 'ExaStr') return null;
  const low = positive(home.avm?.amount?.low), high = positive(home.avm?.amount?.high);
  const validRange = low && high && low <= amount && high >= amount;
  const date = text(home.avm?.eventDate);
  return { address: text(address.oneLine) || [address.line1, address.line2].filter(Boolean).join(', '), amount, low: validRange ? low : null, high: validRange ? high : null, beds: positive(home.building?.rooms?.beds), baths: positive(home.building?.rooms?.bathsTotal), squareFeet: positive(home.building?.size?.livingsize), source: 'ATTOM', asOf: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, retrievedAt: new Date().toISOString() };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const origin = req.headers.origin;
  const expected = 'https://' + req.headers.host;
  if (origin && origin !== expected && !(process.env.NODE_ENV !== 'production' && origin === 'http://' + req.headers.host && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))) return res.status(403).json({ error: 'Invalid request origin.' });
  let address;
  try { address = validateAddress(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); }
  catch { return res.status(400).json({ error: 'Enter a New Jersey street address, city, and five-digit ZIP code.' }); }
  // Disabled until an owner-approved plan permits public display of AVM values.
  if (process.env.VALUATION_PROVIDER !== 'attom' || process.env.VALUATION_ENABLED !== 'true' || !process.env.ATTOM_API_KEY) return res.status(503).json({ error: unavailable });
  try {
    const url = new URL('https://api.gateway.attomdata.com/propertyapi/v1.0.0/attomavm/detail');
    url.searchParams.set('address1', address.street);
    url.searchParams.set('address2', address.city + ', NJ ' + address.zip);
    const upstream = await fetch(url, { headers: { Accept: 'application/json', apikey: process.env.ATTOM_API_KEY }, redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!upstream.ok) return res.status(502).json({ error: unavailable });
    const valuation = publicValuation(await upstream.json(), address);
    if (!valuation) return res.status(404).json({ error: 'We could not find a reliable automatic estimate for that exact address. John can prepare a custom CMA—use the contact button below.' });
    return res.status(200).json({ valuation });
  } catch { return res.status(502).json({ error: unavailable }); }
}
