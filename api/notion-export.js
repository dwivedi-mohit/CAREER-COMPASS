module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { title, markdown } = body || {};

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
}