import OpenAI from "openai";

// Initialize the OpenAI client outside the handler for reuse across invocations
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // Handle CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set in environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Extract the path after /api/
    let userQuery = req.url.replace(/^\/api\//, '') || "default";
    
    // Remove any trailing slashes
    userQuery = userQuery.replace(/\/$/, '') || "default";
    
    // Parse fields parameter for response customization
    const fields = req.query.fields;
    
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
          model: "gpt-4.1-mini",
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
          return res.status(429).json({
            error: "RATE_LIMITED",
            message: "API rate limit exceeded. Please try again later.",
            endpoint: userQuery
          });
        }
        
        if (openaiError.status === 401) {
          return res.status(500).json({
            error: "UNAUTHORIZED",
            message: "API authentication failed.",
            endpoint: userQuery
          });
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

    const aiResponseString = completion.choices[0]?.message?.content;

    console.log('OpenAI raw response:', aiResponseString);

    if (!aiResponseString || aiResponseString.trim() === '') {
      console.error('OpenAI response content is empty or whitespace. Full completion object:', completion);
      return res.status(500).json({
        error: "AI_RESPONSE_EMPTY",
        message: "The AI assistant returned empty or whitespace content.",
        endpoint: userQuery
      });
    }

    try {
      // Validate that the response is actual JSON, as requested from OpenAI
      JSON.parse(aiResponseString);

      // If JSON.parse is successful, it means aiResponseString is a valid JSON string.
      // Return it directly as the response
      res.setHeader('Content-Type', 'application/json');
      return res.send(aiResponseString);
    } catch (parseError) {
      console.error('Failed to parse JSON from AI:', parseError.message);
      console.error('AI response string that caused parse error was:', aiResponseString);
      return res.status(500).json({
        error: "AI_INVALID_JSON_RESPONSE",
        message: "The AI assistant returned a response that was not valid JSON.",
        details: parseError.message,
        endpoint: userQuery
      });
    }

  } catch (error) {
    console.error('Error calling OpenAI API or processing request:', error);
    console.error('Full error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });

    return res.status(500).json({
      error: "API_ERROR",
      message: "An error occurred while processing your request.",
      details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      endpoint: userQuery || "unknown"
    });
  }
}

export const config = {
  runtime: 'nodejs18.x',
  memory: 1024, // 1GB of memory
  maxDuration: 10 // Maximum execution time in seconds
}; 