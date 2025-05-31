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

// Input validation middleware
const validateAcronymInput = (req, res, next) => {
  const nameToExpand = req.params.nameToExpand;
  if (!nameToExpand) {
    return res.status(400).json({ error: 'Name parameter is required' });
  }
  if (nameToExpand.length > 20) {
    return res.status(400).json({ error: 'Name is too long. Maximum length is 20 characters' });
  }
  if (!/^[A-Za-z0-9\s]+$/.test(nameToExpand)) {
    return res.status(400).json({ error: 'Name can only contain letters, numbers, and spaces' });
  }
  next();
};

app.get('/acronyms/:nameToExpand', validateAcronymInput, async (req, res) => {
  const nameToExpand = req.params.nameToExpand;
  try {
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
      .filter(x => x.length > 0); // Remove empty strings

    if (acros.length === 0) {
      throw new Error('No valid acronyms generated');
    }

    res.json(acros);
  } catch (error) {
    console.error('Error generating acronyms:', error);
    if (error.response) {
      // OpenAI API error
      res.status(error.response.status).json({
        error: 'OpenAI API Error',
        message: error.response.data?.error?.message || 'Error communicating with OpenAI'
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Error generating acronyms'
      });
    }
  }
});

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

