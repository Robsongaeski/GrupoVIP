const testAgents = {
  'Normal Browser': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/100.0.0.0 Safari/537.36',
  'Meta In-App (Instagram)': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Safari) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36 Instagram',
  'Bot (Googlebot)': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'cURL': 'curl/7.68.0'
};

const URL = 'https://www.vipsend.com.br/go/grupovip';

async function runTests() {
  for (const [name, ua] of Object.entries(testAgents)) {
    try {
      const res = await fetch(URL, {
        headers: { 'User-Agent': ua },
        redirect: 'manual'
      });
      console.log(`\n--- ${name} ---`);
      console.log(`Status: ${res.status}`);
      console.log(`Content-Type: ${res.headers.get('content-type')}`);
      console.log(`Location: ${res.headers.get('location')}`);
      
      const text = await res.text();
      console.log(`Body snippet: ${text.substring(0, 150).replace(/\n/g, ' ')}`);
    } catch (e) {
      console.error(name, 'Failed:', e.message);
    }
  }
}
runTests();
