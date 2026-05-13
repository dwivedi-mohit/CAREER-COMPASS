const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Verify Key on Startup
const initialKey = process.env.GROQ_API_KEY;
if (initialKey) {
    console.log(`✅ Groq API Key loaded: ${initialKey.substring(0, 8)}...`);
} else {
    console.log("❌ Groq API Key NOT FOUND in Vercel Environment Variables!");
}

// --- MOCK FALLBACK DATA ---
const mockLibrary = {
    "frontend": [
        { id: 1, phase: "Phase 1", title: "HTML & CSS Mastery", icon: "code", desc: "The basic building blocks of the web.", items: ["Semantic HTML", "Flexbox & Grid", "Responsive Design"], active: true },
        { id: 2, phase: "Phase 2", title: "JavaScript Fundamentals", icon: "terminal", desc: "Learn logic and interactivity.", items: ["DOM Manipulation", "ES6+ Features", "Fetch API"], active: false }
    ],
    "backend": [
        { id: 1, phase: "Phase 1", title: "Server Side Basics", icon: "dns", desc: "How servers and APIs work.", items: ["HTTP/HTTPS", "RESTful APIs", "Node.js Basics"], active: true }
    ]
};

// --- API Endpoints ---

app.post('/api/generate-roadmap', async (req, res) => {
    const { role } = req.body;
    const normalizedRole = role.toLowerCase().trim();
    const groqKey = process.env.GROQ_API_KEY;
    
    if (!groqKey) {
        return res.json(mockLibrary[normalizedRole] || mockLibrary["frontend"]);
    }

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
                        content: `You are a world-class career architect. Generate a "roadmap.sh" style learning path as a JSON object. Return ONLY JSON.`
                    },
                    {
                        role: "user",
                        content: `Create a comprehensive branching roadmap for a "${role}". Include at least 6 main stages with branches.`
                    }
                ],
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        res.json(parsed);
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});

app.post('/api/generate-study-plan', async (req, res) => {
    const { topic, role } = req.body;
    const groqKey = process.env.GROQ_API_KEY;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    {
                        role: "system",
                        content: "You are a specialized tutor. Generate a detailed 5-day study plan. Return ONLY JSON."
                    },
                    {
                        role: "user",
                        content: `Create a 5-day study plan for "${topic}" in the context of a "${role}".`
                    }
                ],
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        res.json(parsed.days || parsed.plan || parsed);
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});

app.post('/api/tutor-query', async (req, res) => {
    const { query, topic, role } = req.body;
    const groqKey = process.env.GROQ_API_KEY;

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
                        content: `You are an elite technical tutor. You are helping a student pursuing a "${role || 'Developer'}" career path.`
                    },
                    {
                        role: "user",
                        content: `Explain: "${query}". Context: "${topic || 'General Technology'}".`
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

// For Vercel Serverless Functions
module.exports = app;
