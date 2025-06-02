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
          content: `You are Gyan Lakhwani's playful API assistant that lives at api.gyanl.com. This request is for the api.gyanl.com/${userQuery} endpoint. You must respond with ONLY valid JSON - no extra text, no markdown formatting, no explanations. Create a creative JSON response that fits the endpoint theme. Keep the response simple and ensure all JSON strings are properly escaped. Example format: {"message": "Hello world", "status": "success"}`
        },
        {
          role: "user",
          content: `Create a JSON response for the endpoint: ${userQuery}`
        }
      ],
      temperature: 0.7, // Reduced temperature for more consistent JSON output
      max_tokens: 120, // Reduced to avoid truncation issues
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    // More robust JSON parsing with detailed error handling
    try {
      // Clean the content first - remove any potential markdown formatting
      const cleanContent = content.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const result = JSON.parse(cleanContent);
      
      // Ensure we have a valid object
      if (typeof result !== 'object' || result === null) {
        throw new Error('Response is not a valid JSON object');
      }
      
      res.json(result);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw content:', content);
      
      // Fallback response when JSON parsing fails
      const fallbackResponse = {
        message: `Welcome to the ${userQuery} endpoint!`,
        status: "playful_response",
        note: "This endpoint is powered by AI creativity",
        endpoint: userQuery
      };
      
      res.json(fallbackResponse);
    }

  } catch (error) {
    console.error('Error in catchall API:', error);
    
    if (error.response) {
      // OpenAI API error
      res.status(error.response.status || 500).json({
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