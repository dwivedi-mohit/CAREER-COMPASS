const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/tutor-query', async (req, res) => {
    const { query, topic, role } = req.body;
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) return res.status(500).json({ error: "Missing API Key" });

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: `You are an elite technical tutor. Explain complex concepts clearly. Path: ${role || 'General'}.`
                    },
                    {
                        role: "user",
                        content: `Topic: ${topic}. Question: ${query}`
                    }
                ]
            })
        });

        const data = await response.json();
        res.json({ answer: data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});

module.exports = app;
