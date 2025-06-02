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

    const { prompt } = req.query;
    
    if (!prompt) {
      res.status(400).json({ error: 'Prompt parameter is required' });
      return;
    }

    const decodedPrompt = decodeURIComponent(prompt);

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost-effective for simple HTML generation
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates HTML-formatted responses. Keep responses concise and well-formatted."
        },
        {
          role: "user",
          content: `Write a title and a short response for the prompt "${decodedPrompt}". Format the result as HTML.`
        }
      ],
      temperature: 0.7,
      max_tokens: 256,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    res.json({ content });

  } catch (error) {
    console.error('Error in quickstart API:', error);
    
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