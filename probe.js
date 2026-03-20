import fs from 'fs';

const BASE_URL = "https://useupdate.uazapi.com";
const ADMIN_TOKEN = "Hij6TCeUspQrWDsdf9IC5Ol2MrmtNMT63rf4b6n2FMJecLacjE";

async function request(endpoint, customHeaders = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...customHeaders
  };
  
  const response = await fetch(url, { method: "GET", headers });
  
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch(e) {}
  
  return { status: response.status, data: data || text };
}

async function probe() {
  const instanceName = "teste_isolado_3776";
  const instanceToken = "6eca10de-b785-42c7-8f51-7c2de2cfbef8";
  
  console.log("Probing connections...");
  
  // 1. With admin token and path param
  let r = await request(`/instance/connect/${instanceName}`, { admintoken: ADMIN_TOKEN });
  fs.appendFileSync("probe.log", `1. /instance/connect/name with admintoken -> ${r.status}\n`);
  
  // 2. With admin token and query param
  r = await request(`/instance/connect?instanceName=${instanceName}`, { admintoken: ADMIN_TOKEN });
  fs.appendFileSync("probe.log", `2. /instance/connect?instanceName=name with admintoken -> ${r.status}\n`);
  
  // 3. With instance token and NO path param
  r = await request(`/instance/connect`, { token: instanceToken });
  fs.appendFileSync("probe.log", `3. /instance/connect with instance token -> ${r.status}\n`);
  
  // 4. Same for status
  r = await request(`/instance/status/${instanceName}`, { admintoken: ADMIN_TOKEN });
  fs.appendFileSync("probe.log", `4. /instance/status/name with admintoken -> ${r.status}\n`);
  
  r = await request(`/instance/status?instanceName=${instanceName}`, { admintoken: ADMIN_TOKEN });
  fs.appendFileSync("probe.log", `5. /instance/status?instanceName=name with admintoken -> ${r.status}\n`);
  
  r = await request(`/instance/status`, { token: instanceToken });
  fs.appendFileSync("probe.log", `6. /instance/status with instance token -> ${r.status}
PAYLOAD: ${JSON.stringify(r.data, null, 2)}
`);
  
  console.log("Check probe.log for results!");
}

probe();
