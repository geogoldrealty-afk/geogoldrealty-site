import { PortalAuthError, PortalInputError, portalAction, requireBuyer } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  try {
    const userId = await requireBuyer(req);
    const input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const result = await portalAction(userId, input);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PortalAuthError) return res.status(401).json({ ok: false, error: 'Please sign in to continue.' });
    if (error instanceof PortalInputError || error instanceof SyntaxError) return res.status(400).json({ ok: false, error: 'We could not save that Buyer Portal change.' });
    return res.status(503).json({ ok: false, error: 'Buyer Portal is temporarily unavailable. Please try again shortly.' });
  }
}
