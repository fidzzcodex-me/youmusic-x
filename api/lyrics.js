const axios = require('axios');
const { BASE, cors } = require('./_base');

module.exports = async (req, res) => {
  if (cors(req, res)) return;

  const { id, title, artist } = req.query;
  if (!id) {
    return res.status(400).json({ status: false, message: 'id (videoId) wajib diisi' });
  }

  try {
    const { data } = await axios.get(`${BASE}/api/lyrics`, {
      params: { id, title, artist },
      timeout: 15000
    });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ status: false, message: e.message });
  }
};
