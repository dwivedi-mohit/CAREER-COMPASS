const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// --- ROUTES ---

// 1. HOME PAGE (LANDING UI)
app.get('/', (req, res) => {
    try {
        const htmlPath = path.join(process.cwd(), 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        res.send(html);
    } catch (err) {
        res.status(500).send("UI Error: index.html not found. Please ensure index.html is in the root.");
    }
});

// 2. ROADMAP GENERATOR
app.post('/api/generate-roadmap', async (req, res) => {
    const { role } = req.body;
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return res.status(500).json({ error: "Missing GROQ_API_KEY" });

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "You are a career architect. Generate a roadmap JSON object with 'role' and 'phases' (each phase has 'title', 'subtopics', 'description'). Return ONLY JSON." },
                    { role: "user", content: `Create a roadmap for ${role}` }
                ],
                response_format: { type: "json_object" }
            })
        });
        const data = await response.json();
        res.json(JSON.parse(data.choices[0].message.content));
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});

// 3. AI TUTOR
app.post('/api/tutor-query', async (req, res) => {
    const { query, topic, role } = req.body;
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return res.status(500).json({ error: "Missing GROQ_API_KEY" });

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "You are an elite tutor. Explain clearly." },
                    { role: "user", content: `Question: ${query}. Context: ${topic} for ${role}` }
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
