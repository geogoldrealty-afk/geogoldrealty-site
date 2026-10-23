export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }

  // Clerk publishable keys are designed to be used by the browser. The secret
  // key is never returned or bundled into client code.
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return res.status(503).json({ ok: false });
  return res.status(200).json({ ok: true, publishableKey });
}

