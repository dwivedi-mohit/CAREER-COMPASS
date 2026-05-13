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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("--- Server is now using GROQ AI ---");
});
