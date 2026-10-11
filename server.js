require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const { clerkMiddleware, getAuth } = require("@clerk/express");
app.use(clerkMiddleware());
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- Auth Endpoints ---
app.get('/api/auth/config', (req, res) => {
    res.json({
        publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
    });
});

app.get('/api/auth/me', (req, res) => {
    const auth = getAuth(req);
    res.json({
        userId: auth.userId || null,
        sessionId: auth.sessionId || null,
        isAuthenticated: !!auth.userId
    });
});

// --- Neo4j Graph Service ---
const {
    initNeo4j,
    getJobRoles,
    analyzeSkillGap,
    generateGraphRoadmap,
    markSkillCompleted,
    getStatus: getNeo4jStatus
} = require('./neo4j');

// Initialize Neo4j on boot
initNeo4j().then(status => {
    console.log(`📊 Neo4j status: mode=${status.mode}, connected=${status.isConnected}`);
});

// Verify Key on Startup
const initialKey = process.env.LLM_API_KEY || process.env.GROQ_API_KEY;
if (initialKey) {
    console.log(`✅ Groq/LLM API Key loaded: ${initialKey.substring(0, 8)}... (model: ${process.env.LLM_MODEL || 'default'})`);
} else {
    console.log("ℹ️ LLM/Groq API Key NOT FOUND in .env file (using graph-native roadmap synthesis)");
}

// --- Neo4j Graph API Endpoints ---
app.get('/api/neo4j/status', (req, res) => {
    res.json(getNeo4jStatus());
});

app.get('/api/careers', async (req, res) => {
    try {
        const roles = await getJobRoles();
        res.json(roles);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/skill-gap', async (req, res) => {
    try {
        const auth = getAuth(req);
        const { role, currentSkills } = req.body;
        if (!role) {
            return res.status(400).json({ error: 'Target career role is required' });
        }
        const gapAnalysis = await analyzeSkillGap({
            userId: auth.userId || 'guest_user',
            targetRole: role,
            currentSkills: currentSkills || []
        });
        res.json(gapAnalysis);
    } catch (e) {
        console.error('Skill gap analysis error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/complete-skill', async (req, res) => {
    try {
        const auth = getAuth(req);
        const { role, skillName } = req.body;
        if (!role || !skillName) {
            return res.status(400).json({ error: 'Role and skillName are required' });
        }
        const updated = await markSkillCompleted(auth.userId || 'guest_user', role, skillName);
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/generate-roadmap', async (req, res) => {
    const { role, currentSkills } = req.body;
    if (!role) {
        return res.status(400).json({ error: 'Role is required' });
    }

    try {
        const auth = getAuth(req);
        const groqKey = process.env.GROQ_API_KEY;
        const roadmapData = await generateGraphRoadmap({
            userId: auth.userId || 'guest_user',
            role,
            currentSkills: currentSkills || [],
            groqApiKey: groqKey
        });
        console.log(`✅ Generated graph roadmap for ${role} with ${roadmapData.phases.length} phases!`);
        res.json(roadmapData);
    } catch (err) {
        console.error('Error generating roadmap:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Robust Groq Helper & Deterministic Fallbacks ---
async function callGroqAI({ messages, model = (process.env.LLM_MODEL || "openai/gpt-oss-120b"), response_format = undefined }) {
    const groqKey = process.env.LLM_API_KEY || process.env.GROQ_API_KEY;
    if (!groqKey) {
        throw new Error("GROQ_API_KEY or LLM_API_KEY is not configured");
    }

    const preferred = process.env.LLM_MODEL || model;
    const candidateModels = [preferred, "qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"].filter(Boolean);
    let lastError = null;

    for (const m of candidateModels) {
        try {
            const body = {
                model: m,
                messages,
            };
            if (response_format) {
                body.response_format = response_format;
            }

            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${groqKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errText = await response.text();
                lastError = new Error(`Groq HTTP ${response.status} with model ${m}: ${errText}`);
                console.warn(`Groq model ${m} returned ${response.status}, trying fallback model...`);
                continue;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                lastError = new Error(`Empty content returned by Groq with model ${m}`);
                continue;
            }

            return content;
        } catch (e) {
            lastError = e;
            console.warn(`Groq candidate ${m} failed:`, e.message);
        }
    }

    throw lastError || new Error("Failed all Groq candidate models");
}

function generateFallbackStudyPlan(topic, role) {
    const targetTopic = topic || 'Core Technologies';
    const targetRole = role || 'Software Engineer';
    return `## 5-Day Study Plan: ${targetTopic}
*Tailored for ${targetRole}*

### 📅 Day 1: Foundations & Architecture
- **Objective:** Understand core concepts, mental model, and architecture of ${targetTopic}.
- **Key Concepts:** Primitives, component lifecycle, installation, and environment configuration.
- **Hands-on Task:** Initialize a sandbox repository and build a working "Hello World" application implementing ${targetTopic}.
- **Estimated Time:** 2-3 hours

### 📅 Day 2: Deep Dive into Core Workflows & APIs
- **Objective:** Master essential APIs, patterns, and idiomatic practices for ${targetTopic}.
- **Key Concepts:** State management, data flow, error handling, and parameterization.
- **Hands-on Task:** Implement a realistic feature or CRUD module utilizing ${targetTopic}'s primary library/framework.
- **Estimated Time:** 2.5 hours

### 📅 Day 3: Integration, Databases & Async Processing
- **Objective:** Connect ${targetTopic} to downstream services, databases, or client endpoints.
- **Key Concepts:** Asynchronous execution, persistence, data validation, and clean interface boundaries.
- **Hands-on Task:** Build an end-to-end integration test validating payload round-trips and edge case resilience.
- **Estimated Time:** 3 hours

### 📅 Day 4: Production Readiness, Testing & Security
- **Objective:** Harden your implementation with automated testing, telemetry, and security best practices.
- **Key Concepts:** Unit & integration testing, performance profiling, credential isolation, and observability.
- **Hands-on Task:** Add robust unit tests with 80%+ coverage, configure structured logging, and verify benchmarks.
- **Estimated Time:** 2.5 hours

### 📅 Day 5: Real-World Capstone Project & Interview Prep
- **Objective:** Synthesize all knowledge into a portfolio-ready project and practice technical interview questions.
- **Key Concepts:** System design trade-offs, scalability considerations, common pitfalls, and architecture review.
- **Hands-on Task:** Deploy your project or package it into a Docker container with documentation explaining architectural decisions.
- **Estimated Time:** 3 hours

---
💡 **Tutor Tip:** Review your code against industry benchmarks and add this project to your GitHub portfolio!`;
}

// --- New Endpoint for Study Plans ---
app.post('/api/generate-study-plan', async (req, res) => {
    const { topic, role } = req.body;
    const safeTopic = topic || 'Core Skills';
    const safeRole = role || 'Software Engineer';

    try {
        const content = await callGroqAI({
            messages: [
                {
                    role: "system",
                    content: "You are a specialized technical tutor. Generate a detailed 5-day study plan for a specific topic. Return ONLY a JSON object with key 'days' which is an array of 5 objects, each having 'day' (number 1-5), 'title' (string), and 'tasks' (array of 3 strings)."
                },
                {
                    role: "user",
                    content: `Create a 5-day study plan to master "${safeTopic}" for a "${safeRole}" role.`
                }
            ],
            model: "openai/gpt-oss-120b",
            response_format: { type: "json_object" }
        });

        const parsed = JSON.parse(content);
        res.json(parsed.days || parsed.plan || parsed);
    } catch (error) {
        console.warn('Groq study plan error, using structured fallback:', error.message);
        res.json([
            { day: 1, title: `Foundations of ${safeTopic}`, tasks: [`Read official documentation for ${safeTopic}`, 'Set up local dev environment and hello-world project', 'Understand core architecture and design principles'] },
            { day: 2, title: `Core Workflows & Patterns`, tasks: ['Implement primary API functions and workflows', 'Practice idiomatic patterns and component structure', 'Build a mini-exercise covering common use cases'] },
            { day: 3, title: `Integration & Persistence`, tasks: ['Integrate with data storage or external APIs', 'Handle edge cases and defensive validation', 'Write integration tests to verify data flow'] },
            { day: 4, title: `Testing & Performance Optimization`, tasks: ['Write comprehensive unit tests', 'Profile memory and response times', 'Implement caching and error boundary handlers'] },
            { day: 5, title: `Real-World Project & Interview Review`, tasks: ['Build and deploy a mini capstone project', 'Prepare answers for top interview questions on this topic', 'Document architectural decisions and trade-offs'] }
        ]);
    }
});

// --- Endpoint for AI Tutor & 5-Day Plan ---
app.post('/api/tutor-query', async (req, res) => {
    const { query, topic, role } = req.body;
    const safeTopic = topic || 'Core Technology';
    const safeRole = role || 'Developer';

    const isStudyPlan = query && (
        query.toLowerCase().includes('study plan') ||
        query.toLowerCase().includes('5-day') ||
        query.toLowerCase().includes('5 day')
    );

    try {
        const content = await callGroqAI({
            messages: [
                {
                    role: "system",
                    content: `You are an elite technical tutor and career mentor. Your goal is to explain complex concepts clearly, using analogies, actionable steps, and industry best practices. You are helping a student pursuing a "${safeRole}" career path.`
                },
                {
                    role: "user",
                    content: isStudyPlan 
                        ? `Create a comprehensive, actionable 5-day study plan to master "${safeTopic}" for a "${safeRole}". Include clear daily objectives, key concepts, hands-on tasks, and resource recommendations. Format with clear Day 1, Day 2, Day 3, Day 4, Day 5 headings.`
                        : `Explain this topic/question: "${query}". Context: This is related to "${safeTopic}". Provide a structured, expert-level explanation.`
                }
            ],
            model: "openai/gpt-oss-120b"
        });

        res.json({ answer: content });
    } catch (error) {
        console.warn('Groq tutor query error, using resilient fallback:', error.message);
        if (isStudyPlan) {
            const fallbackPlan = generateFallbackStudyPlan(safeTopic, safeRole);
            return res.json({ answer: fallbackPlan });
        }
        res.json({
            answer: `### Overview: ${safeTopic}\n\n**Key Fundamentals:**\n1. **Core Concept:** Understanding the architectural principles and operational workflow of ${safeTopic}.\n2. **Best Practice:** Ensure clean separation of concerns, defensive validation, and thorough test coverage.\n3. **Application:** In professional ${safeRole} environments, proficiency in ${safeTopic} enables high reliability and scalable implementations.\n\n*(Curriculum guidance provided by Career Navigator Engine)*`
        });
    }
});

// --- Code Debugger Endpoint ---
app.post('/api/code-debugger', async (req, res) => {
    const { code, language } = req.body;

    try {
        const content = await callGroqAI({
            messages: [
                {
                    role: "system",
                    content: "You are an expert code debugger. Find bugs, explain fixes, and provide corrected code concisely."
                },
                {
                    role: "user",
                    content: `Fix this ${language || 'JavaScript'} code:\n${(code || '').substring(0, 1500)}`
                }
            ],
            model: "openai/gpt-oss-120b"
        });

        res.json({ fix: content });
    } catch (error) {
        console.warn('Groq debugger error, using fallback:', error.message);
        res.json({
            fix: `// Debugger analysis (Offline fallback):\n// Check variable scoping, async/await handling, and null safety.\n${code || ''}`
        });
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
        const prompt = type === 'flashcards'
            ? `Generate ${count} flashcards about ${topic} for a ${role}. Return JSON: {"items":[{"question":"...","answer":"..."}]}`
            : `Generate ${count} quiz questions about ${topic} for a ${role}. Return JSON: {"items":[{"question":"...","options":["..."],"answer":"...","explanation":"..."}]}`;

        const content = await callGroqAI({
            messages: [{ role: 'user', content: prompt }],
            model: 'openai/gpt-oss-120b',
            response_format: { type: 'json_object' }
        });

        const parsed = JSON.parse(content);
        return res.status(200).json({ ...parsed, type });
    } catch (e) {
        console.warn('Flashcards/quizzes fallback invoked:', e.message);
        return res.status(200).json(getMockData(topic, type, count));
    }
});

// --- Interview Simulator ---
app.post('/api/interview-simulator', async (req, res) => {
    const { role, topic, difficulty, mode, answer } = req.body;

    if (mode !== 'start' && mode !== 'answer') {
        return res.status(400).json({ error: 'Invalid mode' });
    }

    const json = (status, payload) => res.status(status).json(payload);

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

        const content = await callGroqAI({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            model: 'openai/gpt-oss-120b',
            response_format: { type: 'json_object' },
        });

        const parsed = JSON.parse(content);
        json(200, parsed);
    } catch (err) {
        console.warn('Interview simulator fallback invoked:', err.message);
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

let PORT = Number(process.env.PORT) || 3001;

function startServer(portToTry) {
    const srv = app.listen(portToTry, () => {
        PORT = portToTry;
        console.log(`Server running on http://localhost:${PORT}`);
        console.log("--- Server is now using GROQ / Qwen AI ---");
    });

    srv.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            const nextPort = portToTry === 4000 ? 3001 : 3002;
            console.warn(`⚠️ Port ${portToTry} is occupied, auto-fallback to port ${nextPort}...`);
            startServer(nextPort);
        } else {
            console.error('Server error:', err);
        }
    });
}

startServer(PORT);

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
