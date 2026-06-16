require('dotenv').config();
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
    console.log("❌ Groq API Key NOT FOUND in .env file!");
}

// --- MOCK FALLBACK DATA ---
const mockLibrary = {
    "frontend": [
        { id: 1, phase: "Phase 1", title: "HTML & CSS Mastery", icon: "code", desc: "The basic building blocks of the web.", items: ["Semantic HTML", "Flexbox & Grid", "Responsive Design"], active: true },
        { id: 2, phase: "Phase 2", title: "JavaScript Fundamentals", icon: "terminal", desc: "Learn logic and interactivity.", items: ["DOM Manipulation", "ES6+ Features", "Fetch API"], active: false },
        { id: 3, phase: "Phase 3", title: "Modern Frameworks", icon: "layers", desc: "Choose React, Vue, or Angular.", items: ["Component Lifecycle", "State Management", "Routing"], active: false }
    ],
    "backend": [
        { id: 1, phase: "Phase 1", title: "Server Side Basics", icon: "dns", desc: "How servers and APIs work.", items: ["HTTP/HTTPS", "RESTful APIs", "Node.js Basics"], active: true },
        { id: 2, phase: "Phase 2", title: "Databases", icon: "database", desc: "Storing and retrieving data.", items: ["SQL (PostgreSQL)", "NoSQL (MongoDB)", "ORM Tools"], active: false },
        { id: 3, phase: "Phase 3", title: "Authentication & Security", icon: "security", desc: "Protecting user data.", items: ["JWT Tokens", "OAuth", "Encryption Basics"], active: false }
    ]
};

app.post('/api/generate-roadmap', async (req, res) => {
    const { role } = req.body;
    const normalizedRole = role.toLowerCase().trim();

    const groqKey = process.env.GROQ_API_KEY;
    
    if (!groqKey) {
        console.log("No Groq Key found, using Mock Fallback.");
        return res.json(mockLibrary[normalizedRole] || mockLibrary["frontend"]);
    }

    try {
        console.log(`\n--- Groq AI Request: ${role} ---`);
        
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
                        content: `You are a world-class career architect. Generate a "roadmap.sh" style learning path as a JSON object. 
                        The structure should be:
                        {
                          "role": "Job Title",
                          "phases": [
                            {
                              "title": "Main Topic Name",
                              "subtopics": ["Subtopic 1", "Subtopic 2"],
                              "alternatives": ["Choice A", "Choice B"],
                              "description": "Short explanation"
                            }
                          ]
                        }
                        Return ONLY the JSON. No other text.`
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
        
        if (!response.ok) {
            throw new Error(data.error?.message || "Groq API Error");
        }

        // Groq sometimes returns the array inside a property if using json_object
        let roadmapData = data.choices[0].message.content;
        
        // Parse the JSON
        let parsed = JSON.parse(roadmapData);
        
        // Return the full object so code.html can access data.phases
        console.log("✅ Success with Groq!");
        res.json(parsed);

    } catch (error) {
        console.error('GROQ ERROR:', error.message);
        res.status(500).json({ 
            error: true, 
            message: `Groq Error: ${error.message}`,
            tip: "Ensure your GROQ_API_KEY is correct in .env",
            fallbackData: mockLibrary[normalizedRole] || mockLibrary["frontend"]
        });
    }
});

// --- New Endpoint for Study Plans ---
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
                model: "llama-3.1-8b-instant", // Smaller model for fast study plans
                messages: [
                    {
                        role: "system",
                        content: "You are a specialized tutor. Generate a detailed 5-day study plan for a specific topic. Return ONLY a JSON array of 5 days."
                    },
                    {
                        role: "user",
                        content: `Create a 5-day study plan to master "${topic}" for a "${role}" role. Each day should have a 'title' and 3 'tasks'.`
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

// --- New Endpoint for AI Tutor ---
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
                        content: `You are an elite technical tutor and mentor. Your goal is to explain complex concepts clearly, using analogies and best practices. You are helping a student pursuing a "${role || 'Developer'}" career path.`
                    },
                    {
                        role: "user",
                        content: `Explain this topic/question: "${query}". Context: This is related to "${topic || 'General Technology'}". Provide a structured, expert-level explanation.`
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

// --- Code Debugger Endpoint ---
app.post('/api/code-debugger', async (req, res) => {
    const { code, language } = req.body;
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
                        content: "You are an expert code debugger. Find bugs, explain fixes, and provide corrected code. Be concise."
                    },
                    {
                        role: "user",
                        content: `Fix this ${language || 'JavaScript'} code:\n${code.substring(0, 1000)}`
                    }
                ]
            })
        });

        const data = await response.json();
        res.json({ fix: data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});

// --- Flashcards & Quizzes ---
app.post('/api/flashcards-quizzes', async (req, res) => {
    const { role, topic, type, count = 5 } = req.body;

    if (type !== 'flashcards' && type !== 'quiz') {
        return res.status(400).json({ error: 'Invalid type. Must be "flashcards" or "quiz"' });
    }

    const getMockData = (topic, type, count) => {
        const items = [];
        for (let i = 1; i <= count; i++) {
            if (type === 'flashcards') {
                items.push({
                    question: `Mock question ${i} about ${topic}`,
                    answer: `Mock answer ${i} for ${topic}`
                });
            } else {
                items.push({
                    question: `Mock quiz question ${i} about ${topic}`,
                    options: ['Option A', 'Option B', 'Option C', 'Option D'],
                    answer: 'Option A',
                    explanation: `Explanation for question ${i}`
                });
            }
        }
        return { items, type };
    };

    try {
        if (process.env.GROQ_API_KEY) {
            const prompt = type === 'flashcards'
                ? `Generate ${count} flashcards about ${topic} for a ${role}. Return JSON: {"items":[{"question":"...","answer":"..."}]}`
                : `Generate ${count} quiz questions about ${topic} for a ${role}. Return JSON: {"items":[{"question":"...","options":["..."],"answer":"...","explanation":"..."}]}`;

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                }),
            });

            if (!response.ok) {
                throw new Error(`Groq API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content;
            if (!content) throw new Error('No content from Groq');

            const parsed = JSON.parse(content);
            return res.status(200).json({ ...parsed, type });
        } else {
            return res.status(200).json(getMockData(topic, type, count));
        }
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// --- Interview Simulator ---
app.post('/api/interview-simulator', async (req, res) => {
    const { role, topic, difficulty, mode, answer } = req.body;

    if (mode !== 'start' && mode !== 'answer') {
        return res.status(400).json({ error: 'Invalid mode' });
    }

    const json = (status, payload) => res.status(status).json(payload);

    if (!process.env.GROQ_API_KEY) {
        return mode === 'start'
            ? json(200, {
                  mode: 'question',
                  question: `Tell me about your experience with ${topic || 'this topic'} as a ${role || 'professional'}.`,
                  evaluationCriteria: ['Clarity', 'Relevance', 'Depth of knowledge'],
              })
            : json(200, {
                  mode: 'feedback',
                  score: 7,
                  feedback: 'Good structure and clarity, but could use more concrete examples.',
                  nextQuestion: `How would you handle a ${difficulty || 'challenging'} scenario in ${topic || 'this area'}?`,
              });
    }

    try {
        const systemPrompt =
            mode === 'start'
                ? 'You are an interview simulator. Output JSON with keys: mode:"question", question (string), evaluationCriteria (array of 3 strings).'
                : 'You are an interview simulator. Evaluate the answer. Output JSON with keys: mode:"feedback", score (number 1-10), feedback (string, 1-2 sentences), nextQuestion (string).';

        const userPrompt = [
            `Role: ${role || 'N/A'}`,
            `Topic: ${topic || 'N/A'}`,
            `Difficulty: ${difficulty || 'medium'}`,
            mode === 'answer' ? `Answer: ${answer || ''}` : '',
        ].filter(Boolean).join('\n');

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            throw new Error(`Groq API responded with ${response.status}`);
        }

        const data = await response.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        json(200, parsed);
    } catch (err) {
        console.error('Interview simulator error:', err);
        json(500, { error: 'Failed to generate interview response' });
    }
});

// --- Notion Export ---
app.post('/api/notion-export', async (req, res) => {
    const { title, markdown } = req.body;

    if (!title || !markdown) {
        return res.status(400).json({ error: 'Missing title or markdown' });
    }

    const hasNotionEnv = process.env.NOTION_API_TOKEN && process.env.NOTION_DATABASE_ID;

    if (!hasNotionEnv) {
        return res.status(200).json({
            mode: 'markdown',
            markdown,
            filename: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`
        });
    }

    const lines = markdown.split('\n').filter(line => line.trim());
    const children = lines.map(line => ({
        object: 'block',
        type: 'paragraph',
        paragraph: {
            rich_text: [{ type: 'text', text: { content: line } }]
        }
    }));

    const titleProperty = process.env.NOTION_TITLE_PROPERTY || 'Name';

    try {
        const notionRes = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.NOTION_API_TOKEN}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parent: { database_id: process.env.NOTION_DATABASE_ID },
                properties: {
                    [titleProperty]: {
                        title: [{ type: 'text', text: { content: title } }]
                    }
                },
                children
            })
        });

        if (!notionRes.ok) {
            const error = await notionRes.text();
            return res.status(500).json({ error: 'Notion API error', details: error });
        }

        const notionData = await notionRes.json();

        return res.status(200).json({
            mode: 'notion',
            url: notionData.url,
            title
        });
    } catch (e) {
        return res.status(500).json({ error: 'Notion API error', details: e.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("--- Server is now using GROQ AI ---");
});

// --- Tools Analytics Endpoint ---
app.get('/api/tools-stats', (req, res) => {
    const stats = {
        totalTools: 50,
        version: '2.0',
        categories: {
            productivity: 5,
            learning: 10,
            visualization: 8,
            ai: 5,
            export: 5,
            career: 7,
            quickActions: 10
        }
    };
    res.json(stats);
});
