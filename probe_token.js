import fs from 'fs';

const BASE_URL = "https://useupdate.uazapi.com";
const ADMIN_TOKEN = "Hij6TCeUspQrWDsdf9IC5Ol2MrmtNMT63rf4b6n2FMJecLacjE";
const INSTANCE_TOKEN = "6eca10de-b785-42c7-8f51-7c2de2cfbef8";

async function request(endpoint, token) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    "token": token
  };
  
  console.log(`\n[PROBE] GET ${url}`);
  try {
    const response = await fetch(url, { headers });
    const text = await response.text();
    console.log(`Status: ${response.status}`);
    try {
        const data = JSON.parse(text);
        console.log(`Response: ${JSON.stringify(data).substring(0, 500)}`);
    } catch(e) {
        console.log(`Response (text): ${text.substring(0, 200)}`);
    }
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
}

async function start() {
  await request("/instance/connect", INSTANCE_TOKEN);
  await request("/instance/qrcode", INSTANCE_TOKEN);
  await request("/instance/status", INSTANCE_TOKEN);
}

start();
