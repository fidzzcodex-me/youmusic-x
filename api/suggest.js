const axios = require('axios');
const { BASE, cors } = require('./_base');

module.exports = async (req, res) => {
  if (cors(req, res)) return;

  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(200).json([]);
  }

  try {
    const { data } = await axios.get(`${BASE}/api/suggest`, {
      params: { q },
      timeout: 10000
    });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ status: false, message: e.message });
  }
};
