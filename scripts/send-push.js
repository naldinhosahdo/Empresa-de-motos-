// Vrunn — verifica os alertas do dia e envia notificações push para os celulares cadastrados.
// Executado diariamente pelo GitHub Actions (.github/workflows/push-diario.yml).
const webpush = require('web-push');

const SUPABASE_URL = 'https://ohukqqyktkrvqedhozgk.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odWtxcXlrdGtydnFlZGhvemdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODkzMTQsImV4cCI6MjA5NTI2NTMxNH0.yKCkjINcQNcxiIqkfRUA507KlFymzTsInHTa6ObZzTM';
const VAPID_PUBLIC_KEY = 'BLbdWTKS_A8et8ClLU0PbSAeuCxFueD29gEUIodPRlDTpZ4vUN7_955gTRrKoQWcoMQ4YBHL-REr-Txu2YZcJyY';

const EMAIL = process.env.VRUNN_EMAIL;
const SENHA = process.env.VRUNN_SENHA;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!EMAIL || !SENHA || !VAPID_PRIVATE_KEY) {
  console.error('Faltam secrets: VRUNN_EMAIL, VRUNN_SENHA ou VAPID_PRIVATE_KEY.');
  process.exit(1);
}

webpush.setVapidDetails('mailto:' + EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Data local de Fortaleza (UTC-3)
const hojeStr = new Date(Date.now() - 3 * 3600 * 1000).toISOString().split('T')[0];
const addDias = n => new Date(Date.now() - 3 * 3600 * 1000 + n * 86400000).toISOString().split('T')[0];
const fmt = s => { const p = s.split('-'); return p[2] + '/' + p[1]; };
const brl = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

async function login() {
  const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: SENHA })
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Login falhou: ' + JSON.stringify(j));
  return j.access_token;
}

function rest(token) {
  return async (pathQuery, opts) => {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + pathQuery, {
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      ...(opts || {})
    });
    if (opts && opts.method === 'DELETE') return null;
    const body = await r.text();
    let json;
    try { json = JSON.parse(body); } catch (e) { json = null; }
    if (!r.ok || !Array.isArray(json)) {
      console.error('Erro na consulta "' + pathQuery + '" (HTTP ' + r.status + '): ' + body);
      return [];
    }
    return json;
  };
}

(async () => {
  const token = await login();
  const q = rest(token);
  const alertas = [];

  // 1. Parcelas em aberto vencendo até amanhã (inclui atrasadas)
  const parcelas = await q('parcelas?select=valor,vencimento,alugueis(cliente)&pago=eq.false&vencimento=lte.' + addDias(1) + '&order=vencimento');
  for (const p of parcelas || []) {
    const cliente = (p.alugueis && p.alugueis.cliente) || 'Cliente';
    const quando = p.vencimento < hojeStr
      ? 'ATRASADA desde ' + fmt(p.vencimento)
      : p.vencimento === hojeStr ? 'vence HOJE' : 'vence amanhã';
    alertas.push('💰 Parcela ' + brl(p.valor) + ' de ' + cliente + ' — ' + quando);
  }

  // 2. Contratos ativos terminando nos próximos 5 dias
  const contratos = await q('alugueis?select=cliente,fim&status=eq.ativo&fim=gte.' + hojeStr + '&fim=lte.' + addDias(5));
  for (const c of contratos || []) {
    alertas.push('📋 Contrato de ' + c.cliente + ' termina em ' + fmt(c.fim));
  }

  // 3. Caução pendente após 30 dias do encerramento
  const caucoes = await q('alugueis?select=cliente,caucao,fim&status=eq.encerrado&caucao=gt.0&caucao_devolvido=neq.sim&fim=lte.' + addDias(-30));
  for (const c of caucoes || []) {
    alertas.push('💵 Caução ' + brl(c.caucao) + ' de ' + c.cliente + ' — prazo de devolução atingido');
  }

  // 4. Despesas não pagas vencendo até amanhã (ex.: seguro+rastreador)
  const despesas = await q('despesas?select=tipo,valor,vencimento&pago=eq.false&vencimento=not.is.null&vencimento=lte.' + addDias(1));
  for (const d of despesas || []) {
    alertas.push('🧾 ' + d.tipo + (d.valor ? ' ' + brl(d.valor) : '') + ' — vence ' + fmt(d.vencimento));
  }

  console.log(alertas.length + ' alerta(s):', alertas);
  if (!alertas.length) return;

  const payload = JSON.stringify({
    title: '🏍️ Vrunn — ' + alertas.length + ' alerta(s) hoje',
    body: alertas.slice(0, 6).join('\n') + (alertas.length > 6 ? '\n…e mais ' + (alertas.length - 6) : ''),
    tag: 'vrunn-diario',
    url: '/Empresa-de-motos-/'
  });

  const subs = await q('push_subscriptions?select=*');
  let enviados = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      enviados++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await q('push_subscriptions?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'DELETE' });
        console.log('Inscrição expirada removida.');
      } else {
        console.error('Erro ao enviar:', err.statusCode || err.message);
      }
    }
  }
  console.log('Enviado para ' + enviados + ' aparelho(s).');
})().catch(e => { console.error(e); process.exit(1); });
