const GROQ_API_KEY = process.env.GROQ_API_KEY;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getMockData(topic, type, count) {
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
}

async function callGroq(topic, type, count, role) {
  const prompt = type === 'flashcards'
    ? `Generate ${count} flashcards about ${topic} for a ${role}. Return JSON: {"items":[{"question":"...","answer":"..."}]}`
    : `Generate ${count} quiz questions about ${topic} for a ${role}. Return JSON: {"items":[{"question":"...","options":["..."],"answer":"...","explanation":"..."}]}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
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
  return { ...parsed, type };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Content-Type', 'application/json');

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { role, topic, type, count = 5 } = body || {};

  if (type !== 'flashcards' && type !== 'quiz') {
    return res.status(400).json({ error: 'Invalid type. Must be "flashcards" or "quiz"' });
  }

  try {
    const result = GROQ_API_KEY
      ? await callGroq(topic, type, count, role)
      : getMockData(topic, type, count);

    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}