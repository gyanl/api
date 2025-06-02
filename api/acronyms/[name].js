import OpenAI from "openai";

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

    const { name } = req.query;
    const nameToExpand = decodeURIComponent(name);

    // Validate input
    const validationError = validateAcronymInput(nameToExpand);
    if (validationError) {
      res.status(400).json(validationError);
      return;
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

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
      throw new Error('No response content from OpenAI');
    }

    try {
      const result = JSON.parse(content);
      if (!result.acronyms || !Array.isArray(result.acronyms) || result.acronyms.length === 0) {
        throw new Error('Invalid response format: missing or empty acronyms array');
      }
      res.json(result);
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      res.status(500).json({ error: 'Invalid response from AI service' });
    }

  } catch (error) {
    console.error('Error in acronyms API:', error);
    
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