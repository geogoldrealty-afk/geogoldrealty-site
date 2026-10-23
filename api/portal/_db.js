import { verifyToken } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';

let schemaReady;

export class PortalAuthError extends Error {}
export class PortalInputError extends Error {}

function database() {
  if (!process.env.POSTGRES_URL) throw new Error('Database is unavailable.');
  return neon(process.env.POSTGRES_URL);
}

export async function requireBuyer(req) {
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || !process.env.CLERK_SECRET_KEY) throw new PortalAuthError('Unauthorized.');
  let payload;
  try {
    payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
  } catch {
    throw new PortalAuthError('Unauthorized.');
  }
  if (!payload?.sub) throw new PortalAuthError('Unauthorized.');
  return payload.sub;
}

export async function ensurePortalSchema() {
  if (!schemaReady) {
    const sql = database();
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS buyer_profiles (
        user_id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS buyer_collections (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES buyer_profiles(user_id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, name)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS buyer_saved_properties (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES buyer_profiles(user_id) ON DELETE CASCADE,
        mls_number TEXT NOT NULL,
        market TEXT NOT NULL CHECK (market IN ('buy','rent')),
        collection_id BIGINT REFERENCES buyer_collections(id) ON DELETE SET NULL,
        note TEXT NOT NULL DEFAULT '',
        rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, mls_number, market)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS buyer_recently_viewed (
        user_id TEXT NOT NULL REFERENCES buyer_profiles(user_id) ON DELETE CASCADE,
        mls_number TEXT NOT NULL,
        market TEXT NOT NULL CHECK (market IN ('buy','rent')),
        viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(user_id, mls_number, market)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS buyer_tour_requests (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES buyer_profiles(user_id) ON DELETE CASCADE,
        mls_number TEXT NOT NULL,
        market TEXT NOT NULL CHECK (market IN ('buy','rent')),
        request_type TEXT NOT NULL CHECK (request_type IN ('private-tour','open-house')),
        preferred_at TIMESTAMPTZ,
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','reschedule-requested','cancelled','completed')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
    })().catch(error => { schemaReady = undefined; throw error; });
  }
  return schemaReady;
}

export async function buyerDashboard(userId) {
  const sql = database();
  await ensurePortalSchema();
  await sql`INSERT INTO buyer_profiles (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()`;
  const [saved, collections, tours, recent] = await Promise.all([
    sql`SELECT mls_number AS "mlsNumber", market, note, rating, collection_id AS "collectionId", created_at AS "createdAt" FROM buyer_saved_properties WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 100`,
    sql`SELECT id, name, created_at AS "createdAt" FROM buyer_collections WHERE user_id = ${userId} ORDER BY created_at ASC LIMIT 30`,
    sql`SELECT id, mls_number AS "mlsNumber", market, request_type AS "requestType", preferred_at AS "preferredAt", status FROM buyer_tour_requests WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 50`,
    sql`SELECT mls_number AS "mlsNumber", market, viewed_at AS "viewedAt" FROM buyer_recently_viewed WHERE user_id = ${userId} ORDER BY viewed_at DESC LIMIT 20`,
  ]);
  return { saved, collections, tours, recent };
}

function listingInput(input = {}) {
  const mlsNumber = /^[0-9]{5,12}$/.test(String(input.mlsNumber || '')) ? String(input.mlsNumber) : '';
  const market = ['buy', 'rent'].includes(input.market) ? input.market : '';
  if (!mlsNumber || !market) throw new PortalInputError('Choose a valid property.');
  return { mlsNumber, market };
}

export async function portalAction(userId, input = {}) {
  await ensurePortalSchema();
  const sql = database();
  await sql`INSERT INTO buyer_profiles (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`;
  const action = String(input.action || '');

  if (action === 'save') {
    const { mlsNumber, market } = listingInput(input);
    const note = String(input.note || '').trim().slice(0, 2000);
    const rawRating = input.rating === '' || input.rating === undefined ? null : Number(input.rating);
    const rating = rawRating === null ? null : Number.isInteger(rawRating) && rawRating >= 1 && rawRating <= 5 ? rawRating : (() => { throw new PortalInputError('Rating must be between one and five.'); })();
    const suppliedCollectionId = input.collectionId === undefined || input.collectionId === '' ? undefined : Number(input.collectionId);
    if (suppliedCollectionId !== undefined && (!Number.isSafeInteger(suppliedCollectionId) || suppliedCollectionId < 1)) throw new PortalInputError('Choose a valid collection.');
    if (suppliedCollectionId !== undefined) {
      const collection = await sql`SELECT id FROM buyer_collections WHERE id = ${suppliedCollectionId} AND user_id = ${userId}`;
      if (!collection.length) throw new PortalInputError('Choose one of your collections.');
      await sql`INSERT INTO buyer_saved_properties (user_id, mls_number, market, collection_id, note, rating)
        VALUES (${userId}, ${mlsNumber}, ${market}, ${suppliedCollectionId}, ${note}, ${rating})
        ON CONFLICT (user_id, mls_number, market) DO UPDATE SET collection_id = EXCLUDED.collection_id, note = EXCLUDED.note, rating = EXCLUDED.rating, updated_at = NOW()`;
    } else {
      await sql`INSERT INTO buyer_saved_properties (user_id, mls_number, market, note, rating)
        VALUES (${userId}, ${mlsNumber}, ${market}, ${note}, ${rating})
        ON CONFLICT (user_id, mls_number, market) DO UPDATE SET note = EXCLUDED.note, rating = EXCLUDED.rating, updated_at = NOW()`;
    }
    return { message: 'Home saved.' };
  }

  if (action === 'view') {
    const { mlsNumber, market } = listingInput(input);
    await sql`INSERT INTO buyer_recently_viewed (user_id, mls_number, market)
      VALUES (${userId}, ${mlsNumber}, ${market})
      ON CONFLICT (user_id, mls_number, market) DO UPDATE SET viewed_at = NOW()`;
    return { message: 'Viewed home saved.' };
  }

  if (action === 'collection') {
    const name = String(input.name || '').trim().slice(0, 80);
    if (!name) throw new PortalInputError('Enter a collection name.');
    await sql`INSERT INTO buyer_collections (user_id, name) VALUES (${userId}, ${name}) ON CONFLICT (user_id, name) DO NOTHING`;
    return { message: 'Collection created.' };
  }

  if (action === 'tour') {
    const { mlsNumber, market } = listingInput(input);
    const requestType = ['private-tour', 'open-house'].includes(input.requestType) ? input.requestType : 'private-tour';
    const preferredAt = input.preferredAt ? new Date(input.preferredAt) : null;
    if (preferredAt && Number.isNaN(preferredAt.getTime())) throw new PortalInputError('Choose a valid preferred time.');
    const notes = String(input.notes || '').trim().slice(0, 2000);
    await sql`INSERT INTO buyer_tour_requests (user_id, mls_number, market, request_type, preferred_at, notes)
      VALUES (${userId}, ${mlsNumber}, ${market}, ${requestType}, ${preferredAt ? preferredAt.toISOString() : null}, ${notes})`;
    return { message: 'Tour request submitted.' };
  }

  if (action === 'reschedule') {
    const id = Number(input.id);
    const preferredAt = input.preferredAt ? new Date(input.preferredAt) : null;
    if (!Number.isSafeInteger(id) || id < 1 || !preferredAt || Number.isNaN(preferredAt.getTime())) {
      throw new PortalInputError('Choose a valid tour and preferred time.');
    }
    const updated = await sql`UPDATE buyer_tour_requests
      SET preferred_at = ${preferredAt.toISOString()}, status = 'reschedule-requested', updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId} AND status NOT IN ('cancelled', 'completed')
      RETURNING id`;
    if (!updated.length) throw new PortalInputError('That tour request is no longer available.');
    return { message: 'New tour time requested.' };
  }

  throw new PortalInputError('Unsupported Buyer Portal action.');
}
