require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require("openai");
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

app.get('/acronyms/:nameToExpand', async (req, res) => {
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

    const acros = response.choices[0].message.content
      .replace(/\.|\r|\n/gm, '')
      .split(', ')
      .map(x => x.trim());
    res.json(acros);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while processing your request.');
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

    const result = response.choices[0].message.content;
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while processing your request.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

