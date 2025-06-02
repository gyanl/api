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
    console.log('OpenAI response type:', typeof aiResponseString);
    console.log('OpenAI response length:', aiResponseString?.length || 0);

    if (!aiResponseString || aiResponseString.trim() === '') {
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

    // Parse and validate the JSON response from OpenAI
    let jsonOutput;
    try {
      const trimmedResponse = aiResponseString.trim();
      
      // Additional check for empty or whitespace-only responses
      if (!trimmedResponse) {
        throw new Error('Response is empty after trimming');
      }
      
      jsonOutput = JSON.parse(trimmedResponse);
      
      // Ensure we have a valid object
      if (typeof jsonOutput !== 'object' || jsonOutput === null) {
        throw new Error('Response is not a valid JSON object');
      }

      // Validate that it's not an empty object if fields are requested
      if (fields && Object.keys(jsonOutput).length === 0) {
        throw new Error('Response is an empty object when fields were requested');
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
      console.error('AI response string was:', JSON.stringify(aiResponseString));
      console.error('Parse error details:', parseError.message);
      
      // Fallback response when JSON parsing fails
      const fallbackResponse = {
        message: `Welcome to the ${userQuery} endpoint!`,
        status: "playful_response",
        note: "This endpoint is powered by AI creativity",
        endpoint: userQuery,
        fallback_reason: "AI returned invalid JSON",
        debug_info: process.env.NODE_ENV === 'development' ? {
          ai_response: aiResponseString,
          parse_error: parseError.message
        } : undefined
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