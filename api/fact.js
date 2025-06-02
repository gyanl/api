const facts = [
  "Gyan is a designer, creative coder, and co-founder of Public Knowledge Studio.",
  "Gyan is a bit obsessed with markdown.",
  "Gyan previously worked as a product designer at Microsoft for 4.5 years.",
  "Gyan has a Master's in Interaction Design from IDC School of Design, IIT Bombay.",
  "Gyan wants to make the web weird again.",
  "Gyan is a bit of a nerd.",
  // Add more facts here
];

export default function handler(req, res) {
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
    const randomFact = facts[Math.floor(Math.random() * facts.length)];
    res.json({
      fact: randomFact,
      total_facts: facts.length
    });
  } catch (error) {
    console.error('Error in fact API:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error retrieving fact'
    });
  }
} 