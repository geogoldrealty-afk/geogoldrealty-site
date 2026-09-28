import sharp from 'sharp';
import { parseCompact, RetsSession, retsConfigFromEnv } from '../_lib/rets.js';

export const config = { maxDuration: 30 };

const counties = ['Bergen', 'Essex', 'Hudson', 'Passaic', 'Monmouth', 'Ocean'];
const allowedCounties = new Set(counties);
const allowedPropertyTypes = new Set(['Single Family', 'Condo', 'Townhome']);
const allowedSorts = new Set(['newest', 'price-asc', 'price-desc']);
const allowedMarkets = new Set(['buy', 'rent']);

function numberParam(value, minimum = 0) {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : null;
}

function dmqlValue(value) {
  return String(value).replace(/[^a-zA-Z0-9 .'-]/g, '').slice(0, 60);
}

function propertyType(row) {
  const type = row.SUBPROPTYPE || 'Single Family';
  if (/condo/i.test(type)) return 'Condo';
  if (/town/i.test(type)) return 'Townhome';
  return 'Single Family';
}

function mapListing(row, market) {
  const street = [row.STREETNUMDISPLAY, row.STREETNAME].filter(Boolean).join(' ');
  return {
    id: row.LISTINGID,
    mlsNumber: row.LISTINGID,
    title: street || `${row.CITY} home`,
    city: row.CITY,
    county: row.COUNTY,
    state: 'NJ',
    postalCode: row.POSTALCODE,
    price: Number(row.LISTPRICE || row.RENTPRICE || 0),
    beds: Number(row.BEDS || 0),
    baths: Number(row.BATHS || 0),
    propertyType: propertyType(row),
    market,
    status: row.LISTINGSTATUS,
    image: '',
    brokerName: row.LISTOFFICENAME,
    brokerContact: row.LISTOFFICEPHONE,
    updatedAt: row.LASTMODIFIED,
    details: { 'MLS number': row.LISTINGID, ZIP: row.POSTALCODE },
  };
}

async function addPhoto(session, listing) {
  try {
    const response = await session.request(session.capabilities.GetObject, {
      Resource: 'PROPERTY',
      Type: 'Photo',
      ID: `${listing.mlsNumber}:0`,
      Location: 0,
    });
    if (!response.headers.get('content-type')?.includes('image/')) return listing;
    const source = Buffer.from(await response.arrayBuffer());
    const image = await sharp(source).resize(900, 600, { fit: 'cover' }).jpeg({ quality: 72 }).toBuffer();
    return { ...listing, image: `data:image/jpeg;base64,${image.toString('base64')}` };
  } catch {
    return listing;
  }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const url = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
  const location = dmqlValue((url.searchParams.get('location') || '').trim()).toLowerCase();
  const countyValue = url.searchParams.get('county') || '';
  const typeValue = url.searchParams.get('propertyType') || '';
  const sortValue = url.searchParams.get('sort') || 'newest';
  const marketValue = url.searchParams.get('market') || 'buy';
  const county = allowedCounties.has(countyValue) ? countyValue : '';
  const requestedType = allowedPropertyTypes.has(typeValue) ? typeValue : '';
  const sort = allowedSorts.has(sortValue) ? sortValue : 'newest';
  const market = allowedMarkets.has(marketValue) ? marketValue : 'buy';
  const priceField = market === 'rent' ? 'RENTPRICE' : 'LISTPRICE';
  const featured = url.searchParams.get('featured') === '1';
  const days = Math.min(numberParam(url.searchParams.get('days'), 1) || 7, 14);
  const limit = Math.min(numberParam(url.searchParams.get('limit'), 1) || 6, 12);
  const minPrice = numberParam(url.searchParams.get('minPrice'));
  const maxPrice = numberParam(url.searchParams.get('maxPrice'));
  const beds = numberParam(url.searchParams.get('beds'));
  const baths = numberParam(url.searchParams.get('baths'));

  const terms = ['(LISTINGSTATUS=A)', `(COUNTY=${county || counties.join(',')})`];
  if (location) terms.push(/^\d{5}$/.test(location) ? `(POSTALCODE=${location}*)` : `(CITY=*${location}*)`);
  if (minPrice && maxPrice) terms.push(`(${priceField}=${minPrice}-${maxPrice})`);
  else if (minPrice) terms.push(`(${priceField}=${minPrice}+)`);
  else if (maxPrice) terms.push(`(${priceField}=${maxPrice}-)`);
  if (beds) terms.push(`(BEDS=${beds}+)`);
  if (baths) terms.push(`(BATHS=${baths}+)`);

  let session;
  try {
    session = await new RetsSession(retsConfigFromEnv()).start();
    const searchOptions = {
      SearchType: 'PROPERTY',
      Class: market === 'rent' ? 'RNT' : 'RES',
      Query: terms.join(','),
      QueryType: 'DMQL2',
      Count: 1,
      Format: 'COMPACT-DECODED',
      Limit: limit,
      StandardNames: 0,
    };
    searchOptions.Select = `LISTINGID,LISTINGSTATUS,${priceField},STREETNUMDISPLAY,STREETNAME,CITY,COUNTY,POSTALCODE,BEDS,BATHS,SUBPROPTYPE,LISTOFFICENAME,LISTOFFICEPHONE,LASTMODIFIED`;
    const body = await session.text('Search', searchOptions);
    const rows = parseCompact(body);

    let listings = rows.map((row) => mapListing(row, market)).filter((listing) => {
      const matchesLocation = !location || [listing.title, listing.city, listing.postalCode]
        .some((value) => String(value || '').toLowerCase().includes(location));
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      const matchesFeaturedWindow = !featured || new Date(listing.updatedAt).getTime() >= cutoff;
      return matchesLocation && matchesFeaturedWindow && (!requestedType || listing.propertyType === requestedType);
    });

    if (sort === 'price-asc') listings.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') listings.sort((a, b) => b.price - a.price);
    else listings.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    listings = listings.slice(0, limit);
    for (let index = 0; index < listings.length; index += 1) {
      listings[index] = await addPhoto(session, listings[index]);
    }

    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response.status(200).json({ listings });
  } catch (error) {
    console.error('IDX search failed. Provider details withheld.');
    return response.status(502).json({ error: 'Live home search could not load. Please try again.' });
  } finally {
    if (session) await session.close();
  }
}

