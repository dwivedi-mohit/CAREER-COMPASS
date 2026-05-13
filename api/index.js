const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>AjayPath AI</title><script src="https://cdn.tailwindcss.com"></script><style>body{background:#fff;font-family:sans-serif}.hero{padding:100px 20px;text-align:center}h1{font-size:5rem;font-weight:900;font-style:italic;text-transform:uppercase}input{border:4px solid #000;padding:20px;border-radius:20px;font-weight:900;font-size:1.5rem}button{background:#000;color:#fff;padding:20px 40px;border-radius:20px;font-weight:900;text-transform:uppercase;margin-top:20px}</style></head><body><div class="hero"><h1>AjayPath <span class="text-blue-600">AI</span></h1><p class="text-2xl font-bold text-gray-500 mb-10">Your Career Architect</p><div class="max-w-2xl mx-auto flex flex-col gap-4"><input id="role" type="text" placeholder="Enter Job Title..."><button onclick="go()">Architect My Future</button></div><div id="out" class="mt-20"></div></div><script>async function go(){const r=document.getElementById('role').value;document.getElementById('out').innerHTML="Architecting...";const res=await fetch('/api/generate-roadmap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:r})});const d=await res.json();document.getElementById('out').innerHTML="<pre class='text-left bg-gray-100 p-10 border-4 border-black rounded-3xl'>"+JSON.stringify(d,null,2)+"</pre>";}</script></body></html>`;

app.get('/', (req, res) => res.send(HTML));
app.get('/index.html', (req, res) => res.send(HTML));

app.post('/api/generate-roadmap', async (req, res) => {
    const { role } = req.body;
    const key = process.env.GROQ_API_KEY;
    try {
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "system", content: "JSON only. role, phases array (title, subtopics)." }, { role: "user", content: role }],
                response_format: { type: "json_object" }
            })
        });
        const d = await r.json();
        res.json(JSON.parse(d.choices[0].message.content));
    } catch (e) { res.json({ error: e.message }); }
});

module.exports = app;
