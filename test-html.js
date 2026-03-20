const URL = 'https://kwqjgflpphuvmduxukau.supabase.co/functions/v1/test-html';

async function runTests() {
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(`${URL}?type=${i}`);
      console.log(`\n--- Type ${i} ---`);
      console.log(`Content-Type: ${res.headers.get('content-type')}`);
      const text = await res.text();
      console.log(`Body: ${text.substring(0, 50).replace(/\n/g, ' ')}`);
    } catch (e) {
      console.error(`Type ${i} Failed:`, e.message);
    }
  }
}
runTests();
