const axios = require('axios');
const { BASE, cors } = require('./_base');

module.exports = async (req, res) => {
  if (cors(req, res)) return;

  const { query, type = 'all' } = req.query;
  if (!query || !query.trim()) {
    return res.status(400).json({ status: false, message: 'query wajib diisi' });
  }

  try {
    const { data } = await axios.get(`${BASE}/api/search`, {
      params: { query, type },
      timeout: 15000
    });
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ status: false, message: e.message });
  }
};
