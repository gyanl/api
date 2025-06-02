import OpenAI from "openai";

// Initialize OpenAI client outside handler for reuse
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Input validation helper
const validateAcronymInput = (nameToExpand) => {
  if (!nameToExpand) {
    return { error: 'Name parameter is required' };
  }
  if (nameToExpand.length > 20) {
    return { error: 'Name is too long. Maximum length is 20 characters' };
  }
  if (!/^[A-Za-z0-9\s]+$/.test(nameToExpand)) {
    return { error: 'Name can only contain letters, numbers, and spaces' };
  }
  return null;
};

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
    const name = pathSegments[pathSegments.length - 1]; // Get the last segment as the name

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Name parameter is required' }),
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        }
      );
    }

    const nameToExpand = decodeURIComponent(name);

    // Validate input
    const validationError = validateAcronymInput(nameToExpand);
    if (validationError) {
      return new Response(
        JSON.stringify(validationError),
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // More cost-effective for this use case
      messages: [
        {
          role: "system",
          content: "You are a playful and witty assistant that generates clever, light-hearted, and family-friendly acronyms for a given word. The acronyms should feel creative, delightful, and suitable for display to a general audience. Avoid anything mean-spirited, crude, political, or controversial. Each acronym should expand each letter of the input word into a word in the acronym. Avoid repeating the same words in the acronyms. For example, 'DOG' could expand to 'Daring Optimistic Genius'. Return your output in this JSON format: { \"acronyms\": [\"Acronym 1\", \"Acronym 2\", ...], \"metadata\": { \"word\": \"WORD\", \"count\": N } }."
        },
        {
          role: "user",
          content: `Generate 10 clever, light-hearted, and family-friendly acronyms for the word "${nameToExpand}". Each acronym should expand the word letter-by-letter. Ensure the acronyms are varied, playful, and suitable for all ages. Return the output as JSON as described above.`
        }
      ],
      temperature: 0.8,
      max_tokens: 512,
      response_format: { type: "json_object" }
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

    try {
      const result = JSON.parse(content);
      if (!result.acronyms || !Array.isArray(result.acronyms) || result.acronyms.length === 0) {
        throw new Error('Invalid response format: missing or empty acronyms array');
      }
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      });
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid response from AI service' }),
        {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        }
      );
    }

  } catch (error) {
    console.error('Error in acronyms API:', error);
    
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