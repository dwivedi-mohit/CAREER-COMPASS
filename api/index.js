const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- THE GOD-MODE UI (HARDCODED) ---
const LANDING_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>AjayPath AI - Career Workstation</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #ffffff; color: #000000; overflow-x: hidden; }
        .roadmap-container { max-width: 1800px; margin: 0 auto; padding: 60px 40px; position: relative; }
        .central-line { position: absolute; left: 50%; top: 0; bottom: 0; width: 3px; background: #2563eb; transform: translateX(-50%); z-index: 0; }
        .topic-box { background: #ffe57f; border: 4px solid #000; border-radius: 12px; padding: 14px 28px; font-weight: 800; text-align: center; min-width: 240px; position: relative; z-index: 10; box-shadow: 6px 6px 0px #000; cursor: pointer; transition: all 0.2s; }
        .topic-box:hover { transform: translate(-2px, -2px); box-shadow: 10px 10px 0px #000; }
        .topic-box.completed { background: #fff; border-color: #10b981; box-shadow: 6px 6px 0px #10b981; }
        .subtopic-box { background: #fff; border: 2px solid #000; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 700; box-shadow: 4px 4px 0px #000; cursor: pointer; transition: all 0.1s; }
        .subtopic-box:hover { background: #f3f4f6; transform: translate(-1px, -1px); }
        .sidebar { position: fixed; right: -450px; top: 0; width: 450px; height: 100vh; background: #fff; border-left: 4px solid #000; z-index: 2000; transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 40px; overflow-y: auto; box-shadow: -20px 0 50px rgba(0,0,0,0.1); }
        .sidebar.open { right: 0; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1500; display: none; backdrop-filter: blur(4px); }
        .overlay.open { display: block; }
        .loading-spinner { border: 8px solid #f3f3f3; border-top: 8px solid #3b82f6; border-radius: 50%; width: 60px; height: 60px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .mentor-widget { position: fixed; bottom: 30px; right: 30px; width: 380px; background: #fff; border: 4px solid #000; border-radius: 24px; box-shadow: 8px 8px 0px #000; z-index: 1000; display: flex; flex-direction: column; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; }
        .mentor-widget.minimized { height: 64px; width: 200px; }
        .mentor-widget.maximized { width: 600px; height: 700px; }
        .mentor-header { background: #000; color: #fff; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .mentor-body { padding: 20px; display: flex; flex-direction: column; height: 450px; }
        .mentor-widget.maximized .mentor-body { height: 636px; }
        #tutorOutput { flex-grow: 1; overflow-y: auto; margin-bottom: 20px; padding: 15px; background: #f9f9f9; border: 2px solid #000; border-radius: 12px; font-size: 0.875rem; }
        .mentor-trigger { position: fixed; bottom: 30px; right: 30px; width: 60px; height: 60px; background: #000; color: #fff; border-radius: 50%; display: none; justify-content: center; align-items: center; cursor: pointer; z-index: 1001; box-shadow: 4px 4px 0px #3b82f6; }
    </style>
</head>
<body>
    <div class="overlay" id="overlay" onclick="closeAllSidebars()"></div>
    <header class="bg-white border-b-8 border-black py-8 px-10 flex justify-between items-center sticky top-0 z-[100]">
        <div class="flex items-center gap-3 cursor-pointer" onclick="backToLibrary()">
            <span class="material-symbols-outlined text-4xl font-black text-blue-600">signpost</span>
            <h1 class="text-3xl font-black italic tracking-tighter">AjayPath <span class="text-blue-600">AI</span></h1>
        </div>
        <div class="flex gap-6">
            <button onclick="showTools()" class="flex items-center gap-3 px-8 py-3 border-4 border-black rounded-2xl font-black hover:bg-black hover:text-white transition-all shadow-[6px_6px_0px_#000]">TOOLS</button>
            <button onclick="toggleCollections()" class="flex items-center gap-3 px-8 py-3 border-4 border-black rounded-2xl font-black hover:bg-black hover:text-white transition-all shadow-[6px_6px_0px_#000]">COLLECTION</button>
        </div>
    </header>
    <div id="collectionsSidebar" class="sidebar">
        <h2 class="text-3xl font-black mb-10 border-b-4 border-black">History</h2>
        <div id="collectionsList" class="space-y-6"></div>
    </div>
    <div id="topicSidebar" class="sidebar">
        <h2 class="text-3xl font-black mb-10 border-b-4 border-black" id="sidebarTitle">Topic</h2>
        <div id="sidebarContent">
            <div id="studyPlan"><button onclick="generateStudyPlan()" class="w-full py-6 bg-blue-600 text-white border-4 border-black rounded-2xl font-black text-xl">BUILD 5-DAY PLAN</button></div>
        </div>
    </div>
    <div id="mainView">
        <section class="max-w-5xl mx-auto text-center py-32 px-10">
            <h2 class="text-8xl font-black mb-10 uppercase italic leading-[0.9]">Chart your <br/><span class="text-blue-600">future.</span></h2>
            <div class="flex flex-col md:flex-row gap-6 p-4 border-8 border-black rounded-[40px] bg-white shadow-[20px_20px_0px_#000] max-w-3xl mx-auto">
                <input id="roleInput" type="text" placeholder="e.g. Senior Software Architect" class="flex-grow border-none px-8 py-5 text-2xl font-black outline-none"/>
                <button onclick="generateRoadmap()" class="bg-black text-white px-12 py-5 rounded-3xl font-black text-xl hover:bg-gray-800 transition-all shadow-[8px_8px_0px_#3b82f6] uppercase">Architect</button>
            </div>
        </section>
        <section id="popularSection" class="mt-24 px-10 max-w-7xl mx-auto pb-40">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
                <button onclick="quickGenerate('React Developer')" class="p-8 border-4 border-black rounded-[32px] bg-[#ffe57f] font-black text-xl shadow-[10px_10px_0px_#000]">React Pro</button>
                <button onclick="quickGenerate('Node.js')" class="p-8 border-4 border-black rounded-[32px] bg-[#e1f5fe] font-black text-xl shadow-[10px_10px_0px_#000]">Node Mastery</button>
                <button onclick="quickGenerate('AI Engineer')" class="p-8 border-4 border-black rounded-[32px] bg-[#f1f8e9] font-black text-xl shadow-[10px_10px_0px_#000]">AI Architect</button>
                <button onclick="quickGenerate('AWS Architect')" class="p-8 border-4 border-black rounded-[32px] bg-[#fff3e0] font-black text-xl shadow-[10px_10px_0px_#000]">Cloud Ops</button>
                <button onclick="quickGenerate('Flutter Developer')" class="p-8 border-4 border-black rounded-[32px] bg-[#fff9c4] font-black text-xl shadow-[10px_10px_0px_#000]">Flutter Pro</button>
            </div>
        </section>
    </div>
    <div id="roadmapView" class="hidden px-10 py-24 max-w-[1800px] mx-auto">
        <button onclick="backToLibrary()" class="px-8 py-4 border-4 border-black rounded-2xl font-black shadow-[8px_8px_0px_#000]">BACK TO LIBRARY</button>
        <div id="roadmapContent" class="mt-20"></div>
    </div>
    <div id="aiMentorWidget" class="mentor-widget">
        <div class="mentor-header" onclick="toggleMinimize()"><span>Career Mentor</span></div>
        <div class="mentor-body">
            <div id="tutorOutput"></div>
            <div class="flex gap-3"><input id="tutorInput" type="text" class="flex-grow p-4 border-4 border-black rounded-2xl"><button onclick="askTutor()" class="bg-black text-white px-6 rounded-2xl">SEND</button></div>
        </div>
    </div>
    <script>
        let currentRole = "";
        function showTools() { document.getElementById('mainView').classList.add('hidden'); document.getElementById('roadmapView').classList.add('hidden'); }
        function backToLibrary() { document.getElementById('mainView').classList.remove('hidden'); document.getElementById('roadmapView').classList.add('hidden'); }
        async function generateRoadmap() { const role = document.getElementById('roleInput').value.trim(); await processRoadmap(role); }
        async function quickGenerate(role) { await processRoadmap(role); }
        async function processRoadmap(role) {
            currentRole = role;
            document.getElementById('mainView').classList.add('hidden');
            document.getElementById('roadmapView').classList.remove('hidden');
            document.getElementById('roadmapContent').innerHTML = '<div class="text-center py-40"><div class="loading-spinner mx-auto mb-10"></div><p class="text-4xl font-black italic">Architecting your path...</p></div>';
            try {
                const res = await fetch('/api/generate-roadmap', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ role }) });
                const data = await res.json();
                renderRoadmap(data);
            } catch(e) { alert("AI sync error"); }
        }
        function renderRoadmap(data) {
            let html = \`<h2 class="text-7xl font-black text-center mb-20 italic uppercase">\${currentRole}</h2><div class="roadmap-container"><div class="central-line"></div>\`;
            data.phases.forEach((p, i) => {
                html += \`<div class="flex items-center mb-20"><div class="topic-box" onclick="alert('\${p.description}')">\${p.title}</div><div class="ml-10 flex gap-2">\${p.subtopics.map(s => \`<div class="subtopic-box">\${s}</div>\`).join('')}</div></div>\`;
            });
            html += '</div>';
            document.getElementById('roadmapContent').innerHTML = html;
        }
        function toggleMinimize() { document.getElementById('aiMentorWidget').classList.toggle('minimized'); }
        async function askTutor() {
            const input = document.getElementById('tutorInput');
            const res = await fetch('/api/tutor-query', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ query: input.value, role: currentRole }) });
            const data = await res.json();
            document.getElementById('tutorOutput').innerText = data.answer;
        }
    </script>
</body>
</html>`;

// --- API ENDPOINTS ---
app.get('/', (req, res) => res.send(LANDING_PAGE_HTML));

app.post('/api/generate-roadmap', async (req, res) => {
    const { role } = req.body;
    const groqKey = process.env.GROQ_API_KEY;
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "system", content: "Return a JSON object with 'role' and 'phases' array. Each phase has 'title', 'subtopics' (array), and 'description'." }, { role: "user", content: `Roadmap for ${role}` }],
                response_format: { type: "json_object" }
            })
        });
        const data = await response.json();
        res.json(JSON.parse(data.choices[0].message.content));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tutor-query', async (req, res) => {
    const { query, role } = req.body;
    const groqKey = process.env.GROQ_API_KEY;
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "system", content: "You are a mentor." }, { role: "user", content: `Question: ${query} for role: ${role}` }]
            })
        });
        const data = await response.json();
        res.json({ answer: data.choices[0].message.content });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = app;
