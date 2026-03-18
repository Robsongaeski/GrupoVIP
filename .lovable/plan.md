

# Configuracao Automatica de Instancias Evolution API

## Objetivo

Quando o sistema criar uma instancia na Evolution API, automaticamente configurar as opcoes de comportamento para prevenir mensagens fantasma, sem necessidade de acesso manual ao servidor.

## O que sera feito

### 1. Modificar `createInstance` no `EvolutionAdapter`

No arquivo `supabase/functions/whatsapp-api/index.ts`, duas mudancas:

**a) Adicionar `syncFullHistory: false` no body de criacao:**

```typescript
body: JSON.stringify({
  instanceName: name,
  qrcode: true,
  integration: "WHATSAPP-BAILEYS",
  syncFullHistory: false,  // NOVO - impede reenvio de historico
}),
```

**b) Apos criacao bem-sucedida, chamar `PUT /settings/set/{instanceName}`** com as configuracoes otimizadas:

```typescript
// Configurar settings automaticamente apos criar
await this.request(`/settings/set/${name}`, {
  method: "PUT",
  body: JSON.stringify({
    rejectCall: true,
    groupsIgnore: true,
    alwaysOnline: false,
    readMessages: false,
    readStatus: false,
    syncFullHistory: false,
  }),
});
```

### 2. Adicionar metodo `configureInstanceSettings`

Metodo publico no `EvolutionAdapter` para permitir reconfigurar instancias existentes sob demanda (util para instancias ja criadas):

```typescript
async configureInstanceSettings(name: string): Promise<{ success: boolean }> {
  // Chama PUT /settings/set/{instanceName}
  // Retorna sucesso/falha
}
```

### 3. Expor acao "configure-settings" na Edge Function

Adicionar um novo `action` no handler principal para que o frontend possa chamar a configuracao em instancias existentes (ex: botao "Reconfigurar" na pagina de instancias).

## Arquivo modificado

- `supabase/functions/whatsapp-api/index.ts` (3 alteracoes pontuais)

## Resultado

- Toda nova instancia ja nasce com `syncFullHistory: false` e configuracoes otimizadas
- Instancias existentes podem ser reconfiguradas via API
- Sem necessidade de acessar o servidor da Evolution API manualmente

