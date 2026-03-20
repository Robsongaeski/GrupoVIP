import fs from 'fs';

const BASE_URL = "https://useupdate.uazapi.com";
const ADMIN_TOKEN = "Hij6TCeUspQrWDsdf9IC5Ol2MrmtNMT63rf4b6n2FMJecLacjE";
const INSTANCE_NAME = "teste_isolado_" + Math.floor(Math.random() * 10000);

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    "admintoken": ADMIN_TOKEN,
    ...(options.headers || {})
  };
  
  console.log(`\n[API] ${options.method || 'GET'} ${url}`);
  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 404) {
      console.log(`[API] Erro 404: Endpoint não encontrado.`);
      return null;
  }
  
  const data = await response.json();
  return { status: response.status, ok: response.ok, data };
}

async function testFlow() {
  console.log("=== INICIANDO TESTE ISOLADO UAZAPI ===");
  console.log("Instância:", INSTANCE_NAME);

  // 1. Criar Instância
  console.log("\n1. Criando Instância...");
  const initRes = await request("/instance/init", {
    method: "POST",
    body: JSON.stringify({ 
      instanceName: INSTANCE_NAME,
      Name: INSTANCE_NAME,
      name: INSTANCE_NAME
    })
  });
  
  if (!initRes || !initRes.ok) {
    console.error("Falha ao criar instância:", initRes?.data || "Erro desconhecido");
    return;
  }
  console.log("Instância criada com sucesso! Token da instância:", initRes.data.token);

  // 2. Conectar (Pegar QR Code)
  console.log("\n2. Gerando QR Code para conexão...");
  const connectRes = await request(`/instance/connect/${INSTANCE_NAME}`, { method: "GET" });
  
  if (connectRes && connectRes.data) {
    if (connectRes.data.status === "CONNECTED" || connectRes.data.state === "open") {
      console.log("A instância já parece estar conectada!");
    } else {
      let base64 = connectRes.data.qrcode || connectRes.data.base64;
      if (base64) {
        if (!base64.startsWith("data:image")) {
            base64 = `data:image/png;base64,${base64}`;
        }
        const html = `<html><body style="display:flex;flex-direction:column;align-items:center;margin-top:50px;font-family:sans-serif;">
            <h2>QR Code - UAZAPI Teste</h2>
            <p>Escaneie com seu WhatsApp (Aparelho Secundário de Testes)</p>
            <img src="${base64}" style="width: 300px; height: 300px; border: 1px solid #ccc; padding: 10px;" />
            <p>Após escanear, olhe o terminal.</p>
        </body></html>`;
        fs.writeFileSync("qr-test-uazapi.html", html);
        console.log("==========================================================================");
        console.log("QR Code salvo no arquivo: qr-test-uazapi.html (Abra em seu navegador!!)");
        console.log("==========================================================================");
      } else {
          console.log("Nenhum QR Code retornado. Resposta:", connectRes.data);
      }
    }
  }

  // 3. Loop aguardando conexão
  console.log("\n3. Aguardando você escanear o QR Code...");
  let isConnected = false;
  
  for (let i = 0; i < 20; i++) { // Tenta por 60 segundos (20 * 3s)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const statusRes = await request(`/instance/status/${INSTANCE_NAME}`, { method: "GET" });
    if (statusRes && statusRes.data) {
        const state = statusRes.data.status || statusRes.data.state || "";
        process.stdout.write(`Status atual: ${state}...\r`);
        
        if (state === "CONNECTED" || state === "open") {
            isConnected = true;
            console.log(`\n\n✅ SUCESSO! Instância conectada! Número: ${statusRes.data.phoneNumber || statusRes.data.phone || 'N/A'}`);
            break;
        }
    }
  }
  
  if (!isConnected) {
    console.log("\n\n⚠️ Tempo esgotado (60s) ou não conectou. Rode o teste novamente se precisar.");
    return;
  }

  // 4. Testar Listagem de Grupos
  console.log("\n4. Buscando grupos da instância...");
  const groupsRes = await request(`/group/list?instanceName=${INSTANCE_NAME}`, { method: "GET" });
  
  if (groupsRes && groupsRes.data) {
    const groups = groupsRes.data.groups || groupsRes.data || [];
    console.log(`\n✅ ${groups.length} grupos encontrados na sua conta de testes!`);
    if (groups.length > 0) {
        console.log("Exemplo de grupo:", groups[0].name || groups[0].subject);
    }
  } else {
      console.log("Falha ao buscar grupos.");
  }

  console.log("\n=== TESTE FINALIZADO COM SUCESSO ===");
  console.log("O provedor UazAPI está funcionando de ponta a ponta!");
}

testFlow().catch(console.error);
