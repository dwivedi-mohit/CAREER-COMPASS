function generateFallbackStudyPlan(topic, role) {
    const targetTopic = topic || 'Core Technologies';
    const targetRole = role || 'Software Engineer';
    return `## 5-Day Study Plan: ${targetTopic}
*Tailored for ${targetRole}*

### 📅 Day 1: Foundations & Architecture
- **Objective:** Understand core concepts, mental model, and architecture of ${targetTopic}.
- **Key Concepts:** Core primitives, component lifecycle, installation, and environment configuration.
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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query, topic, role } = req.body || {};
    const safeTopic = topic || 'Core Technology';
    const safeRole = role || 'Developer';
    const groqKey = process.env.GROQ_API_KEY;

    const isStudyPlan = query && (
        query.toLowerCase().includes('study plan') ||
        query.toLowerCase().includes('5-day') ||
        query.toLowerCase().includes('5 day')
    );

    if (!groqKey) {
        if (isStudyPlan) {
            return res.status(200).json({ answer: generateFallbackStudyPlan(safeTopic, safeRole) });
        }
        return res.status(200).json({
            answer: `### Overview: ${safeTopic}\n\n**Core Concept:** Understanding the architectural principles of ${safeTopic} for ${safeRole}.`
        });
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${groqKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-120b',
                messages: [
                    {
                        role: 'system',
                        content: `You are an elite technical tutor and career mentor. Explain complex concepts clearly. Path: ${safeRole}.`
                    },
                    {
                        role: 'user',
                        content: isStudyPlan 
                            ? `Create a comprehensive, actionable 5-day study plan to master "${safeTopic}" for a "${safeRole}". Include clear daily objectives, key concepts, hands-on tasks, and resource recommendations. Format with clear Day 1, Day 2, Day 3, Day 4, Day 5 headings.`
                            : `Topic: ${safeTopic}. Question: ${query}`
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Groq HTTP ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('No content from Groq');

        res.status(200).json({ answer: content });
    } catch (error) {
        if (isStudyPlan) {
            return res.status(200).json({ answer: generateFallbackStudyPlan(safeTopic, safeRole) });
        }
        res.status(200).json({
            answer: `### Overview: ${safeTopic}\n\n**Core Concept:** Understanding the architectural principles and operational workflow of ${safeTopic}.\n\n*(Curriculum guidance provided by Career Navigator Engine)*`
        });
    }
};
