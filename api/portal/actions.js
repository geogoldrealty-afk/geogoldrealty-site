import { portalAction, requireBuyer } from './_db.js';

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
    const status = error?.message === 'Unauthorized.' ? 401 : 400;
    return res.status(status).json({ ok: false, error: status === 401 ? 'Please sign in to continue.' : 'We could not save that Buyer Portal change.' });
  }
}
