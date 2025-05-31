require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require("openai");
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Validate OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "user",
          content: `Generate 10 light-hearted and funny acronyms for the word ${nameToExpand}. Make sure they are not mean-spirited or offensive. Return results as a comma separated list`
        }],
        temperature: 0.7,
        max_tokens: 256,
      });

      if (!response.choices || !response.choices[0] || !response.choices[0].message) {
        throw new Error('Invalid response format from OpenAI');
      }

      const acros = response.choices[0].message.content
        .replace(/\.|\r|\n/gm, '')
        .split(', ')
        .map(x => x.trim())
        .filter(x => x.length > 0);

      if (acros.length === 0) {
        throw new Error('No valid acronyms generated');
      }

      res.json(acros);
      return;
    }

    if (segments[0] === 'quickstart' && segments[1]) {
      const prompt = segments[1];
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
      return;
    }

    // Serve static files for root path
    if (path === '/' || path === '') {
      res.setHeader('Content-Type', 'text/html');
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Get Your Acronym Now</title>
            <script>
              window.location.href = 'https://gyanl.com/aicronym';
            </script>
          </head>
          <body>
            Redirecting to main site...
          </body>
        </html>
      `);
      return;
    }

    // Handle 404
    res.status(404).json({ error: 'Not Found' });

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

