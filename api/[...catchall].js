import OpenAI from "openai";

// Initialize the OpenAI client outside the handler for reuse across invocations
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(request) {
  // Handle CORS for all requests
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
    
    // Extract the path after /api/
    // For catchall routes, we need to remove the /api prefix
    let userQuery = url.pathname.replace(/^\/api\//, '') || "default";
    
    // Remove any trailing slashes
    userQuery = userQuery.replace(/\/$/, '') || "default";
    
    // Parse fields parameter for response customization
    const searchParams = url.searchParams;
    const fields = searchParams.get('fields');
    
    console.log('Processing endpoint:', userQuery);
    if (fields) {
      console.log('Requested fields:', fields);
    }

    // Build system prompt
    let systemPrompt = `You are Gyan Lakhwani's playful API assistant that lives at api.gyanl.com. This request is for the api.gyanl.com/${userQuery} endpoint.`;

    // Add field-specific instructions
    if (fields) {
      const fieldList = fields.split(',').map(f => f.trim());
      systemPrompt += ` The response must include these specific fields: ${fieldList.join(', ')}.`;
    }

    systemPrompt += ` You must respond with ONLY valid JSON - no extra text, no markdown formatting, no explanations. Ensure all JSON strings are properly escaped.`;

    // Build user prompt
    let userPrompt = `Create a JSON response for the endpoint: ${userQuery}`;
    
    if (fields) {
      userPrompt += ` with the following fields: ${fields}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost-effective for creative responses
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 250,
      response_format: { type: "json_object" },
    });

    const aiResponseString = completion.choices[0]?.message?.content;

    if (!aiResponseString) {
      console.error('OpenAI response content is empty or malformed:', completion);
      return new Response(
        JSON.stringify({
          error: "AI_RESPONSE_EMPTY",
          message: "The AI assistant did not return any content.",
          endpoint: userQuery
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

    console.log('OpenAI raw response:', aiResponseString);

    // Parse and validate the JSON response from OpenAI
    try {
      const jsonOutput = JSON.parse(aiResponseString);
      
      // Ensure we have a valid object
      if (typeof jsonOutput !== 'object' || jsonOutput === null) {
        throw new Error('Response is not a valid JSON object');
      }

      return new Response(JSON.stringify(jsonOutput), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      });
    } catch (parseError) {
      console.error('Failed to parse JSON from AI:', parseError);
      console.error('AI response string was:', aiResponseString);
      
      // Fallback response when JSON parsing fails
      const fallbackResponse = {
        message: `Welcome to the ${userQuery} endpoint!`,
        status: "playful_response",
        note: "This endpoint is powered by AI creativity",
        endpoint: userQuery,
        fallback_reason: "AI returned invalid JSON"
      };

      // Apply field filtering to fallback if specified
      if (fields) {
        const fieldList = fields.split(',').map(f => f.trim());
        const filteredResponse = {};
        fieldList.forEach(field => {
          if (fallbackResponse[field] !== undefined) {
            filteredResponse[field] = fallbackResponse[field];
          } else {
            filteredResponse[field] = `Generated value for ${field}`;
          }
        });
        return new Response(JSON.stringify(filteredResponse), {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        });
      }

      return new Response(JSON.stringify(fallbackResponse), {
        status: 200, // Return 200 with fallback rather than error
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      });
    }

  } catch (error) {
    console.error('Error calling OpenAI API or processing request:', error);
    console.error('Full error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });

    // Handle OpenAI API errors vs other errors
    if (error.response) {
      return new Response(
        JSON.stringify({
          error: "AI_SERVICE_ERROR",
          message: error.response.data?.error?.message || "Error communicating with AI service",
          endpoint: url.pathname.replace(/^\/api\//, '') || "unknown"
        }),
        {
          status: error.response.status || 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "API_ERROR",
        message: "An error occurred while processing your request.",
        details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        endpoint: url.pathname.replace(/^\/api\//, '') || "unknown"
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

// Use Edge Runtime for better performance
export const config = {
  runtime: "edge",
}; 