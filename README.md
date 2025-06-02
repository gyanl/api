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

#### Optional Query Parameter

**fields** - Specify which fields you want in the response:
```
GET /api/weather/today?fields=temp,condition
```
```json
{
  "temp": "perfect",
  "condition": "sunny"
}
```

**Example:** Basic endpoint without fields parameter:
```
GET /api/user/profile
```
```json
{
  "message": "Welcome to the user profile endpoint!",
  "status": "active",
  "personality": "mysterious and intriguing"
}
```

**Example:** With specific fields:
```
GET /api/user/profile?fields=name,email,role
```
```json
{
  "name": "Gyan Lakhwani",
  "email": "hello@gyanl.com",
  "role": "Creative Developer"
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

This project uses Vercel's Edge Runtime serverless functions with the following structure:

```
api/
├── acronyms/
│   └── [name].js          # Dynamic acronym generation
├── quickstart/
│   └── [prompt].js        # HTML content generation
├── fact.js                # Static facts endpoint
├── test.js                # API structure test endpoint
└── [...catchall].js       # AI-powered catchall
```

## Best Practices Implemented

1. **Edge Runtime**: Ultra-fast serverless functions with minimal cold starts
2. **Proper CORS**: All endpoints include proper CORS headers
3. **Input Validation**: Comprehensive validation for user inputs
4. **Error Handling**: Graceful error handling with appropriate HTTP status codes
5. **Cost Optimization**: Using gpt-4o-mini with optimized token limits
6. **OpenAI Client Reuse**: Initialized outside handlers for better performance

## License

ISC