const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/generate-roadmap', async (req, res) => {
    const { role } = req.body;
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
                        content: `You are a world-class career architect. Generate a "roadmap.sh" style learning path as a JSON object. 
                        The structure should be:
                        {
                          "role": "Job Title",
                          "phases": [
                            {
                              "title": "Main Topic Name",
                              "subtopics": ["Subtopic 1", "Subtopic 2"],
                              "description": "Short explanation"
                            }
                          ]
                        }
                        Return ONLY the JSON. No other text.`
                    },
                    {
                        role: "user",
                        content: `Create a roadmap for a "${role}".`
                    }
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

module.exports = app;
