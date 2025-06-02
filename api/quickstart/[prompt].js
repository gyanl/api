import OpenAI from "openai";

// Initialize OpenAI client outside handler for reuse
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
  };

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      }
    );
  }

  try {
    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set in environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        }
      );
    }

    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const prompt = pathSegments[pathSegments.length - 1]; // Get the last segment as the prompt
    
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt parameter is required' }),
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        }
      );
    }

    const decodedPrompt = decodeURIComponent(prompt);

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
      return new Response(
        JSON.stringify({ error: 'No response content from OpenAI' }),
        {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        }
      );
    }

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error) {
    console.error('Error in quickstart API:', error);
    
    if (error.response) {
      // OpenAI API error
      return new Response(
        JSON.stringify({
          error: 'AI service error',
          message: error.response.data?.error?.message || 'Error communicating with AI service'
        }),
        {
          status: error.response.status,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        }),
        {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        }
      );
    }
  }
}

export const config = {
  runtime: "edge",
}; 