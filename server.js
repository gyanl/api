require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require("openai");
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://gyanl.com');
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
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: `Generate 10 light-hearted and funny acronyms for the word ${nameToExpand}. Make sure they are not mean-spirited or offensive. Return results as a comma separated list`,
      temperature: 0.7,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const acros = response.data.choices[0].text
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
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: `Generate a title and 3 creative paragraphs with the prompt ${prompt}. Format result as HTML.`,
      temperature: 0.7,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const qsresult = response.data.choices[0].text;
    res.json(qsresult);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while processing your request.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

