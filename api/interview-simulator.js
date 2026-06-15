module.exports = async function handler(req, res) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(200, CORS).end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, CORS).end();
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const { role, topic, difficulty, mode, answer } = body;

  if (mode !== 'start' && mode !== 'answer') {
    res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Invalid mode' }));
    return;
  }

  const json = (status, payload) => res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify(payload));

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
}
