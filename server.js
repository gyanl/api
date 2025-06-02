require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require("openai");
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Validate OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
  process.exit(1);
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const facts = [
  "Gyan is a designer, creative coder, and co-founder of Public Knowledge Studio.",
  "Gyan is a bit obsessed with markdown.",
  "Gyan previously worked as a product designer at Microsoft for 4.5 years.",
  "Gyan has a Master's in Interaction Design from IDC School of Design, IIT Bombay.",
  "Gyan wants to make the web weird again.",
  "Gyan is a bit of a nerd.",
  // Add more facts here
];

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
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

// Main handler for all routes
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const path = req.url.split('?')[0]; // Remove query parameters
    const segments = path.split('/').filter(Boolean);

    // Route handling
    if (segments[0] === 'acronyms' && segments[1]) {
      const nameToExpand = segments[1];

      // Validate input
      const validationError = validateAcronymInput(nameToExpand);
      if (validationError) {
        res.status(400).json(validationError);
        return;
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
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
        throw new Error('Invalid JSON response from OpenAI');
      }
      return;
    }

    if (segments[0] === 'quickstart' && segments[1]) {
      const prompt = segments[1];
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates HTML-formatted responses."
          },
          {
            role: "user",
            content: `Write a title and a short response for the prompt ${prompt}. Format the result as HTML.`
          }
        ],
        temperature: 0.7,
        max_tokens: 256,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      res.json(content);
      return;
    }

    if (segments[0] === 'fact') {
      const randomFact = facts[Math.floor(Math.random() * facts.length)];
      res.json({
        fact: randomFact,
        total_facts: facts.length
      });
      return;
    }

    // After all specific routes but before the 404 handler
    // Catch-all route for any other path
    const userQuery = segments.join(' '); // Convert path segments to a query
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: `You are Gyan Lakhwani's playful API assistant that lives at api.gyanl.com. This request is for the /${userQuery} endpoint. Respond with ONLY a JSON object appropriate for /${userQuery}. Do not include "query", "response", "type", or any wrapper — only valid JSON. You may invent fictional content where appropriate, and your response should look like a real API response.`
          },
          {
            role: "user",
            content: userQuery
          }
        ],
        temperature: 0.9,
        max_tokens: 150,
        response_format: { type: "json_object" } // Ensure JSON response
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
        throw new Error('Invalid JSON response from OpenAI');
      }
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    }
    return;

  } catch (error) {
    console.error('Error:', error);
    if (error.response) {
      // OpenAI API error
      res.status(error.response.status).json({
        error: 'OpenAI API Error',
        message: error.response.data?.error?.message || 'Error communicating with OpenAI'
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    }
  }
};

app.get('/quickstart/:prompt', async (req, res) => {
  const prompt = req.params.prompt;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: `Write a title and a short response for the prompt ${prompt}. Format the result as HTML.`
      }],
      temperature: 0.7,
      max_tokens: 256,
    });

    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
      throw new Error('Invalid response format from OpenAI');
    }

    const result = response.choices[0].message.content;
    res.json(result);
  } catch (error) {
    console.error('Error generating quickstart:', error);
    if (error.response) {
      res.status(error.response.status).json({
        error: 'OpenAI API Error',
        message: error.response.data?.error?.message || 'Error communicating with OpenAI'
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Error generating quickstart'
      });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

