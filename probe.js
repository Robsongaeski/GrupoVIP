import fs from 'fs';

const BASE_URL = "https://useupdate.uazapi.com";
const ADMIN_TOKEN = "Hij6TCeUspQrWDsdf9IC5Ol2MrmtNMT63rf4b6n2FMJecLacjE";
const INSTANCE_NAME = "teste_isolado_3776"; 

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    "admintoken": ADMIN_TOKEN,
    ...(options.headers || {})
  };
  
  console.log(`\n[PROBE] ${options.method || 'GET'} ${url}`);
  try {
    const response = await fetch(url, { ...options, headers });
    const text = await response.text();
    console.log(`Status: ${response.status}`);
    try {
        const data = JSON.parse(text);
        console.log(`Response: ${JSON.stringify(data).substring(0, 200)}...`);
        return { status: response.status, data };
    } catch(e) {
        console.log(`Response (text): ${text.substring(0, 200)}...`);
        return { status: response.status, data: text };
    }
  } catch (err) {
    console.log(`Fetch Error: ${err.message}`);
    return { status: 500, error: err.message };
  }
}

async function startProbe() {
  console.log("=== UAZAPI ENDPOINT PROBE ===");

  // 1. Check if instance exists and get its token if possible
  console.log("\n--- Checking all instances ---");
  await request("/instance/all");

  // 2. Try variations of connect/qrcode
  const variations = [
    { method: "GET", url: `/instance/connect/${INSTANCE_NAME}` },
    { method: "GET", url: `/instance/connect?instanceName=${INSTANCE_NAME}` },
    { method: "POST", url: `/instance/connect`, body: JSON.stringify({ instanceName: INSTANCE_NAME }) },
    { method: "GET", url: `/instance/qrcode/${INSTANCE_NAME}` },
    { method: "GET", url: `/instance/qrcode?instanceName=${INSTANCE_NAME}` },
    { method: "GET", url: `/instance/qrcode` },
    { method: "GET", url: `/instance/connect` },
  ];

  for (const v of variations) {
    await request(v.url, { method: v.method, body: v.body });
  }

  console.log("\n--- PROBE FINISHED ---");
}

startProbe().catch(console.error);
