import { verifyToken } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';

let schemaReady;

function database() {
  if (!process.env.POSTGRES_URL) throw new Error('Database is unavailable.');
  return neon(process.env.POSTGRES_URL);
}

export async function requireBuyer(req) {
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || !process.env.CLERK_SECRET_KEY) throw new Error('Unauthorized.');
  const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
  if (!payload?.sub) throw new Error('Unauthorized.');
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
