export default function handler(request) {
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

  return new Response(JSON.stringify({
    message: "New API structure is working!",
    timestamp: new Date().toISOString(),
    structure: "serverless",
    runtime: "edge",
    status: "success"
  }), {
    status: 200,
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders 
    },
  });
}

export const config = {
  runtime: "edge",
}; 