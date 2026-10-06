import sharp from 'sharp';
import { parseCompact, RetsSession, retsConfigFromEnv } from '../_lib/rets.js';
import { classifyError, correlationId, emitSafeDiagnostic } from '../_lib/idx-diagnostics.js';

export const config = { maxDuration: 30 };
const markets = new Set(['buy', 'rent']);
const validMls = (value) => /^[0-9]{5,12}$/.test(value || '') ? value : '';

function propertyType(row) {
  const type = row.SUBPROPTYPE || row.PROPTYPE || '';
  if (/condo/i.test(type)) return 'Condo';
  if (/town/i.test(type)) return 'Townhome';
  return type || 'Residential';
}
function publicListing(row, market) {
  const street = [row.STREETNUMDISPLAY, row.STREETNAME].filter(Boolean).join(' ');
  return { mlsNumber: row.LISTINGID, title: street || `${row.CITY || 'New Jersey'} home`, city: row.CITY || '', state: 'NJ', postalCode: row.POSTALCODE || '', price: Number(row.LISTPRICE || row.RENTPRICE || 0), beds: Number(row.BEDS || 0), baths: Number(row.BATHS || 0), propertyType: propertyType(row), market, status: row.LISTINGSTATUS || '', brokerName: row.LISTOFFICENAME || '', brokerContact: row.LISTOFFICEPHONE || '', isIdxListing: String(row.LISTOFFICEID || '') !== '5049', description: String(row.PUBLICREMARKS || '').slice(0, 4000), yearBuilt: String(row.YEARBUILT || ''), lotSize: String(row.LOTSIZE || row.LOTSQFT || ''), photos: [] };
}
async function photo(session, listingId, index) {
  try {
    const response = await session.request(session.capabilities.GetObject, { Resource: 'PROPERTY', Type: 'Photo', ID: `${listingId}:${index}`, Location: 0 });
    if (!response.headers.get('content-type')?.includes('image/')) return '';
    const source = Buffer.from(await response.arrayBuffer());
    const image = await sharp(source).resize(1200, 800, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 76 }).toBuffer();
    return `data:image/jpeg;base64,${image.toString('base64')}`;
  } catch { return ''; }
}
export default async function handler(request, response) {
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return response.status(405).json({ error: 'Method not allowed.' }); }
  const url = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
  const mlsNumber = validMls(url.searchParams.get('mls'));
  const market = markets.has(url.searchParams.get('market')) ? url.searchParams.get('market') : 'buy';
  if (!mlsNumber) return response.status(400).json({ error: 'A valid MLS number is required.' });
  const requestId = correlationId(); const began = Date.now();
  const diagnostic = { correlationId: requestId, environment: process.env.VERCEL_ENV || 'local', deployment: process.env.VERCEL_DEPLOYMENT_ID };
  const stage = (details) => Object.assign(diagnostic, details); let session;
  try {
    stage({ stage: 'config' }); session = new RetsSession({ ...retsConfigFromEnv(), onStage: stage }); await session.start();
    stage({ stage: 'search' });
    const body = await session.text('Search', { SearchType: 'PROPERTY', Class: market === 'rent' ? 'RNT' : 'RES', Query: `(LISTINGID=${mlsNumber})`, QueryType: 'DMQL2', Count: 1, Format: 'COMPACT-DECODED', Limit: 1, StandardNames: 0 });
    stage({ stage: 'compact-parsing' }); const row = parseCompact(body)[0];
    if (!row) return response.status(404).json({ error: 'This listing is no longer available.' });
    const listing = publicListing(row, market);
    for (let index = 0; index < 5; index += 1) { stage({ stage: 'photo-resize' }); const image = await photo(session, mlsNumber, index); if (!image) break; listing.photos.push(image); }
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600'); return response.status(200).json({ listing });
  } catch (error) {
    emitSafeDiagnostic({ ...diagnostic, elapsedMs: Date.now() - began, upstreamStatus: error?.status, retsReplyCode: error?.replyCode, errorCode: classifyError(error) });
    return response.status(502).json({ error: 'Property details could not load. Please try again.', correlationId: requestId });
  } finally { if (session) { stage({ stage: 'logout' }); await session.close(); } }
}
