# Gyan's Playful API

A serverless API built with Vercel that provides various AI-powered endpoints and creative responses.

## Features

- **Acronym Generator** (`/api/acronyms/[name]`) - Generate creative acronyms for any word
- **Quickstart** (`/api/quickstart/[prompt]`) - Get HTML-formatted responses for prompts
- **Facts** (`/api/fact`) - Random facts about Gyan
- **Catchall** (`/api/*`) - AI-powered creative responses for any endpoint

## API Endpoints

### Acronyms
```
GET /api/acronyms/[name]
```
Generates 10 creative acronyms for the given name/word.

**Example:** `/api/acronyms/DOG`
```json
{
  "acronyms": [
    "Daring Optimistic Genius",
    "Delightful Outstanding Guardian",
    "..."
  ],
  "metadata": {
    "word": "DOG",
    "count": 10
  }
}
```

### Quickstart
```
GET /api/quickstart/[prompt]
```
Generates HTML-formatted responses for prompts.

**Example:** `/api/quickstart/hello%20world`
```json
{
  "content": "<h2>Hello World</h2><p>A warm greeting to start any journey...</p>"
}
```

### Random Facts
```
GET /api/fact
```
Returns a random fact about Gyan.

```json
{
  "fact": "Gyan is a designer, creative coder, and co-founder of Public Knowledge Studio.",
  "total_facts": 6
}
```

### Catchall (AI-Powered)
```
GET /api/[anything]
```
Any other endpoint will trigger an AI-powered creative response.

**Example:** `/api/pizza/toppings`
```json
{
  "toppings": ["creativity", "inspiration", "a sprinkle of magic"],
  "recommendation": "Best served with curiosity"
}
```

## Development

### Prerequisites
- Node.js 18+
- Vercel CLI (optional, for local development)

### Environment Variables
Create a `.env.local` file:
```
OPENAI_API_KEY=your_openai_api_key_here
```

### Local Development
```bash
npm install
npm run dev
```

### Deployment
```bash
npm run deploy
```

## OpenAI Models Used

- **gpt-4o-mini**: Used for all endpoints (cost-effective and fast)
  - Acronyms: Creative text generation with JSON formatting
  - Quickstart: Simple HTML content generation
  - Catchall: Creative API responses

## Architecture

This project uses Vercel's serverless functions with the following structure:

```
api/
├── acronyms/
│   └── [name].js          # Dynamic acronym generation
├── quickstart/
│   └── [prompt].js        # HTML content generation
├── fact.js                # Static facts endpoint
└── [...catchall].js       # AI-powered catchall
```

## Best Practices Implemented

1. **Serverless Architecture**: Each endpoint is a separate function for better performance and scaling
2. **Proper CORS**: All endpoints include proper CORS headers
3. **Input Validation**: Comprehensive validation for user inputs
4. **Error Handling**: Graceful error handling with appropriate HTTP status codes
5. **Cost Optimization**: Using gpt-4o-mini for cost-effective AI responses
6. **ES Modules**: Modern JavaScript module system
7. **Environment Validation**: Proper checking of required environment variables

## License

ISC