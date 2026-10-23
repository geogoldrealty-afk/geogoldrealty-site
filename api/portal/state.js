import { buyerDashboard, requireBuyer } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  try {
    const userId = await requireBuyer(req);
    const dashboard = await buyerDashboard(userId);
    return res.status(200).json({ ok: true, dashboard });
  } catch {
    return res.status(401).json({ ok: false, error: 'Please sign in to access your Buyer Portal.' });
  }
}
