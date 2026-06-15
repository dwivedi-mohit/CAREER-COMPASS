module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query, topic, role } = req.body;
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) return res.status(500).json({ error: 'Missing API Key' });

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${groqKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: `You are an elite technical tutor. Explain complex concepts clearly. Path: ${role || 'General'}.`
                    },
                    {
                        role: 'user',
                        content: `Topic: ${topic}. Question: ${query}`
                    }
                ]
            })
        });

        const data = await response.json();
        res.status(200).json({ answer: data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
};
