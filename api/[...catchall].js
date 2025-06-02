import OpenAI from "openai";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set in environment variables');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    // Get the path segments from the catchall parameter
    const { catchall } = req.query;
    
    if (!catchall || catchall.length === 0) {
      res.status(404).json({ error: 'Endpoint not found' });
      return;
    }

    // Convert path segments to a query
    const userQuery = Array.isArray(catchall) ? catchall.join(' ') : catchall;

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Most cost-effective for creative responses
      messages: [
        {
          role: "system",
          content: `You are Gyan Lakhwani's playful API assistant that lives at api.gyanl.com. This request is for the api.gyanl.com/${userQuery} endpoint. Respond with ONLY a JSON object appropriate for /${userQuery}. Do not include "query", "response", "type", or any wrapper — only valid JSON. You may invent funny fictional content where appropriate, and your response should look like a real API response.`
        },
        {
          role: "user",
          content: userQuery
        }
      ],
      temperature: 0.9,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    try {
      const result = JSON.parse(content);
      res.json(result);
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      res.status(500).json({ error: 'Invalid response from AI service' });
    }

  } catch (error) {
    console.error('Error in catchall API:', error);
    
    if (error.response) {
      // OpenAI API error
      res.status(error.response.status).json({
        error: 'AI service error',
        message: error.response.data?.error?.message || 'Error communicating with AI service'
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    }
  }
} 