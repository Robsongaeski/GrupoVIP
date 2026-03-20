const SUPABASE_URL = "https://kwqjgflpphuvmduxukau.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3cWpnZmxwcGh1dm1kdXh1a2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMzIzMTMsImV4cCI6MjA4MzcwODMxM30.0SQg8n6vlcADimuCjRaOLLMxjuOhtZy8U2tzwRm7dew";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/whatsapp-api`;

async function testFunction() {
    console.log("=== TESTING DEPLOYED EDGE FUNCTION ===");
    
    // 1. Create Instance (UAZAPI)
    const instanceName = `prod_test_${Math.floor(Math.random()*10000)}`;
    console.log(`\n[1] Creating instance: ${instanceName}`);
    
    const createRes = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'create',
            instanceName: instanceName,
            providerOverride: 'uazapi'
        })
    });
    
    const createData = await createRes.json();
    console.log("Create Response Status:", createRes.status);
    console.log("Create Response Data:", JSON.stringify(createData));

    if (!createData.success || !createData.instanceToken) {
        console.error("Failed to create instance or get token.");
        return;
    }

    const token = createData.instanceToken;

    // 2. Connect Instance (Get QR)
    console.log(`\n[2] Connecting instance with token: ${token}`);
    const connectRes = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'connect',
            instanceName: instanceName,
            instanceToken: token,
            providerOverride: 'uazapi'
        })
    });

    const connectData = await connectRes.json();
    console.log("Connect Response Status:", connectRes.status);
    console.log("Connect Response Data structure:", Object.keys(connectData).join(", "));
    
    if (connectData.qrcode) {
        console.log("SUCCESS: QR Code obtained!");
        console.log("QR Code length:", connectData.qrcode.length);
        console.log("QR Code starts with:", connectData.qrcode.substring(0, 30));
    } else {
        console.log("FAILED: No QR Code in response.");
        console.log("Full data:", JSON.stringify(connectData));
    }
}

testFunction().catch(console.error);
