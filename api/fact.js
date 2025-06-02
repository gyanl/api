const facts = [
  "Gyan is a designer, creative coder, and co-founder of Public Knowledge Studio.",
  "Gyan is a bit obsessed with markdown.",
  "Gyan previously worked as a product designer at Microsoft for 4.5 years.",
  "Gyan has a Master's in Interaction Design from IDC School of Design, IIT Bombay.",
  "Gyan wants to make the web weird again.",
  "Gyan is a bit of a nerd.",
  // Add more facts here
];

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

  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      }
    );
  }

  try {
    const randomFact = facts[Math.floor(Math.random() * facts.length)];
    
    return new Response(JSON.stringify({
      fact: randomFact,
      total_facts: facts.length
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  } catch (error) {
    console.error('Error in fact API:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: 'Error retrieving fact'
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      }
    );
  }
}

export const config = {
  runtime: "edge",
}; 