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
    let systemPrompt = `You are Gyan Lakhwani's helpful and playful API assistant that lives at api.gyanl.com and generates JSON responses for any endpoint requested by the user. This request is for the api.gyanl.com/${userQuery} endpoint.`;

    // Add field-specific instructions
    if (fields) {
      const fieldList = fields.split(',').map(f => f.trim());
      systemPrompt += ` The response must include these specific fields: ${fieldList.join(', ')}.`;
    }

    systemPrompt += ` You must respond with ONLY valid JSON - no extra text, no markdown formatting, no explanations. Ensure all JSON strings are properly escaped. The JSON must be complete and parseable. Always return at least one key-value pair. Never return empty objects or arrays unless specifically requested.`;

    // Build user prompt
    let userPrompt = `Create a JSON response for the endpoint: ${userQuery}`;
    
    if (fields) {
      userPrompt += ` with the following fields: ${fields}`;
    }

    userPrompt += `. Ensure the response is valid, complete JSON with meaningful content.`;

    let completion;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        completion = await openai.chat.completions.create({
          model: "gpt-4.1-mini", // Cost-effective for creative responses
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
          max_tokens: 400,
          response_format: { type: "json_object" },
        });
        break; // Success, exit retry loop
      } catch (openaiError) {
        console.error(`OpenAI API call failed (attempt ${retryCount + 1}):`, openaiError);
        
        // Handle specific OpenAI errors that shouldn't be retried
        if (openaiError.status === 429) {
          return new Response(
            JSON.stringify({
              error: "RATE_LIMITED",
              message: "API rate limit exceeded. Please try again later.",
              endpoint: userQuery
            }),
            {
              status: 429,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders 
              },
            }
          );
        }
        
        if (openaiError.status === 401) {
          return new Response(
            JSON.stringify({
              error: "UNAUTHORIZED",
              message: "API authentication failed.",
              endpoint: userQuery
            }),
            {
              status: 500, // Don't expose auth issues to client
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders 
              },
            }
          );
        }
        
        // For other errors, retry if we haven't reached max retries
        retryCount++;
        if (retryCount > maxRetries) {
          // Re-throw to be caught by outer try-catch
          throw openaiError;
        }
        
        // Wait briefly before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
      }
    }

    if (!completion || !completion.choices || completion.choices.length === 0) {
      console.error('OpenAI returned invalid completion structure:', completion);
      return new Response(
        JSON.stringify({
          error: "AI_INVALID_RESPONSE",
          message: "AI service returned an invalid response structure.",
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

    const aiResponseString = completion.choices[0]?.message?.content;

    console.log('OpenAI raw response:', aiResponseString);

    if (!aiResponseString || aiResponseString.trim() === '') {
      console.error('OpenAI response content is empty or whitespace. Full completion object:', completion);
      return new Response(
        JSON.stringify({
          error: "AI_RESPONSE_EMPTY",
          message: "The AI assistant returned empty or whitespace content.",
          endpoint: userQuery
        }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    try {
      // Validate that the response is actual JSON, as requested from OpenAI
      JSON.parse(aiResponseString); 

      // If JSON.parse is successful, it means aiResponseString is a valid JSON string.
      // Return it directly as the body.
      return new Response(aiResponseString, {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      });
    } catch (parseError) {
      console.error('Failed to parse JSON from AI:', parseError.message);
      console.error('AI response string that caused parse error was:', aiResponseString); // Log the raw string
      return new Response(
        JSON.stringify({
          error: "AI_INVALID_JSON_RESPONSE",
          message: "The AI assistant returned a response that was not valid JSON.",
          details: parseError.message,
          // Consider adding aiResponseString here for client-side debugging if appropriate
          // and if it doesn't expose sensitive information or is too large.
          // For now, it's logged server-side.
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