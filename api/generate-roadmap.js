const { generateGraphRoadmap } = require('../neo4j');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { role, currentSkills, userId } = req.body || {};
    if (!role) {
        return res.status(400).json({ error: 'Missing career role' });
    }

    try {
        const groqKey = process.env.GROQ_API_KEY;
        const result = await generateGraphRoadmap({
            userId: userId || 'guest_user',
            role,
            currentSkills: currentSkills || [],
            groqApiKey: groqKey
        });
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
};
