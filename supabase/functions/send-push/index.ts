// Vrunn — envia notificações push diárias com os alertas do dia.
// Deploy: Supabase Dashboard → Edge Functions → New function → nome: send-push
// Secrets necessários (Dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY  e  VAPID_PRIVATE_KEY
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async () => {
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  webpush.setVapidDetails(
    'mailto:naldinhosahdo@gmail.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  );

  // Data local de Fortaleza (UTC-3)
  const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().split('T')[0];
  const addDias = (n: number) =>
    new Date(Date.now() - 3 * 3600 * 1000 + n * 86400000).toISOString().split('T')[0];
  const fmt = (s: string) => { const p = s.split('-'); return p[2] + '/' + p[1]; };
  const brl = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

  const alertas: string[] = [];

  // 1. Parcelas em aberto vencendo até amanhã (inclui atrasadas)
  const { data: parcelas } = await db
    .from('parcelas')
    .select('valor, vencimento, alugueis(cliente)')
    .eq('pago', false)
    .lte('vencimento', addDias(1))
    .order('vencimento');
  for (const p of parcelas || []) {
    const cliente = (p as any).alugueis?.cliente || 'Cliente';
    const quando = p.vencimento < hoje
      ? 'ATRASADA desde ' + fmt(p.vencimento)
      : p.vencimento === hoje ? 'vence HOJE' : 'vence amanhã';
    alertas.push('💰 Parcela ' + brl(p.valor) + ' de ' + cliente + ' — ' + quando);
  }

  // 2. Contratos ativos terminando nos próximos 5 dias
  const { data: contratos } = await db
    .from('alugueis')
    .select('cliente, fim')
    .eq('status', 'ativo')
    .not('fim', 'is', null)
    .gte('fim', hoje)
    .lte('fim', addDias(5));
  for (const c of contratos || []) {
    alertas.push('📋 Contrato de ' + c.cliente + ' termina em ' + fmt(c.fim));
  }

  // 3. Caução pendente após 30 dias do encerramento
  const { data: caucoes } = await db
    .from('alugueis')
    .select('cliente, caucao, fim')
    .eq('status', 'encerrado')
    .gt('caucao', 0)
    .neq('caucao_devolvido', 'sim')
    .lte('fim', addDias(-30));
  for (const c of caucoes || []) {
    alertas.push('💵 Caução ' + brl(c.caucao) + ' de ' + c.cliente + ' — prazo de devolução atingido');
  }

  // 4. Despesas programadas não pagas vencendo até amanhã (ex.: seguro+rastreador)
  const { data: despesas } = await db
    .from('despesas')
    .select('tipo, valor, vencimento')
    .eq('pago', false)
    .not('vencimento', 'is', null)
    .lte('vencimento', addDias(1));
  for (const d of despesas || []) {
    alertas.push('🧾 ' + d.tipo + (d.valor ? ' ' + brl(d.valor) : '') + ' — vence ' + fmt(d.vencimento));
  }

  if (!alertas.length) {
    return new Response(JSON.stringify({ ok: true, alertas: 0 }), { status: 200 });
  }

  const payload = JSON.stringify({
    title: '🏍️ Vrunn — ' + alertas.length + ' alerta(s) hoje',
    body: alertas.slice(0, 6).join('\n') + (alertas.length > 6 ? '\n…e mais ' + (alertas.length - 6) : ''),
    tag: 'vrunn-diario',
    url: '/Empresa-de-motos-/'
  });

  const { data: subs } = await db.from('push_subscriptions').select('*');
  let enviados = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
      enviados++;
    } catch (err: any) {
      // Inscrição expirada/cancelada — remove do banco
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, alertas: alertas.length, enviados }), { status: 200 });
});
