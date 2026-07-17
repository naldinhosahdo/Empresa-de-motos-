// Vrunn — Gestão de Aluguel de Veículos
// Backend: Supabase

// ── ÍCONES SVG (Lucide-style, para uso em HTML gerado dinamicamente) ──
var IC = {
  warn:    '<span class="ic ic-16"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></span>',
  check:   '<span class="ic ic-16"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>',
  chkCirc: '<span class="ic ic-16"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>',
  cal:     '<span class="ic ic-16"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg></span>',
  clock:   '<span class="ic ic-16"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>',
  wrench:  '<span class="ic ic-16"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></span>',
  receipt: '<span class="ic ic-16"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>',
  dot_red: '<span class="ic-dot ic-dot-red"></span>',
  dot_yel: '<span class="ic-dot ic-dot-yellow"></span>',
  dot_grn: '<span class="ic-dot ic-dot-green"></span>',
};

function _initIcons() { if (typeof lucide !== 'undefined') lucide.createIcons(); }

const SUPABASE_URL = 'https://ohukqqyktkrvqedhozgk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odWtxcXlrdGtydnFlZGhvemdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODkzMTQsImV4cCI6MjA5NTI2NTMxNH0.yKCkjINcQNcxiIqkfRUA507KlFymzTsInHTa6ObZzTM';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
var _pendingNotifKey = null;

// --- CONFIGURAÇÕES DO LOCADOR ---
var _configCache = { nome: '', cpf: '', endereco: '', cidade: 'Fortaleza/CE', anthropic_key: '' };

async function loadConfig() {
  var { data } = await db.from('config').select('*').eq('id', 1).single();
  if (data) _configCache = data;
}

function getConfig() {
  return _configCache;
}

function abrirConfig() {
  var c = getConfig();
  document.getElementById('config-nome').value     = c.nome     || '';
  document.getElementById('config-cpf').value      = c.cpf      || '';
  document.getElementById('config-endereco').value = c.endereco || '';
  document.getElementById('config-cidade').value        = c.cidade        || '';
  document.getElementById('config-anthropic-key').value = c.anthropic_key || '';
  openModal('modal-config');
}

async function salvarConfig() {
  var c = {
    id:            1,
    nome:          document.getElementById('config-nome').value.trim(),
    cpf:           document.getElementById('config-cpf').value.trim(),
    endereco:      document.getElementById('config-endereco').value.trim(),
    cidade:        document.getElementById('config-cidade').value.trim(),
    anthropic_key: document.getElementById('config-anthropic-key').value.trim()
  };
  if (!c.nome || !c.cpf) { alert('Nome e CPF são obrigatórios.'); return; }
  var { error } = await db.from('config').upsert(c, { onConflict: 'id' });
  if (error) { alert('Erro ao salvar: ' + error.message); return; }
  _configCache = c;
  closeModal('modal-config');
  alert('Configurações salvas com sucesso!');
}

// --- FORMATTERS ---
function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
// Data de hoje no fuso local (YYYY-MM-DD) — evita erro de UTC à noite
function hojeLocalStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fmtDate(d) {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return day + '/' + m + '/' + y;
}
function veiculoLabel(v) { return v.modelo + (v.placa ? ' · ' + v.placa : ''); }

function statusBadge(status, type) {
  const maps = {
    veiculo: { disponivel: ['green','Disponível'], alugada: ['blue','Alugado'], manutencao: ['yellow','Manutenção'] },
    aluguel: { ativo: ['blue','Ativo'], finalizado: ['green','Finalizado'], cancelado: ['red','Cancelado'] }
  };
  const [color, label] = (maps[type] && maps[type][status]) ? maps[type][status] : ['gray', status];
  return '<span class="badge badge-' + color + '">' + label + '</span>';
}

function showLoading(tbodyId, cols) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = '<tr class="empty-row"><td colspan="' + cols + '">Carregando...</td></tr>';
}

// --- NOTIFICAÇÕES ---
function getNotifDismissed() {
  try { return JSON.parse(localStorage.getItem('notif_dismissed') || '[]'); } catch(e) { return []; }
}
function setNotifDismissed(arr) {
  // Descarta entradas de dias anteriores para não acumular no localStorage
  var today = hojeLocalStr();
  localStorage.setItem('notif_dismissed', JSON.stringify(
    arr.filter(function(k) { return k.endsWith('|' + today); })
  ));
}
function dismissNotif(key) {
  var dismissed = getNotifDismissed();
  var dated = key + '|' + hojeLocalStr();
  if (!dismissed.includes(dated)) dismissed.push(dated);
  setNotifDismissed(dismissed);
  loadNotificacoes();
}
function dismissAllNotif() {
  if (!confirm('Tem certeza que deseja limpar todas as notificações?')) return;
  var items = document.querySelectorAll('#notif-list [data-key]');
  var dismissed = getNotifDismissed();
  var today = hojeLocalStr();
  items.forEach(function(el) {
    var k = el.getAttribute('data-key');
    var dated = k + '|' + today;
    if (k && !dismissed.includes(dated)) dismissed.push(dated);
  });
  setNotifDismissed(dismissed);
  loadNotificacoes();
}

function calcularValorParcela(valorOriginal, vencimento, dataPagamento) {
  var venc = new Date(vencimento + 'T00:00:00');
  var pag  = new Date(dataPagamento + 'T00:00:00');
  var diffDias = Math.round((pag - venc) / 86400000);
  if (diffDias < 0) {
    var desc = valorOriginal * 0.03;
    return { valor: valorOriginal - desc, descricao: 'Desconto 3%: −' + fmtBRL(desc), tipo: 'desconto' };
  } else if (diffDias === 0) {
    return { valor: valorOriginal, descricao: 'Pago no vencimento — sem ajuste', tipo: 'normal' };
  } else {
    // Multa: 2% uma única vez + juros de 1% ao mês (0,0333% ao dia)
    var multaUnica = valorOriginal * 0.02;
    var jurosDia   = valorOriginal * (0.01 / 30) * diffDias;
    var total      = multaUnica + jurosDia;
    var desc       = 'Multa 2%: +' + fmtBRL(multaUnica) + ' · Juros (' + diffDias + ' dia(s) × 0,033%/dia): +' + fmtBRL(jurosDia);
    return { valor: valorOriginal + total, descricao: desc, tipo: 'multa' };
  }
}

function abrirPagarParcela(parcelaId, aluguelId, valorOriginal, vencimento, descricao, notifKey) {
  document.getElementById('pagar-parcela-id').value = parcelaId;
  document.getElementById('pagar-parcela-aluguel-id').value = aluguelId || '';
  document.getElementById('pagar-parcela-notif-key').value = notifKey || '';
  document.getElementById('pagar-parcela-valor-original').value = valorOriginal;
  document.getElementById('pagar-parcela-vencimento').value = vencimento;
  document.getElementById('pagar-parcela-data').value = hojeLocalStr();
  document.getElementById('pagar-parcela-info').innerHTML =
    '<strong>' + descricao + '</strong><br>Vencimento: ' + fmtDate(vencimento) + ' · Valor original: ' + fmtBRL(valorOriginal);
  atualizarCalcParcela();
  openModal('modal-pagar-parcela');
}

function atualizarCalcParcela() {
  var valorOriginal = Number(document.getElementById('pagar-parcela-valor-original').value);
  var vencimento    = document.getElementById('pagar-parcela-vencimento').value;
  var dataPag       = document.getElementById('pagar-parcela-data').value;
  if (!dataPag || !vencimento) return;
  var calc = calcularValorParcela(valorOriginal, vencimento, dataPag);
  var cor = calc.tipo === 'desconto' ? 'var(--green)' : calc.tipo === 'multa' ? 'var(--red)' : 'var(--text)';
  document.getElementById('pagar-parcela-calc').innerHTML =
    '<div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.25rem">' + calc.descricao + '</div>' +
    '<div style="font-size:1.1rem;font-weight:700;color:' + cor + '">Total a receber: ' + fmtBRL(calc.valor) + '</div>';
}

async function submitPagarParcela() {
  var parcelaId  = document.getElementById('pagar-parcela-id').value;
  var aluguelId  = document.getElementById('pagar-parcela-aluguel-id').value;
  var notifKey   = document.getElementById('pagar-parcela-notif-key').value;
  var valorOrig  = Number(document.getElementById('pagar-parcela-valor-original').value);
  var vencimento = document.getElementById('pagar-parcela-vencimento').value;
  var dataPag    = document.getElementById('pagar-parcela-data').value;
  if (!dataPag) { alert('Informe a data do pagamento.'); return; }
  var calc = calcularValorParcela(valorOrig, vencimento, dataPag);
  var valorPago = Math.round(calc.valor * 100) / 100;
  await db.from('parcelas').update({ pago: true, data_pagamento: dataPag, valor_pago: valorPago }).eq('id', parcelaId);
  closeModal('modal-pagar-parcela');
  if (notifKey) dismissNotif(notifKey);
  renderDashboard();
  loadNotificacoes();
  if (aluguelId && document.getElementById('modal-parcelas').classList.contains('open')) {
    abrirParcelas(aluguelId);
  }
}

async function pagarParcelaNotif(parcelaId, aluguelId, key) {
  var hoje = hojeLocalStr();
  await db.from('parcelas').update({ pago: true, data_pagamento: hoje }).eq('id', parcelaId);
  dismissNotif(key);
  renderDashboard();
}

async function loadNotificacoes() {
  var hoje = new Date();
  hoje.setHours(0,0,0,0);
  var em30 = new Date(hoje.getTime() + 30 * 86400000);
  var em30Str = em30.toISOString().split('T')[0];
  var em10Str = new Date(hoje.getTime() + 10 * 86400000).toISOString().split('T')[0];
  var em5Str  = new Date(hoje.getTime() + 5  * 86400000).toISOString().split('T')[0];
  var em2Str  = new Date(hoje.getTime() + 2  * 86400000).toISOString().split('T')[0];
  var em7Str  = em10Str;

  var hoje0Str = hojeLocalStr();
  var ha30 = new Date(hoje); ha30.setDate(ha30.getDate() - 30);
  var ha30Str = ha30.toISOString().split('T')[0];

  var [{ data: despesasData }, { data: manutData }, { data: alugData }, { data: parcelasData }, { data: veiculosData }, { data: progsData }, { data: caucaoData }] = await Promise.all([
    db.from('despesas').select('*, veiculos(modelo, placa)')
      .lte('vencimento', em10Str).not('vencimento', 'is', null).order('vencimento'),
    db.from('manutencoes').select('*, veiculos(modelo, placa)')
      .lte('prox_data', em7Str).not('prox_data', 'is', null).order('prox_data'),
    db.from('alugueis').select('*, veiculos(modelo, placa)')
      .eq('status', 'ativo').lte('fim', em10Str).not('fim', 'is', null).order('fim'),
    db.from('parcelas').select('*, alugueis!inner(cliente, status, veiculos(modelo, placa))')
      .eq('pago', false).eq('alugueis.status', 'ativo').lte('vencimento', em2Str).order('vencimento'),
    db.from('veiculos').select('id, modelo, placa, km_atual, seguro_rastreador_mensal'),
    db.from('manut_programada').select('*, veiculos(modelo, placa, km_atual)'),
    db.from('alugueis').select('*, veiculos(modelo, placa)')
      .eq('status', 'encerrado').gt('caucao', 0).neq('caucao_devolvido', 'sim').lte('fim', ha30Str)
  ]);

  var alertasDespesas = (despesasData || []).filter(function(d) { return !d.pago && !d.programada; }).map(function(d) {
    return { key: 'despesa_' + d.id, data: d.vencimento, label: d.tipo, veiculo: d.veiculos, valor: fmtBRL(d.valor), tipo: 'despesa' };
  });
  var alertasManut = (manutData || []).map(function(m) {
    return { key: 'manut_' + m.id, data: m.prox_data, label: 'Manutenção: ' + (m.descricao || 'sem descrição'), veiculo: m.veiculos, valor: m.prox_km ? m.prox_km + ' km' : '', tipo: 'manut' };
  });
  var alertasAlug = (alugData || []).map(function(x) {
    return { key: 'aluguel_' + x.id, data: x.fim, label: 'Contrato vence — ' + (x.cliente || '-'), veiculo: x.veiculos, valor: '', tipo: 'aluguel', aluguelId: x.id };
  });
  var alertasParcelas = (parcelasData || []).map(function(p) {
    var alu = p.alugueis || {};
    return { key: 'parcela_' + p.id, data: p.vencimento, label: p.descricao + ' — ' + (alu.cliente || '-'), veiculo: alu.veiculos, valor: fmtBRL(p.valor), tipo: 'parcela', parcelaId: p.id, aluguelId: p.aluguel_id, valorNum: p.valor, vencimentoStr: p.vencimento };
  });

  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  var anoHoje  = hoje.getFullYear();
  var mesHoje  = hoje.getMonth() + 1;
  var diaHoje  = hoje.getDate();
  var alertasRecorrentes = [];
  (veiculosData || []).forEach(function(vei) {
    var vl = { modelo: vei.modelo, placa: vei.placa };
    // IPVA — notifica do dia 1 ao dia 9 de fev/mar/abr/mai/jun (9 dias antes do vencimento dia 10)
    if ([2, 3, 4, 5, 6].indexOf(mesHoje) !== -1 && diaHoje >= 1 && diaHoje < 10) {
      var numParc = mesHoje - 1; // fev=1, mar=2, abr=3, mai=4, jun=5
      var dIPVA = anoHoje + '-' + p2(mesHoje) + '-10';
      alertasRecorrentes.push({ key: 'ipva_' + vei.id + '_' + anoHoje + '_' + mesHoje, data: dIPVA,
        label: 'IPVA parcela ' + numParc + '/5',
        veiculo: vl, valor: '', tipo: 'recorrente', veiculoId: vei.id, tipoLabel: 'IPVA' });
    }
    // Licenciamento — dia 10, mês = (último dígito da placa) + 2, avisa com 30 dias
    if (vei.placa) {
      var digitos = vei.placa.replace(/\D/g, '');
      var ult = digitos.length ? parseInt(digitos.slice(-1)) : null;
      if (ult !== null) {
        var mesLic = (ult === 0 ? 10 : ult) + 2;
        var anoLic = anoHoje;
        if (mesLic > 12) { mesLic -= 12; anoLic++; }
        var dLic = anoLic + '-' + p2(mesLic) + '-10';
        if (dLic < hoje0Str) dLic = (anoLic + 1) + '-' + p2(mesLic) + '-10';
        if (dLic >= hoje0Str && dLic <= em10Str) {
          alertasRecorrentes.push({ key: 'lic_' + vei.id + '_' + dLic, data: dLic,
            label: 'Licenciamento vence',
            veiculo: vl, valor: '', tipo: 'recorrente', veiculoId: vei.id, tipoLabel: 'Licenciamento' });
        }
      }
    }
    // Seguro + Rastreador — avisa 2 dias antes e persiste até ser pago
    if (vei.seguro_rastreador_mensal) {
      var segOverride = (despesasData || []).find(function(d) {
        return d.veiculo_id === vei.id && d.programada && !d.pago && d.tipo === 'Seguro + Rastreador';
      });
      var dSegFinal;
      if (segOverride) {
        dSegFinal = segOverride.vencimento;
      } else {
        var isPagoSeg = function(vencStr) {
          return (despesasData || []).some(function(d) {
            return d.veiculo_id === vei.id && d.pago && d.tipo === 'Seguro + Rastreador' && d.vencimento === vencStr;
          });
        };
        var dSegDate = new Date(hoje.getFullYear(), hoje.getMonth(), 10);
        var dSegDateStr = dSegDate.getFullYear() + '-' + p2(dSegDate.getMonth() + 1) + '-10';
        while (isPagoSeg(dSegDateStr)) {
          dSegDate = new Date(dSegDate.getFullYear(), dSegDate.getMonth() + 1, 10);
          dSegDateStr = dSegDate.getFullYear() + '-' + p2(dSegDate.getMonth() + 1) + '-10';
        }
        dSegFinal = dSegDateStr;
      }
      if (dSegFinal <= em5Str) {
        alertasRecorrentes.push({ key: 'seguro_' + vei.id + '_' + dSegFinal, data: dSegFinal,
          label: 'Seguro + Rastreador',
          veiculo: vl, valor: fmtBRL(vei.seguro_rastreador_mensal), tipo: 'recorrente', veiculoId: vei.id, tipoLabel: 'Seguro' });
      }
    }
  });

  // Manutenção programada — alerta quando km_atual >= proxima_km - 100
  (progsData || []).forEach(function(p) {
    var vei = p.veiculos;
    if (!p.ultima_km || !vei || !vei.km_atual) return;
    var proximaKm = Number(p.ultima_km) + Number(p.intervalo_km);
    var restante = proximaKm - Number(vei.km_atual);
    if (restante > 100) return;
    var vencido = restante <= 0;
    var kmTexto = vencido ? IC.warn + ' Vencido (' + Math.abs(restante).toLocaleString('pt-BR') + ' km atrás)' : IC.dot_red + ' Faltam ' + restante.toLocaleString('pt-BR') + ' km';
    alertasRecorrentes.push({
      key: 'prog_' + p.id + '_' + Math.floor(Number(vei.km_atual) / Number(p.intervalo_km)),
      data: hoje0Str,
      label: (p.item || 'Manutenção'),
      veiculo: { modelo: vei.modelo, placa: vei.placa },
      valor: kmTexto,
      tipo: 'recorrente'
    });
  });

  var alertasCaucao = (caucaoData || []).map(function(x) {
    return { key: 'caucao_' + x.id, data: x.fim, label: '💰 Devolver caução — ' + (x.cliente || '-'), veiculo: x.veiculos, valor: fmtBRL(x.caucao), tipo: 'caucao', aluguelId: x.id };
  });

  var todosAlertas = alertasDespesas.concat(alertasManut).concat(alertasAlug).concat(alertasParcelas).concat(alertasRecorrentes).concat(alertasCaucao).sort(function(a, b) {
    return a.data < b.data ? -1 : a.data > b.data ? 1 : 0;
  });

  var dismissed = getNotifDismissed();
  var alertas = todosAlertas.filter(function(a) { return !dismissed.includes(a.key + '|' + hoje0Str); });

  var badge = document.getElementById('notif-badge');
  var list  = document.getElementById('notif-list');

  if (!alertas.length) {
    badge.style.display = 'none';
    list.innerHTML = '<div class="notif-vazio">' + IC.chkCirc + ' Nenhum alerta no momento</div>';
    return;
  }

  badge.style.display = 'flex';
  badge.textContent = alertas.length;

  list.innerHTML = alertas.map(function(a) {
    var venc    = new Date(a.data + 'T00:00:00');
    var diff    = Math.ceil((venc - hoje) / 86400000);
    var urgente = diff <= 7;
    var cls     = urgente ? 'notif-urgente' : 'notif-atencao';
    var vei     = a.veiculo ? (a.veiculo.modelo + (a.veiculo.placa ? ' · ' + a.veiculo.placa : '')) : '-';
    var safeKey = a.key.replace(/'/g, "\\'");
    var safeLabel = (a.label || '').replace(/'/g, "\\'");
    var quando = diff < 0
      ? (a.tipo === 'caucao' ? IC.warn + ' Encerrado há ' + Math.abs(diff) + ' dia(s) — prazo de 30 dias atingido' : IC.warn + ' Venceu há ' + Math.abs(diff) + ' dia(s)')
      : diff === 0 ? IC.dot_red + ' Vence hoje!'
      : urgente ? IC.dot_red + ' Vence em ' + diff + ' dia(s)'
      : IC.dot_yel + ' Vence em ' + diff + ' dia(s)';
    var pagarBtn = a.tipo === 'parcela' && a.parcelaId && a.aluguelId
      ? '<button class="btn btn-sm btn-primary" style="font-size:0.72rem;padding:3px 8px;margin-right:4px" onclick="abrirPagarParcela(\'' + a.parcelaId + '\',\'' + a.aluguelId + '\',' + a.valorNum + ',\'' + a.vencimentoStr + '\',\'' + safeLabel + '\',\'' + safeKey + '\')">Pago</button>'
      : a.tipo === 'caucao' && a.aluguelId
        ? '<button class="btn btn-sm btn-primary" style="font-size:0.72rem;padding:3px 8px;margin-right:4px" onclick="marcarCaucaoDevolvido(\'' + a.aluguelId + '\',\'' + safeKey + '\')">✅ Devolver caução</button>'
        : '';
    var _c = "document.getElementById('notif-dropdown').style.display='none';";
    var bodyClick;
    if (a.tipo === 'parcela' && a.aluguelId) {
      bodyClick = 'onclick="' + _c + 'abrirParcelas(\'' + a.aluguelId + '\')" style="cursor:pointer"';
    } else if (a.tipo === 'aluguel') {
      bodyClick = 'onclick="' + _c + 'abrirModalRenovacao(\'' + a.aluguelId + '\')" style="cursor:pointer"';
    } else if (a.tipo === 'manut') {
      bodyClick = 'onclick="' + _c + 'showSection(\'custos-geral\');showCustosTab(\'manutencoes\')" style="cursor:pointer"';
    } else if (a.tipo === 'despesa') {
      bodyClick = 'onclick="' + _c + 'showSection(\'custos-geral\');showCustosTab(\'despesas\')" style="cursor:pointer"';
    } else if (a.tipo === 'recorrente' && a.key.indexOf('prog_') === 0) {
      bodyClick = 'onclick="' + _c + 'showSection(\'custos-geral\');showCustosTab(\'manutencoes\')" style="cursor:pointer"';
    } else if (a.tipo === 'recorrente' && a.veiculoId && a.tipoLabel) {
      bodyClick = 'onclick="' + _c + 'abrirDespesaNotif(\'' + a.veiculoId + '\',\'' + a.tipoLabel + '\',\'' + a.data + '\',\'' + safeKey + '\')" style="cursor:pointer"';
    } else if (a.tipo === 'recorrente') {
      bodyClick = 'onclick="' + _c + 'showSection(\'custos-geral\');showCustosTab(\'despesas\')" style="cursor:pointer"';
    } else {
      bodyClick = '';
    }
    return '<div class="notif-item ' + cls + '" data-key="' + a.key + '">' +
      '<div class="notif-item-body" ' + bodyClick + '>' +
        '<div class="notif-item-titulo">' + a.label + ' — ' + vei + '</div>' +
        '<div class="notif-item-desc">' + quando + (a.valor ? ' · ' + a.valor : '') + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:2px">' +
        pagarBtn +
        '<button class="notif-dismiss" onclick="dismissNotif(\'' + safeKey + '\')" title="Dispensar">×</button>' +
      '</div>' +
    '</div>';
  }).join('');
  _initIcons();
}

function toggleNotif() {
  var dd = document.getElementById('notif-dropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', function(e) {
  var wrapper = document.querySelector('.notif-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    document.getElementById('notif-dropdown').style.display = 'none';
  }
});

// --- AUTH ---
async function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-wrapper').style.display = 'block';
  _initIcons();
  history.replaceState({ section: 'dashboard' }, '', '#dashboard');
  await loadConfig();
  renderDashboard();
  loadNotificacoes();
  initPushSilencioso();
}

// --- PUSH NOTIFICATIONS ---
var VAPID_PUBLIC_KEY = 'BLbdWTKS_A8et8ClLU0PbSAeuCxFueD29gEUIodPRlDTpZ4vUN7_955gTRrKoQWcoMQ4YBHL-REr-Txu2YZcJyY';

function _urlB64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var raw = atob(base64);
  var arr = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function _subscribePush() {
  var reg = await navigator.serviceWorker.ready;
  var sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: _urlB64ToUint8Array(VAPID_PUBLIC_KEY)
  });
  var json = sub.toJSON();
  await db.from('push_subscriptions').upsert({
    endpoint: sub.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth
  }, { onConflict: 'endpoint' });
}

// Re-inscreve silenciosamente se a permissão já foi dada antes
async function initPushSilencioso() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    await _subscribePush();
  } catch(e) { /* silencioso */ }
}

// Chamado pelo botão nas configurações (precisa de clique do usuário)
async function ativarNotificacoes() {
  var status = document.getElementById('push-status');
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      status.textContent = '⚠ Este navegador não suporta notificações push.';
      return;
    }
    status.textContent = 'Solicitando permissão...';
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      status.textContent = '⚠ Permissão negada. Libere as notificações nas configurações do navegador.';
      return;
    }
    status.textContent = 'Registrando este aparelho...';
    await _subscribePush();
    status.style.color = 'var(--green)';
    status.textContent = '✅ Notificações ativadas neste aparelho!';
  } catch(e) {
    status.style.color = 'var(--red)';
    status.textContent = '⚠ Erro: ' + (e.message || e);
  }
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-wrapper').style.display = 'none';
}

async function doLogin(e) {
  e.preventDefault();
  var btn  = document.getElementById('login-btn');
  var erro = document.getElementById('login-erro');
  btn.textContent = 'Entrando...';
  btn.disabled = true;
  erro.style.display = 'none';
  var email = document.getElementById('login-email').value.trim().toLowerCase();
  var pass  = document.getElementById('login-pass').value;
  try {
    var { error } = await db.auth.signInWithPassword({ email: email, password: pass });
    if (error) {
      erro.textContent = 'E-mail ou senha incorretos.';
      erro.style.display = 'block';
      btn.textContent = 'Entrar';
      btn.disabled = false;
    } else {
      showApp();
    }
  } catch(ex) {
    erro.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
    erro.style.display = 'block';
    btn.textContent = 'Entrar';
    btn.disabled = false;
  }
}

async function esqueceuSenha(e) {
  e.preventDefault();
  var email = document.getElementById('login-email').value.trim().toLowerCase();
  if (!email) { alert('Digite seu e-mail antes de clicar em "Esqueci minha senha".'); return; }
  var { error } = await db.auth.resetPasswordForEmail(email);
  if (error) {
    alert('Erro ao enviar: ' + error.message);
  } else {
    alert('Link de redefinição enviado para ' + email + '. Verifique sua caixa de entrada.');
  }
}

async function doLogout() {
  await db.auth.signOut();
  showLogin();
}

db.auth.getSession().then(function(res) {
  if (res.data.session) { showApp(); } else { showLogin(); }
});

// --- NAVIGATION ---
function showSection(name, addHistory, renderOpts) {
  document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(a) { a.classList.remove('active'); });
  document.getElementById(name).classList.add('active');
  var link = document.querySelector('[data-section="' + name + '"]');
  if (link) link.classList.add('active');
  document.getElementById('navLinks').classList.remove('open');

  if (name === 'dashboard')  renderDashboard();
  if (name === 'clientes')   renderClientes();
  if (name === 'motos')      renderVeiculos();
  if (name === 'alugueis')   { populateClienteSelect(); populateVeiculoSelects(); renderAlugueis(renderOpts && renderOpts.ordenarPorVencimento); }
  if (name === 'custos-geral') { showCustosTab('manutencoes'); }
  if (name === 'relatorios') renderRelatorios();
  if (name === 'checklist')  buildChecklist();
  if (name === 'cobrancas')  renderCobrancas();
  if (name === 'caucao')     renderCaucao();
  if (name === 'multas')     renderMultas();

  if (addHistory !== false) {
    history.pushState({ section: name }, '', '#' + name);
  }
}

async function abrirModalRenovacao(aluguelId) {
  const { data: a } = await db.from('alugueis').select('*').eq('id', aluguelId).single();
  if (!a) return;
  document.getElementById('form-aluguel').reset();
  document.getElementById('aluguel-id').value = '';
  await populateVeiculoSelects();
  await populateClienteSelect();
  document.getElementById('aluguel-moto').value              = a.veiculo_id || '';
  document.getElementById('aluguel-cliente-select').value    = a.cliente_id || '';
  document.getElementById('aluguel-cpf').value               = a.cpf || '';
  document.getElementById('aluguel-telefone').value          = a.telefone || '';
  document.getElementById('aluguel-cnh').value               = a.cnh || '';
  document.getElementById('aluguel-endereco').value          = a.endereco || '';
  document.getElementById('aluguel-periodo').value           = a.periodo || 'semana';
  document.getElementById('aluguel-valor').value             = a.valor || '';
  document.getElementById('aluguel-caucao').value            = a.caucao || '';
  document.getElementById('aluguel-caucao-devolvido').value  = 'nao';
  document.getElementById('aluguel-status').value            = 'ativo';
  document.getElementById('row-caucao-data').style.display   = 'none';
  document.getElementById('modal-aluguel-title').textContent = 'Renovar Contrato';
  openModal('modal-aluguel');
}

function abrirContratosVencer() {
  var fmEl = document.getElementById('filtro-moto-aluguel');
  if (fmEl) fmEl.value = '';
  document.getElementById('filtro-status-aluguel').value = 'ativo';
  showSection('alugueis', true, { ordenarPorVencimento: true });
}

window.addEventListener('popstate', function(e) {
  var section = (e.state && e.state.section) || 'dashboard';
  showSection(section, false);
});

// Todos os campos de texto em maiúsculo automaticamente
document.addEventListener('input', function(e) {
  var el = e.target;
  var skip = ['date', 'number', 'password', 'email', 'checkbox', 'radio'];
  if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && skip.indexOf(el.type) === -1 && el.inputMode !== 'decimal' && el.inputMode !== 'numeric')) {
    var pos = el.selectionStart;
    el.value = el.value.toUpperCase();
    el.setSelectionRange(pos, pos);
  }
});

document.querySelectorAll('.nav-item').forEach(function(a) {
  a.addEventListener('click', function(e) {
    e.preventDefault();
    if (a.dataset.section) showSection(a.dataset.section);
  });
});

document.getElementById('hamburger').addEventListener('click', function() {
  document.getElementById('navLinks').classList.toggle('open');
});

// --- MODALS ---
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// --- DASHBOARD ---
async function renderDashboard() {
  const [{ data: veiculos }, { data: alugueis }, { data: manutencoes }, { data: despesas }, { data: parcelasPagas }, { data: parcelasAbertas }, { data: clientes }] = await Promise.all([
    db.from('veiculos').select('*'),
    db.from('alugueis').select('*'),
    db.from('manutencoes').select('*'),
    db.from('despesas').select('*'),
    db.from('parcelas').select('*, alugueis(veiculo_id, caucao)').eq('pago', true),
    db.from('parcelas').select('*, alugueis!inner(cliente, status, veiculos(modelo, placa))').eq('pago', false).eq('alugueis.status', 'ativo').order('vencimento'),
    db.from('clientes').select('id')
  ]);

  const v = veiculos || [], a = alugueis || [], m = manutencoes || [], d = despesas || [], pp = parcelasPagas || [], pa = parcelasAbertas || [], cl = clientes || [];

  var hoje = new Date();
  var hojeStr = hojeLocalStr();
  var anoMes = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');

  var aNaoCancelado = a.filter(function(x) { return x.status !== 'cancelado'; });

  // Receita = parcelas pagas excluindo o caução (que fica no card próprio)
  function valorSemCaucao(p) {
    var v = Number(p.valor_pago || p.valor || 0);
    if (p.numero === 1 && p.alugueis && p.alugueis.caucao) v = Math.max(0, v - Number(p.alugueis.caucao));
    return v;
  }
  var receitaTotal = pp.reduce(function(s, x) { return s + valorSemCaucao(x); }, 0);
  var receitaMes   = pp.filter(function(x) { return x.data_pagamento && x.data_pagamento.startsWith(anoMes); })
                       .reduce(function(s, x) { return s + valorSemCaucao(x); }, 0);

  // Apenas despesas efetivamente pagas (programadas quitadas)
  var dPago = d.filter(function(x) { return x.pago; });
  var custosTotal = m.reduce(function(s, x) { return s + Number(x.custo || 0); }, 0)
                  + dPago.reduce(function(s, x) { return s + Number(x.valor || 0); }, 0);
  var custosMes   = m.filter(function(x) { return x.data && x.data.startsWith(anoMes); })
                    .reduce(function(s, x) { return s + Number(x.custo || 0); }, 0)
                  + dPago.filter(function(x) { return x.vencimento && x.vencimento.startsWith(anoMes); })
                    .reduce(function(s, x) { return s + Number(x.valor || 0); }, 0);

  var lucroTotal = receitaTotal - custosTotal;
  var lucroMes   = receitaMes - custosMes;

  document.getElementById('dash-receita-mes').textContent       = fmtBRL(receitaMes);
  document.getElementById('dash-receita-total').textContent     = fmtBRL(receitaTotal);

  document.getElementById('dash-custos-mes').textContent       = fmtBRL(custosMes);
  document.getElementById('dash-custos').textContent           = fmtBRL(custosTotal);

  var lucroMesEl = document.getElementById('dash-lucro-mes');
  lucroMesEl.textContent = fmtBRL(lucroMes);
  lucroMesEl.style.color = lucroMes >= 0 ? 'var(--green)' : 'var(--red)';
  var lucroTotalEl = document.getElementById('dash-lucro');
  lucroTotalEl.textContent = fmtBRL(lucroTotal);
  lucroTotalEl.style.color = lucroTotal >= 0 ? 'var(--green)' : 'var(--red)';

  // Operational metrics — derived from veiculos status (source of truth)
  var motosAlugadas    = v.filter(function(x) { return x.status === 'alugada'; }).length;
  var motosDisponiveis = v.filter(function(x) { return x.status === 'disponivel'; }).length;

  document.getElementById('dash-frota-total').textContent       = v.length;
  document.getElementById('dash-frota-alugadas').textContent    = motosAlugadas;
  document.getElementById('dash-frota-disponiveis').textContent = motosDisponiveis;

  var limite5d = new Date(hojeStr);
  limite5d.setDate(limite5d.getDate() + 5);
  var limite5dStr = limite5d.toISOString().split('T')[0];
  var vencer = a.filter(function(x) {
    return x.status === 'ativo' && x.fim && x.fim >= hojeStr && x.fim <= limite5dStr;
  }).length;
  document.getElementById('dash-vencer').textContent = vencer;
  document.getElementById('dash-clientes-total').textContent = cl.length;

  var caucaoPendente = aNaoCancelado
    .filter(function(x) { return x.caucao_devolvido !== 'sim'; })
    .reduce(function(s, x) { return s + Number(x.caucao || 0); }, 0);
  document.getElementById('dash-caucao').textContent = fmtBRL(caucaoPendente);

  // Occupancy: dias alugados no mês / (dias no mês × total de motos)
  var mesInicioStr = anoMes + '-01';
  var diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  var mesFimStr = anoMes + '-' + String(diasNoMes).padStart(2, '0');
  var diasAlugados = aNaoCancelado.reduce(function(sum, al) {
    if (!al.inicio) return sum;
    var inicio = al.inicio < mesInicioStr ? mesInicioStr : al.inicio;
    var fimReal = al.fim && al.fim < hojeStr ? al.fim : hojeStr;
    var fim = fimReal < mesFimStr ? fimReal : mesFimStr;
    if (fim < inicio) return sum;
    return sum + Math.round((new Date(fim) - new Date(inicio)) / 86400000) + 1;
  }, 0);
  var ocupacao = v.length > 0
    ? Math.min(100, Math.round(diasAlugados / (diasNoMes * v.length) * 100))
    : 0;
  document.getElementById('dash-ocupacao').textContent = ocupacao + '%';

  // Vencimentos próximos (up to 30 days, including overdue)
  var vencimentos = [];
  a.forEach(function(x) {
    if (x.status !== 'ativo' || !x.fim) return;
    var diffDias = Math.round((new Date(x.fim) - new Date(hojeStr)) / 86400000);
    if (diffDias > 10) return;
    var vei = v.find(function(vv) { return vv.id === x.veiculo_id; });
    vencimentos.push({ tipo: 'Contrato', descricao: 'Fim do aluguel — ' + (x.cliente || '-'), moto: vei ? veiculoLabel(vei) : '-', dias: diffDias });
  });
  d.forEach(function(x) {
    if (!x.vencimento || x.pago) return;
    var diffDias = Math.round((new Date(x.vencimento) - new Date(hojeStr)) / 86400000);
    if (diffDias > 10) return;
    var vei = v.find(function(vv) { return vv.id === x.veiculo_id; });
    vencimentos.push({ tipo: 'Despesa', descricao: x.descricao || x.tipo || 'Despesa', moto: vei ? veiculoLabel(vei) : '-', dias: diffDias });
  });
  m.forEach(function(x) {
    if (!x.prox_data) return;
    var diffDias = Math.round((new Date(x.prox_data) - new Date(hojeStr)) / 86400000);
    if (diffDias > 10) return;
    var vei = v.find(function(vv) { return vv.id === x.veiculo_id; });
    vencimentos.push({ tipo: 'Manutenção', descricao: x.tipo || 'Manutenção', moto: vei ? veiculoLabel(vei) : '-', dias: diffDias });
  });
  vencimentos.sort(function(a, b) { return a.dias - b.dias; });

  var vencEl = document.getElementById('dash-vencimentos-list');
  if (vencimentos.length === 0) {
    vencEl.innerHTML = '<span style="color:var(--text2);font-size:0.85rem">Nenhum vencimento nos próximos 10 dias</span>';
  } else {
    vencEl.innerHTML = vencimentos.map(function(vc) {
      var cls = vc.dias < 0 ? 'vencido' : vc.dias <= 7 ? 'urgente' : vc.dias <= 15 ? 'proximo' : 'normal';
      var badge = vc.dias < 0 ? 'Vencido há ' + Math.abs(vc.dias) + 'd' : vc.dias === 0 ? 'Hoje' : 'Em ' + vc.dias + 'd';
      return '<div class="venc-item ' + cls + '">' +
        '<div style="min-width:0">' +
          '<div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + vc.descricao + '</div>' +
          '<div style="font-size:0.72rem;color:var(--text2)">' + vc.moto + ' &middot; ' + vc.tipo + '</div>' +
        '</div>' +
        '<span class="venc-badge ' + cls + '">' + badge + '</span>' +
      '</div>';
    }).join('');
  }

  // Moto mais rentável (baseado em parcelas pagas, sem caução)
  var motoReceita = {};
  pp.forEach(function(p) {
    var vid = p.alugueis && p.alugueis.veiculo_id;
    if (vid) motoReceita[vid] = (motoReceita[vid] || 0) + valorSemCaucao(p);
  });
  var motoIds = Object.keys(motoReceita);
  var rentavelEl = document.getElementById('dash-moto-rentavel');
  if (motoIds.length === 0) {
    rentavelEl.innerHTML = '<span style="color:var(--text2);font-size:0.85rem">Sem dados</span>';
  } else {
    var melhorId = motoIds.reduce(function(best, id) { return motoReceita[id] > motoReceita[best] ? id : best; });
    var melhorVei = v.find(function(vv) { return vv.id === melhorId; });
    var totalAlugs = aNaoCancelado.filter(function(x) { return x.veiculo_id === melhorId; }).length;
    rentavelEl.innerHTML = '<div class="moto-rentavel-card">' +
      '<div class="moto-rentavel-nome">' + (melhorVei ? veiculoLabel(melhorVei) : melhorId) + '</div>' +
      '<div class="moto-rentavel-valor">' + fmtBRL(motoReceita[melhorId]) + ' receita total</div>' +
      '<div class="moto-rentavel-sub">' + totalAlugs + ' aluguel(s) registrado(s)</div>' +
    '</div>';
  }

  // Próximas parcelas em aberto (todas)
  var proximasParcelas = pa;
  var parcelasEl = document.getElementById('dash-parcelas-list');
  if (proximasParcelas.length === 0) {
    parcelasEl.innerHTML = '<span style="color:var(--text2);font-size:0.85rem">Nenhuma parcela em aberto</span>';
  } else {
    parcelasEl.innerHTML = proximasParcelas.map(function(p) {
      var alu = p.alugueis || {};
      var vei = alu.veiculos;
      var atrasada = p.vencimento < hojeStr;
      var hoje0    = p.vencimento === hojeStr;
      var cor = atrasada ? 'var(--red)' : hoje0 ? 'var(--yellow)' : 'var(--text2)';
      var status = atrasada ? IC.warn + ' Atrasada' : hoje0 ? IC.dot_red + ' Vence hoje' : IC.cal + ' ' + fmtDate(p.vencimento);
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.55rem 0;border-bottom:1px solid var(--border)">' +
        '<div style="min-width:0">' +
          '<div style="font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (alu.cliente || '-') + (vei ? ' · ' + vei.modelo : '') + '</div>' +
          '<div style="font-size:0.75rem;color:' + cor + '">' + status + ' · ' + fmtBRL(p.valor) + '</div>' +
        '</div>' +
        '<button class="btn btn-sm btn-primary" style="font-size:0.72rem;white-space:nowrap;margin-left:0.5rem" onclick="abrirPagarParcela(\'' + p.id + '\',\'' + p.aluguel_id + '\',' + p.valor + ',\'' + p.vencimento + '\',\'' + (alu.cliente||'').replace(/'/g, "\\'") + '\',\'\')">Marcar pago</button>' +
      '</div>';
    }).join('');
  }
}

async function pagarParcelaDash(parcelaId, aluguelId) {
  var hoje = hojeLocalStr();
  await db.from('parcelas').update({ pago: true, data_pagamento: hoje }).eq('id', parcelaId);
  renderDashboard();
  loadNotificacoes();
}

// --- CLIENTES ---
var _clientesCache = [];

function renderClientesTabela(lista) {
  document.getElementById('clientes-count').textContent = lista.length;
  document.getElementById('clientes-tbody').innerHTML = lista.length
    ? lista.map(function(cl) {
        var cat = cl.cnh_categoria || '';
        var catBadge = cat
          ? (cat.indexOf('A') !== -1
              ? ' <span class="badge badge-green">' + cat + '</span>'
              : ' <span class="badge badge-red" title="Categoria não permite moto">' + cat + ' ⚠</span>')
          : '';
        return '<tr>' +
          '<td><strong>' + cl.nome + '</strong></td>' +
          '<td>' + (cl.cpf || '-') + '</td>' +
          '<td>' + (cl.telefone || '-') + '</td>' +
          '<td>' + (cl.cnh || '-') + catBadge + '</td>' +
          '<td>' + (cl.endereco || '-') + '</td>' +
          '<td>' +
            '<div class="btn-actions">' +
              '<button class="btn btn-sm btn-secondary" onclick="editCliente(\'' + cl.id + '\')">Editar</button>' +
              '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'cliente\',\'' + cl.id + '\')">Excluir</button>' +
            '</div>' +
          '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="6">Nenhum cliente encontrado</td></tr>';
}

function filtrarClientes() {
  var q = (document.getElementById('clientes-busca').value || '').toLowerCase().trim();
  if (!q) { renderClientesTabela(_clientesCache); return; }
  var filtrados = _clientesCache.filter(function(cl) {
    return (cl.nome || '').toLowerCase().includes(q)
        || (cl.cpf || '').toLowerCase().includes(q)
        || (cl.telefone || '').toLowerCase().includes(q);
  });
  renderClientesTabela(filtrados);
}

async function renderClientes() {
  showLoading('clientes-tbody', 6);
  var busca = document.getElementById('clientes-busca');
  if (busca) busca.value = '';
  const { data } = await db.from('clientes').select('*').order('nome');
  _clientesCache = data || [];
  renderClientesTabela(_clientesCache);
}

function abrirUrl(url) {
  var a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function consultarCPF(tipo) {
  var cpf = document.getElementById('cliente-cpf').value.replace(/\D/g, '');
  if (!cpf) { alert('Preencha o CPF antes de consultar.'); return; }
  navigator.clipboard.writeText(cpf).catch(function() {});
  if (tipo === 'detran') {
    abrirUrl('https://sistemas.detran.ce.gov.br/central');
  } else if (tipo === 'receita') {
    abrirUrl('https://servicos.receita.fazenda.gov.br/servicos/cpf/consultasituacao/consultapublica.asp');
  } else if (tipo === 'senatran') {
    window.location.href = 'intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=br.gov.serpro.lince;end';
  } else if (tipo === 'serasa') {
    abrirUrl('https://www.serasa.com.br/voceconsulta/');
  } else if (tipo === 'tjce') {
    abrirUrl('https://pje-consulta.tjce.jus.br/pje1grau/ConsultaPublica/listView.seam');
  } else if (tipo === 'jfce') {
    abrirUrl('https://pje.jfce.jus.br/pje/ConsultaPublica/listView.seam');
  } else {
    abrirUrl('https://www.gov.br/pf/pt-br/assuntos/antecedentes-criminais');
  }
  if (tipo !== 'senatran') {
    alert('CPF ' + cpf + ' copiado! Cole no campo de busca do site que abriu.');
  } else {
    alert('Abra o app Vio e escaneie o QR Code da CNH do cliente.');
  }
}

function openNewCliente() {
  document.getElementById('form-cliente').reset();
  document.getElementById('cliente-id').value = '';
  document.getElementById('modal-cliente-title').textContent = 'Novo Cliente';
  openModal('modal-cliente');
}

async function editCliente(id) {
  const { data: cl } = await db.from('clientes').select('*').eq('id', id).single();
  if (!cl) return;
  document.getElementById('cliente-id').value      = cl.id;
  document.getElementById('cliente-nome').value    = cl.nome || '';
  document.getElementById('cliente-cpf').value     = cl.cpf || '';
  document.getElementById('cliente-telefone').value= cl.telefone || '';
  document.getElementById('cliente-cnh').value     = cl.cnh || '';
  document.getElementById('cliente-endereco').value= cl.endereco || '';
  document.getElementById('cliente-obs').value     = cl.obs || '';
  document.getElementById('modal-cliente-title').textContent = 'Editar Cliente';
  openModal('modal-cliente');
}

async function extractTextFromPDF(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js não carregado');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = async function(e) {
      try {
        var pdf = await pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;
        var text = '';
        for (var i = 1; i <= pdf.numPages; i++) {
          var page = await pdf.getPage(i);
          var content = await page.getTextContent();
          text += content.items.map(function(it) { return it.str; }).join(' ') + '\n';
        }
        resolve(text);
      } catch(err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}

function parseCNHFromPDFText(text) {
  var result = {};
  if (!text || text.replace(/\s/g,'').length < 20) return result;

  // CPF: campo "4d CPF" na CNH-e — vem logo após o label CPF
  // Formato esperado: "4d CPF   106.569.903-41" ou "CPF\n106.569.903-41"
  var cpfMatch = text.match(/\b(?:4d\s+)?CPF\b[\s:]*(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2})/i);
  if (cpfMatch) {
    var d = cpfMatch[1].replace(/\D/g,'');
    if (d.length === 11 && !/^(\d)\1{10}$/.test(d))
      result.cpf = d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  // NOME: campo "2e1 NOME E SOBRENOME" — vem antes de DATA/FILIAÇÃO
  var nomeMatch = text.match(/(?:2\s*e\s*1\s+)?NOME\s+E\s+SOBRENOME[\s:]*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ][^\n]{3,60})(?=\n)/i);
  if (!nomeMatch) nomeMatch = text.match(/NOME\s+E\s+SOBRENOME[\s:]*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ][^\n]{3,60})/i);
  if (!nomeMatch) nomeMatch = text.match(/\bNOME\b[\s:]*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇa-záéíóúâêîôûãõàç\s]{3,60})(?=\n|\bDATA\b|\bFILI)/i);
  if (nomeMatch) result.nome = nomeMatch[1].replace(/\s+/g,' ').trim();

  // Nº REGISTRO: campo "5 Nº REGISTRO" na CNH-e
  var regMatch = text.match(/(?:5\s+)?N[°º]?\s*REGISTRO[\s:]*(\d[\d\s]{8,12})/i);
  if (!regMatch) regMatch = text.match(/REGISTRO[\s:]*(\d[\d\s]{8,12})/i);
  if (regMatch) {
    var r = regMatch[1].replace(/\D/g,'');
    if (r.length >= 9) result.registro = r.substring(0,11);
  }

  return result;
}

function parseCNHText(rawText) {
  var result = {};
  var text = rawText.replace(/[ \t]+/g, ' ');
  var numT = text.replace(/O/g, '0').replace(/[Il|]/g, '1');
  console.log('[CNH OCR]', text.substring(0, 600));

  var ignoreDoc = /CARTEIRA|NACIONAL|HABILITAC|BRASIL|DETRAN|SENATRAN|REPUBLICA|FEDERATIVA|ESTADO|SECRETARIA|TRANSITO|DRIVER|LICENSE|PERMISO|MINISTERIO/i;

  // === NOME: no CNH o nome aparece como "FULANO DE TAL, [data]" ===
  // Busca uppercase seguido de vírgula (padrão confirmado no OCR)
  var nomeCommaRx = /\b([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ]{3,}(?:\s+(?:DA|DE|DO|DAS|DOS|[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ]{2,})){1,6})\s*,/g;
  var nc;
  while ((nc = nomeCommaRx.exec(text)) !== null) {
    if (!ignoreDoc.test(nc[1]) && nc[1].split(/\s+/).length >= 1 && nc[1].length >= 5) {
      result.nome = nc[1].trim();
      break;
    }
  }
  // Fallback: após label NOME
  if (!result.nome) {
    var nomeAfter = text.match(/\bNOME\b\s*[:\-]?\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇa-záéíóúâêîôûãõàç ]{3,59}?)(?=\n|\s{2,}|CPF\b|FILIA|DATA\b|\d{3})/i);
    if (nomeAfter && !ignoreDoc.test(nomeAfter[1])) result.nome = nomeAfter[1].trim();
  }
  // Limpa artefato OCR no início do nome (ex: "EN A" antes do nome)
  if (result.nome)
    result.nome = result.nome.replace(/^([A-Z]{1,3}\s+){1,2}(?=[A-Z]{4,})/, '').trim();

  // === CPF: label CPF seguido de número ===
  var cpfAfter = numT.match(/CPF\s*[:\-]?\s*([\d\s.,\-]{11,20})/i);
  if (cpfAfter) {
    var d = cpfAfter[1].replace(/\D/g, '');
    if (d.length === 11 && !/^(\d)\1{10}$/.test(d))
      result.cpf = d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (!result.cpf) {
    var cpfFmt = numT.match(/\b(\d{3})[.\s](\d{3})[.\s](\d{3})[-.\s](\d{2})\b/);
    if (cpfFmt) {
      var d2 = cpfFmt[1]+cpfFmt[2]+cpfFmt[3]+cpfFmt[4];
      if (!/^(\d)\1{10}$/.test(d2)) result.cpf = cpfFmt[1]+'.'+cpfFmt[2]+'.'+cpfFmt[3]+'-'+cpfFmt[4];
    }
  }
  if (!result.cpf) {
    var m11 = numT.match(/\b(\d{11})\b/g) || [];
    for (var k = 0; k < m11.length; k++) {
      if (!/^(\d)\1{10}$/.test(m11[k])) {
        result.cpf = m11[k].replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); break;
      }
    }
  }
  var cpfDigits = result.cpf ? result.cpf.replace(/\D/g, '') : '';

  // === REGISTRO: label Nº REGISTRO seguido de dígitos ===
  var regAfter = numT.match(/N[°º]?\s*REGISTRO\s*[:\-]?\s*([\d\s]{9,15})/i);
  if (!regAfter) regAfter = numT.match(/REGISTRO\s*[:\-]?\s*([\d\s]{9,15})/i);
  if (regAfter) {
    var r = regAfter[1].replace(/\D/g, '');
    if (r.length >= 9 && r !== cpfDigits) result.cnh = r.substring(0, 11);
  }
  if (!result.cnh) {
    var all11 = numT.match(/\b\d{11}\b/g) || [];
    for (var j = 0; j < all11.length; j++) {
      if (all11[j] !== cpfDigits && !/^(\d)\1{10}$/.test(all11[j])) { result.cnh = all11[j]; break; }
    }
  }

  return result;
}

function parseComprovanteText(text) {
  // Look for address that appears AFTER a CPF pattern (client address, not company header)
  var afterCpf = text.match(/CPF[^:]*:?[^\n]*\n([^\n]{5,120})/i);
  if (afterCpf) {
    var candidate = afterCpf[1].replace(/\s+/g, ' ').trim();
    if (/\d/.test(candidate) && candidate.length > 8) return { endereco: candidate };
  }
  // Look for address preceded by a CEP line (client block usually ends with CEP)
  var blocks = text.split(/\n\s*\n/);
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    if (/CEP[\s:]*\d{5}-?\d{3}/i.test(b) && /(?:Rua|Av\.|Avenida|Alameda|Travessa|Estrada|Praça|R\.|Al\.|Qd\.|Quadra)/i.test(b)) {
      var lines = b.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
      for (var j = 0; j < lines.length; j++) {
        if (/(?:Rua|Av\.|Avenida|Alameda|Travessa|Estrada|Praça|R\.|Al\.|Qd\.|Quadra)/i.test(lines[j])) {
          return { endereco: lines[j] };
        }
      }
    }
  }
  // Fallback: first address found
  var endMatch = text.match(/((?:Rua|Av\.|Avenida|Alameda|Travessa|Estrada|Praça|R\.|Al\.|Qd\.|Quadra)[^\n]{10,120})/i);
  return endMatch ? { endereco: endMatch[1].replace(/\s+/g, ' ').trim() } : {};
}

async function extractCNHFromPDFText(pdfText, apiKey) {
  var result = {};

  // Pula a seção de assinatura digital (início do PDF) e procura CPF só na área do cartão
  var cardIdx = pdfText.search(/CARTEIRA\s+NACIONAL|NOME\s+E\s+SOBRENOME|4d\s+CPF/i);
  var cardText = cardIdx >= 0 ? pdfText.substring(cardIdx) : pdfText;
  var cpfMatch = cardText.match(/\b(?:4d\s+)?CPF\b[\s\S]{0,800}?(\d{3}[.\s]\d{3}[.\s]\d{3}[-\s]\d{2})/i);
  if (!cpfMatch) cpfMatch = cardText.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
  if (cpfMatch) {
    var cpfStr = cpfMatch[1].replace(/\D/g,'');
    if (cpfStr.length === 11 && !/^(\d)\1{10}$/.test(cpfStr))
      result.cpf = cpfStr.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  // Remover linhas MRZ (com ou sem espaços) para limpar o texto antes de enviar ao Claude
  var cleanLines = pdfText.split('\n').filter(function(line) {
    var t = line.trim().replace(/\s+/g,'');
    if (/^\d{6,7}[MF]\d{6,7}[A-Z]{2,3}/.test(t)) return false; // 0508311M2706111BRA
    if (/^[IP][A-Z]{2,3}\d{7,}/.test(t)) return false;          // IBRA093462183
    if (/^[A-Z0-9]{25,}$/.test(t)) return false;                // string longa sem espaços
    return true;
  });
  var cleanText = cleanLines.join('\n');

  // Usar Claude para nome e registro (campos que precisam de contexto)
  try {
    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: 'Texto de uma CNH brasileira (MRZ removido):\n\n' + cleanText.substring(0, 1200) + '\n\nExtraia:\n1. nome: titular do campo NOME ou "2e1 NOME E SOBRENOME". NUNCA use nomes do campo FILIAÇÃO.\n2. registro: campo "Nº Registro" ou "5 Nº REGISTRO" — 11 dígitos.\nResponda APENAS JSON: {"nome":"...","registro":"..."}' }]
      })
    });
    if (resp.ok) {
      var data = await resp.json();
      var txt = data.content[0].text.trim().replace(/^```json\s*/i,'').replace(/```\s*$/,'');
      var parsed = JSON.parse(txt);
      if (parsed.nome) result.nome = parsed.nome;
      if (parsed.registro) result.registro = parsed.registro;
    }
  } catch(e) {}

  return result;
}

function isValidCPF(digits) {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  var s, r, i;
  s = 0; for (i = 0; i < 9; i++) s += parseInt(digits[i], 10) * (10 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  if (r !== parseInt(digits[9], 10)) return false;
  s = 0; for (i = 0; i < 10; i++) s += parseInt(digits[i], 10) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  return r === parseInt(digits[10], 10);
}

async function extractCNHWithClaude(imageDataUrl, apiKey, pdfText) {
  var parts = imageDataUrl.split(',');
  var mediaType = parts[0].match(/:(.*?);/)[1];
  var base64 = parts[1];
  var textHint = pdfText ? '\n\nTexto extraído do PDF (use como referência para confirmar os números):\n' + pdfText.substring(0, 800) : '';
  var prompt = [
    'Você é um leitor especialista de CNH (Carteira Nacional de Habilitação) brasileira.',
    'Analise a imagem com MUITA atenção e extraia EXATAMENTE três informações do documento:',
    '',
    '1. NOME E SOBRENOME do titular — é o nome da própria pessoa dona da CNH.',
    '   - No formato antigo aparece sob o rótulo "NOME".',
    '   - No formato novo (CNH-e/PPD) aparece sob o rótulo "2e1 NOME E SOBRENOME".',
    '   - ATENÇÃO: NUNCA pegue os nomes do campo "FILIAÇÃO" (são os nomes do pai e da mãe). O nome do titular fica separado, geralmente acima da filiação.',
    '',
    '2. CPF — número de 11 dígitos no formato XXX.XXX.XXX-XX.',
    '   - No formato antigo aparece sob "CPF". No formato novo sob "4d CPF".',
    '   - NÃO confunda com: nº do documento de identidade (RG), nº de registro, datas, ou os números da zona MRZ no rodapé (linhas cheias de "<<<").',
    '   - Leia dígito por dígito com cuidado.',
    '',
    '3. Nº DE REGISTRO — número de 11 dígitos.',
    '   - No formato antigo aparece sob "Nº REGISTRO". No formato novo sob "5 Nº REGISTRO".',
    '   - NÃO confunda com o número de série/segurança do cartão (que às vezes aparece girado na lateral) nem com o CPF.',
    '   - Leia dígito por dígito com cuidado.',
    '',
    'Confira cada número relendo dígito a dígito antes de responder.',
    'Responda APENAS com JSON puro, sem markdown, sem explicação:',
    '{"nome":"...","cpf":"...","registro":"..."}'
  ].join('\n');
  var resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: prompt + textHint }
      ]}]
    })
  });
  if (!resp.ok) {
    var err = await resp.json().catch(function() { return {}; });
    throw new Error((err.error && err.error.message) || 'Erro ' + resp.status);
  }
  var data = await resp.json();
  var txt = data.content[0].text.trim();
  // Pega apenas o bloco JSON {...}, ignorando qualquer texto antes/depois
  var jsonMatch = txt.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Resposta da IA sem JSON. Tente novamente.');
  var parsed = JSON.parse(jsonMatch[0]);
  // Normalize CPF: if returned as 11 digits, format as XXX.XXX.XXX-XX
  if (parsed.cpf) {
    var digits = parsed.cpf.replace(/\D/g, '');
    if (digits.length === 11) {
      parsed.cpf = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      parsed.cpfValido = isValidCPF(digits);
    }
  }
  // Registro: manter apenas dígitos
  if (parsed.registro) parsed.registro = parsed.registro.replace(/\D/g, '');
  return parsed;
}

async function renderPDFToImage(file) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return new Promise(function(resolve, reject) {
    var fr = new FileReader();
    fr.onload = async function(e) {
      try {
        var pdf = await pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;
        var page = await pdf.getPage(1);
        var vp = page.getViewport({ scale: 4.0 }); // Alta resolução para melhor OCR
        var canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        resolve(canvas.toDataURL('image/png'));
      } catch(err) { reject(err); }
    };
    fr.readAsArrayBuffer(file);
  });
}

async function fileToDataURL(file) {
  return new Promise(function(resolve) {
    var fr = new FileReader();
    fr.onload = function(e) { resolve(e.target.result); };
    fr.readAsDataURL(file);
  });
}

async function runOCR(imageData, statusEl) {
  statusEl.textContent = 'Iniciando OCR... (1ª vez ~30s para baixar dados)';
  var result = await Tesseract.recognize(imageData, 'por', {
    tessedit_pageseg_mode: '11', // Sparse text — melhor para documentos de identidade
    logger: function(m) {
      if (m.status === 'loading language traineddata') statusEl.textContent = 'Baixando dados OCR...';
      else if (m.status === 'recognizing text') statusEl.textContent = 'Lendo texto: ' + Math.round(m.progress * 100) + '%';
    }
  });
  return result.data.text;
}


async function handleCNHUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  var status = document.getElementById('cnh-upload-status');
  var dbg = document.getElementById('cnh-ocr-debug');
  if (dbg) dbg.style.display = 'none';
  status.style.color = '#2196F3';

  var apiKey = (_configCache && _configCache.anthropic_key) || '';

  try {
    // === MODO CLAUDE API (preciso) ===
    if (apiKey) {
      status.textContent = 'Lendo CNH com IA...';
      var imgData;
      var pdfText = '';
      if (file.type === 'application/pdf') {
        status.textContent = 'Convertendo PDF...';
        imgData = await renderPDFToImage(file);
        var rawText = await extractTextFromPDF(file);
        if (rawText && rawText.replace(/\s/g, '').length > 100) pdfText = rawText;
      } else {
        imgData = await fileToDataURL(file);
      }
      status.textContent = 'Analisando com Claude...';
      // Always use vision for PDFs — text extraction picks up CPF errado da seção de assinatura digital
      var extracted = await extractCNHWithClaude(imgData, apiKey, '');
      var ok = [], faltando = [], avisos = [];
      if (extracted.nome)     { document.getElementById('cliente-nome').value = extracted.nome;     ok.push('Nome'); }     else faltando.push('Nome');
      if (extracted.cpf)      { document.getElementById('cliente-cpf').value  = extracted.cpf;      ok.push('CPF'); if (extracted.cpfValido === false) avisos.push('confira o CPF'); } else faltando.push('CPF');
      if (extracted.registro) { document.getElementById('cliente-cnh').value  = extracted.registro; ok.push('N° CNH'); }   else faltando.push('N° CNH');
      status.style.color = ok.length ? ((faltando.length || avisos.length) ? 'orange' : 'var(--green)') : 'orange';
      status.textContent = ok.length
        ? '✓ ' + ok.join(', ') + (faltando.length ? ' | Faltou: ' + faltando.join(', ') : '') + (avisos.length ? ' | ⚠ ' + avisos.join(', ') : '')
        : '⚠ Não foi possível extrair. Preencha manualmente.';
      return;
    }

    // === MODO OCR TESSERACT (fallback sem API key) ===
    var text;
    if (file.type === 'application/pdf') {
      status.textContent = 'Lendo PDF...';
      var extracted2 = await extractTextFromPDF(file);
      if (extracted2.replace(/\s/g, '').length > 30) {
        text = extracted2;
      } else {
        status.textContent = 'Renderizando PDF...';
        var imgData2 = await renderPDFToImage(file);
        text = await runOCR(imgData2, status);
      }
    } else {
      var imgData3 = await fileToDataURL(file);
      text = await runOCR(imgData3, status);
    }
    if (dbg) { dbg.style.display = 'block'; dbg.value = text.substring(0, 1000); }
    var data = parseCNHText(text);
    var ok2 = [], faltando2 = [];
    if (data.nome) { document.getElementById('cliente-nome').value = data.nome; ok2.push('Nome'); } else faltando2.push('Nome');
    if (data.cpf)  { document.getElementById('cliente-cpf').value  = data.cpf;  ok2.push('CPF'); } else faltando2.push('CPF');
    if (data.cnh)  { document.getElementById('cliente-cnh').value  = data.cnh;  ok2.push('N° CNH'); } else faltando2.push('N° CNH');
    status.style.color = ok2.length ? (faltando2.length ? 'orange' : 'var(--green)') : 'orange';
    status.textContent = ok2.length
      ? '✓ ' + ok2.join(', ') + (faltando2.length ? ' | Faltou: ' + faltando2.join(', ') : '')
      : '⚠ Configure a API Key nas ⚙️ Configurações para leitura completa.';
  } catch(err) {
    console.error(err);
    status.style.color = 'var(--red)';
    status.textContent = '✗ Erro: ' + err.message;
  }
}

async function extractAddressWithClaude(imageDataUrl, apiKey, nomeCliente) {
  var parts = imageDataUrl.split(',');
  var mediaType = parts[0].match(/:(.*?);/)[1];
  var base64 = parts[1];
  var nomeHint = nomeCliente ? ' O nome do titular é "' + nomeCliente + '". Procure o endereço associado a esse nome.' : '';
  var resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: 'Este é um comprovante de endereço brasileiro (conta de luz, água, banco, extrato bancário, etc.).' + nomeHint + ' Extraia o endereço RESIDENCIAL DO TITULAR, NÃO o endereço da empresa emissora. O endereço do titular aparece próximo ao nome e CPF do cliente no documento. Inclua rua/avenida, número, complemento, bairro, cidade e CEP se disponíveis. Responda APENAS com JSON puro sem markdown: {"endereco":"..."}' }
      ]}]
    })
  });
  if (!resp.ok) {
    var err = await resp.json().catch(function() { return {}; });
    throw new Error((err.error && err.error.message) || 'Erro ' + resp.status);
  }
  var data = await resp.json();
  var txt = data.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(txt);
}

async function handleComprovanteUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  var status = document.getElementById('comprovante-upload-status');
  status.style.color = '#2196F3';
  var apiKey = (_configCache && _configCache.anthropic_key) || '';
  try {
    if (apiKey) {
      status.textContent = 'Analisando com IA...';
      var imgDataUrl;
      if (file.type === 'application/pdf') {
        imgDataUrl = await renderPDFToImage(file);
      } else {
        imgDataUrl = await fileToDataURL(file);
      }
      var nomeCliente = (document.getElementById('cliente-nome').value || '').trim();
      var result = await extractAddressWithClaude(imgDataUrl, apiKey, nomeCliente);
      if (result.endereco) {
        document.getElementById('cliente-endereco').value = result.endereco;
        status.style.color = 'var(--green)'; status.textContent = '✓ Endereço preenchido';
      } else {
        status.style.color = 'orange'; status.textContent = '⚠ Endereço não encontrado. Preencha manualmente.';
      }
    } else {
      var text;
      if (file.type === 'application/pdf') {
        status.textContent = 'Lendo PDF...';
        var extracted = await extractTextFromPDF(file);
        if (extracted.replace(/\s/g, '').length > 30) {
          text = extracted;
        } else {
          status.textContent = 'Renderizando PDF para OCR...';
          var imgData = await renderPDFToImage(file);
          text = await runOCR(imgData, status);
        }
      } else {
        var imgData2 = await fileToDataURL(file);
        text = await runOCR(imgData2, status);
      }
      var data = parseComprovanteText(text);
      if (data.endereco) {
        document.getElementById('cliente-endereco').value = data.endereco;
        status.style.color = 'var(--green)'; status.textContent = '✓ Endereço preenchido';
      } else {
        status.style.color = 'orange'; status.textContent = '⚠ Endereço não encontrado. Preencha manualmente.';
      }
    }
  } catch(err) {
    status.style.color = 'var(--red)'; status.textContent = '✗ Erro: ' + err.message;
  }
}

async function submitCliente(e) {
  e.preventDefault();
  const id = document.getElementById('cliente-id').value;
  const cl = {
    nome:     document.getElementById('cliente-nome').value.trim(),
    cpf:      document.getElementById('cliente-cpf').value.trim(),
    telefone: document.getElementById('cliente-telefone').value.trim(),
    cnh:      document.getElementById('cliente-cnh').value.trim(),
    endereco: document.getElementById('cliente-endereco').value.trim(),
    obs:      document.getElementById('cliente-obs').value.trim()
  };
  var result = id
    ? await db.from('clientes').update(cl).eq('id', id)
    : await db.from('clientes').insert(cl);
  if (result.error) { alert('Erro ao salvar: ' + result.error.message); return; }
  closeModal('modal-cliente');
  renderClientes();
  populateClienteSelect();
}

async function populateClienteSelect() {
  const { data } = await db.from('clientes').select('*').order('nome');
  const c = data || [];
  var el = document.getElementById('aluguel-cliente-select');
  if (!el) return;
  if (!c.length) {
    el.innerHTML = '<option value="">Nenhum cliente cadastrado</option>';
    return;
  }
  el.innerHTML = '<option value="">Selecione o cliente...</option>' + c.map(function(cl) {
    return '<option value="' + cl.id + '" data-cpf="' + (cl.cpf||'') + '" data-tel="' + (cl.telefone||'') + '" data-cnh="' + (cl.cnh||'') + '" data-end="' + (cl.endereco||'') + '">' + cl.nome + '</option>';
  }).join('');
}

function preencherCliente() {
  var sel = document.getElementById('aluguel-cliente-select');
  var opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) return;
  document.getElementById('aluguel-cpf').value      = opt.dataset.cpf || '';
  document.getElementById('aluguel-telefone').value = opt.dataset.tel || '';
  document.getElementById('aluguel-cnh').value      = opt.dataset.cnh || '';
  document.getElementById('aluguel-endereco').value = opt.dataset.end || '';
}

// --- VEÍCULOS ---
var _veiculosCache = [];

function renderVeiculosTabela(lista) {
  document.getElementById('veiculos-count').textContent = lista.length;
  document.getElementById('motos-tbody').innerHTML = lista.length
    ? lista.map(function(vei) {
        return '<tr>' +
          '<td>' + vei.modelo + '</td>' +
          '<td>' + (vei.placa || '-') + '</td>' +
          '<td>' + (vei.ano || '-') + '</td>' +
          '<td>' + (vei.cor || '-') + '</td>' +
          '<td>' + fmtBRL(vei.valor_compra) + '</td>' +
          '<td>' + statusBadge(vei.status, 'veiculo') + '</td>' +
          '<td>' +
            '<div class="btn-actions">' +
              '<button class="btn btn-sm btn-secondary" onclick="editVeiculo(\'' + vei.id + '\')">Editar</button>' +
              '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'veiculo\',\'' + vei.id + '\')">Excluir</button>' +
            '</div>' +
          '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="7">Nenhum veículo encontrado</td></tr>';
}

function filtrarVeiculos() {
  var q = (document.getElementById('veiculos-busca').value || '').toLowerCase().trim();
  if (!q) { renderVeiculosTabela(_veiculosCache); return; }
  var filtrados = _veiculosCache.filter(function(vei) {
    return (vei.modelo || '').toLowerCase().includes(q)
        || (vei.placa  || '').toLowerCase().includes(q)
        || (vei.cor    || '').toLowerCase().includes(q);
  });
  renderVeiculosTabela(filtrados);
}

async function renderVeiculos() {
  showLoading('motos-tbody', 7);
  var busca = document.getElementById('veiculos-busca');
  if (busca) busca.value = '';
  const { data } = await db.from('veiculos').select('*').order('created_at', { ascending: false });
  _veiculosCache = data || [];
  renderVeiculosTabela(_veiculosCache);
}

async function scanCRLV(event) {
  var file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  var status = document.getElementById('crlv-status');
  var apiKey = (_configCache && _configCache.anthropic_key) || '';
  if (!apiKey) { status.textContent = '⚠ Configure a chave da API Claude nas configurações.'; status.style.color = 'orange'; return; }
  status.style.color = '#2196F3';
  status.textContent = 'Lendo CRLV com IA...';
  try {
    var imgData = file.type === 'application/pdf' ? await renderPDFToImage(file) : await fileToDataURL(file);
    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: imgData.split(';')[0].split(':')[1], data: imgData.split(',')[1] } },
          { type: 'text', text: 'Extraia do CRLV/documento veicular os seguintes dados e retorne APENAS JSON com as chaves: modelo, placa, ano, cor, chassi, renavam. Se não encontrar algum campo, coloque null. Sem explicações.' }
        ]}]
      })
    });
    var json = await resp.json();
    var text = json.content && json.content[0] && json.content[0].text || '';
    var match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON não encontrado');
    var d = JSON.parse(match[0]);
    var ok = [], faltando = [];
    if (d.modelo)  { document.getElementById('moto-modelo').value  = d.modelo;  ok.push('Modelo'); } else faltando.push('Modelo');
    if (d.placa)   { document.getElementById('moto-placa').value   = d.placa.replace(/[^a-zA-Z0-9]/g,'').toUpperCase(); ok.push('Placa'); } else faltando.push('Placa');
    if (d.ano)     { document.getElementById('moto-ano').value     = d.ano;     ok.push('Ano'); }
    if (d.cor)     { document.getElementById('moto-cor').value     = d.cor;     ok.push('Cor'); }
    if (d.chassi)  { document.getElementById('moto-chassi').value  = String(d.chassi).toUpperCase(); ok.push('Chassi'); } else faltando.push('Chassi');
    if (d.renavam) { document.getElementById('moto-renavam').value = String(d.renavam); ok.push('RENAVAM'); } else faltando.push('RENAVAM');
    status.style.color = faltando.length ? 'orange' : 'var(--green)';
    status.textContent = '✓ ' + ok.join(', ') + (faltando.length ? ' | Faltou: ' + faltando.join(', ') : '');
  } catch(e) {
    status.style.color = 'var(--red)';
    status.textContent = '⚠ Erro: ' + (e && e.message ? e.message : String(e));
  }
}

function openNewMoto() {
  document.getElementById('form-moto').reset();
  document.getElementById('moto-id').value = '';
  document.getElementById('modal-moto-title').textContent = 'Novo Veículo';
  openModal('modal-moto');
}

async function editVeiculo(id) {
  const { data: v } = await db.from('veiculos').select('*').eq('id', id).single();
  if (!v) return;
  document.getElementById('moto-id').value         = v.id;
  document.getElementById('moto-modelo').value     = v.modelo || '';
  document.getElementById('moto-placa').value      = v.placa || '';
  document.getElementById('moto-ano').value        = v.ano || '';
  document.getElementById('moto-cor').value        = v.cor || '';
  document.getElementById('moto-valor-compra').value = v.valor_compra || '';
  document.getElementById('moto-status').value           = v.status || 'disponivel';
  document.getElementById('moto-km-atual').value         = v.km_atual || '';
  document.getElementById('moto-chassi').value           = v.chassi || '';
  document.getElementById('moto-renavam').value          = v.renavam || '';
  document.getElementById('moto-seguro-mensal').value    = v.seguro_rastreador_mensal || '';
  document.getElementById('moto-obs').value              = v.obs || '';
  document.getElementById('modal-moto-title').textContent = 'Editar Veículo';
  openModal('modal-moto');
}

async function submitMoto(e) {
  e.preventDefault();
  const id = document.getElementById('moto-id').value;
  const veiculo = {
    modelo:        document.getElementById('moto-modelo').value.trim(),
    placa:         document.getElementById('moto-placa').value.trim(),
    ano:           document.getElementById('moto-ano').value || null,
    cor:           document.getElementById('moto-cor').value.trim(),
    valor_compra:             document.getElementById('moto-valor-compra').value || null,
    km_atual:                 parseInt(document.getElementById('moto-km-atual').value) || null,
    chassi:                   document.getElementById('moto-chassi').value.trim().toUpperCase() || null,
    renavam:                  document.getElementById('moto-renavam').value.trim() || null,
    status:                   document.getElementById('moto-status').value,
    seguro_rastreador_mensal: document.getElementById('moto-seguro-mensal').value || null,
    obs:                      document.getElementById('moto-obs').value.trim()
  };
  var result;
  if (id) {
    result = await db.from('veiculos').update(veiculo).eq('id', id);
  } else {
    result = await db.from('veiculos').insert(veiculo);
  }
  if (result.error) { alert('Erro ao salvar: ' + result.error.message); return; }
  closeModal('modal-moto');
  renderVeiculos();
  populateVeiculoSelects();
}

// --- SELECTS ---
async function populateVeiculoSelects() {
  const { data } = await db.from('veiculos').select('*').order('modelo');
  const v = data || [];
  const opts  = v.map(function(vei) { return '<option value="' + vei.id + '">' + veiculoLabel(vei) + '</option>'; }).join('');
  const noOpt = '<option value="">Nenhum veículo cadastrado</option>';
  ['aluguel-moto', 'manut-moto', 'despesa-moto', 'prog-moto', 'dp-moto'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = v.length ? opts : noOpt;
  });
  var filterOpts = '<option value="">Todos</option>' + opts;
  ['filtro-moto-aluguel', 'filtro-moto-despesa'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = filterOpts;
  });
}

var periodoLabel = { dia: 'Dia', semana: 'Semana', mes: 'Mês' };

// --- CUSTOS TABS ---
function showCustosTab(tab) {
  document.querySelectorAll('.custos-tab').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.custos-tab-content').forEach(function(d) { d.style.display = 'none'; });
  var btn = document.querySelector('.custos-tab[onclick*="\'' + tab + '\'"]');
  if (btn) btn.classList.add('active');
  var content = document.getElementById('tab-' + tab);
  if (content) content.style.display = 'block';
  document.getElementById('btn-nova-manut').style.display   = tab === 'manutencoes' ? '' : 'none';
  document.getElementById('btn-nova-despesa').style.display = tab === 'despesas'    ? '' : 'none';
  if (tab === 'manutencoes') { renderManutencoesTab(); }
  if (tab === 'despesas')    { renderDespesasTab(); }
}

// --- MANUTENÇÕES (accordion por moto) ---
var _manutencoesCache = null;

function _buildManutMotoBody(vei, motoProg, motoAvul) {
  var kmAtual = Number(vei.km_atual) || 0;
  var subHdr  = function(txt) { return '<div style="font-weight:600;font-size:0.82rem;color:var(--text2);letter-spacing:0.06em;text-transform:uppercase;margin:0.75rem 0 0.4rem">' + txt + '</div>'; };
  var progRows = motoProg.map(function(x) {
    var proximaKm = x.ultima_km ? (Number(x.ultima_km) + Number(x.intervalo_km)) : null;
    var restante  = (proximaKm && kmAtual) ? proximaKm - kmAtual : null;
    var situacao;
    if (!x.ultima_km) {
      situacao = '<span class="badge badge-gray">Não configurado</span>';
    } else if (restante !== null && restante <= 0) {
      situacao = '<span class="badge badge-red">' + IC.warn + ' Vencido</span>';
    } else if (restante !== null && restante <= 100) {
      situacao = '<span class="badge badge-yellow">' + IC.dot_red + ' Em ' + restante.toLocaleString('pt-BR') + ' km</span>';
    } else if (restante !== null) {
      situacao = '<span class="badge badge-green">Em ' + restante.toLocaleString('pt-BR') + ' km</span>';
    } else {
      situacao = '<span class="badge badge-gray">—</span>';
    }
    var safeItem = (x.item || '').replace(/'/g, "\\'");
    return '<tr>' +
      '<td><strong>' + (x.item || '—') + '</strong></td>' +
      '<td>A cada ' + Number(x.intervalo_km).toLocaleString('pt-BR') + ' km</td>' +
      '<td>' + (x.ultima_km ? Number(x.ultima_km).toLocaleString('pt-BR') + ' km' : '—') + '</td>' +
      '<td>' + (kmAtual ? kmAtual.toLocaleString('pt-BR') + ' km' : '—') + '</td>' +
      '<td>' + situacao + '</td>' +
      '<td><div class="btn-actions">' +
        '<button class="btn btn-sm btn-primary" onclick="abrirRegistrarTroca(\'' + x.id + '\',\'' + x.veiculo_id + '\',\'' + safeItem + '\')">✓ Registrar</button>' +
        '<button class="btn btn-sm btn-secondary" onclick="editManutProg(\'' + x.id + '\')">Editar</button>' +
        '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'manut_prog\',\'' + x.id + '\')">Excluir</button>' +
      '</div></td></tr>';
  }).join('') || '<tr class="empty-row"><td colspan="6">Nenhuma programada. Use "+ Manutenção" → Programada.</td></tr>';
  var avulRows = motoAvul.map(function(x) {
    return '<tr>' +
      '<td>' + (x.tipo || '—') + '</td>' +
      '<td>' + (x.descricao || '—') + '</td>' +
      '<td><span class="text-red">' + fmtBRL(x.custo) + '</span></td>' +
      '<td>' + (x.km ? Number(x.km).toLocaleString('pt-BR') + ' km' : '—') + '</td>' +
      '<td>' + fmtDate(x.data) + '</td>' +
      '<td><div class="btn-actions">' +
        '<button class="btn btn-sm btn-secondary" onclick="editManutencao(\'' + x.id + '\')">Editar</button>' +
        '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'manutencao\',\'' + x.id + '\')">Excluir</button>' +
      '</div></td></tr>';
  }).join('') || '<tr class="empty-row"><td colspan="6">Nenhuma avulsa registrada.</td></tr>';
  var totalManut = motoAvul.reduce(function(s, x) { return s + Number(x.custo || 0); }, 0);
  return subHdr('Programadas') +
    '<div class="table-wrap" style="margin-bottom:0.5rem"><table>' +
      '<thead><tr><th>Item</th><th>Intervalo</th><th>Última troca</th><th>KM Atual</th><th>Situação</th><th>Ações</th></tr></thead>' +
      '<tbody>' + progRows + '</tbody></table></div>' +
    subHdr('Manutenções Avulsas') +
    '<div class="table-wrap"><table>' +
      '<thead><tr><th>Tipo</th><th>Descrição</th><th>Custo</th><th>KM</th><th>Data</th><th>Ações</th></tr></thead>' +
      '<tbody>' + avulRows + '</tbody></table></div>' +
    '<div style="text-align:right;padding:0.6rem 0.25rem;font-weight:700;font-size:0.9rem;border-top:1px solid var(--border);margin-top:0.25rem">Total gasto em manutenções: <span style="color:var(--red)">' + fmtBRL(totalManut) + '</span></div>';
}

async function renderManutencoesTab() {
  var container = document.getElementById('manutencoes-motos-list');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--text2);padding:1rem 0">Carregando...</p>';
  var results = await Promise.all([
    db.from('veiculos').select('id, modelo, placa, km_atual').order('modelo'),
    db.from('manut_programada').select('*').order('created_at'),
    db.from('manutencoes').select('*').order('created_at', { ascending: false })
  ]);
  var veiculos = results[0].data || [];
  var allProgs = results[1].data || [];
  var allAvul  = results[2].data || [];
  _manutencoesCache = { veiculos: veiculos, allProgs: allProgs, allAvul: allAvul };
  if (!veiculos.length) {
    container.innerHTML = '<p style="color:var(--text2);text-align:center;padding:2rem">Nenhuma moto cadastrada.</p>';
    return;
  }
  container.innerHTML = veiculos.map(function(vei) {
    var kmAtual  = Number(vei.km_atual) || 0;
    var motoProg = allProgs.filter(function(p) { return p.veiculo_id === vei.id; });
    var motoAvul = allAvul.filter(function(a) { return a.veiculo_id === vei.id; });
    var vencidas = 0, proximas = 0;
    motoProg.forEach(function(x) {
      if (!x.ultima_km) return;
      var restante = kmAtual ? (Number(x.ultima_km) + Number(x.intervalo_km)) - kmAtual : null;
      if (restante === null) return;
      if (restante <= 0) vencidas++; else if (restante <= 100) proximas++;
    });
    var badges = '';
    if (vencidas) badges += '<span class="badge badge-red" style="margin-left:0.5rem">' + IC.warn + ' ' + vencidas + ' vencida(s)</span>';
    if (proximas) badges += '<span class="badge badge-yellow" style="margin-left:0.5rem">' + IC.dot_red + ' ' + proximas + ' próxima(s)</span>';
    if (!vencidas && !proximas && motoProg.length) badges += '<span class="badge badge-green" style="margin-left:0.5rem">' + IC.check + ' Em dia</span>';
    var avulCount = motoAvul.length ? '<span style="margin-left:auto;font-size:0.82rem;color:var(--text2)">' + motoAvul.length + ' avulsa(s)</span>' : '';
    return '<div style="border:1px solid var(--border);border-radius:0.75rem;margin-bottom:0.6rem;overflow:hidden">' +
      '<div onclick="toggleManutMoto(\'' + vei.id + '\')" style="display:flex;align-items:center;gap:0.5rem;padding:0.8rem 1rem;cursor:pointer;background:var(--bg3);user-select:none">' +
        '<span id="acc-manut-arrow-' + vei.id + '" style="font-size:0.7rem;color:var(--text2)">▶</span>' +
        '<span style="font-weight:600">' + veiculoLabel(vei) + '</span>' +
        badges + avulCount +
      '</div>' +
      '<div id="acc-manut-body-' + vei.id + '" style="display:none;padding:0.5rem 1rem 1rem"></div>' +
    '</div>';
  }).join('');
}

function toggleManutMoto(veiculoId) {
  var body  = document.getElementById('acc-manut-body-' + veiculoId);
  var arrow = document.getElementById('acc-manut-arrow-' + veiculoId);
  if (!body) return;
  var open = body.style.display !== 'none';
  if (open) {
    body.style.display = 'none';
    if (arrow) arrow.textContent = '▶';
  } else {
    if (!body.innerHTML.trim() && _manutencoesCache) {
      var vei      = _manutencoesCache.veiculos.find(function(v) { return v.id === veiculoId; });
      var motoProg = _manutencoesCache.allProgs.filter(function(p) { return p.veiculo_id === veiculoId; });
      var motoAvul = _manutencoesCache.allAvul.filter(function(a) { return a.veiculo_id === veiculoId; });
      if (vei) body.innerHTML = _buildManutMotoBody(vei, motoProg, motoAvul);
    }
    body.style.display = 'block';
    if (arrow) arrow.textContent = '▼';
  }
}

function renderManutProgramada() { renderManutencoesTab(); }

function openNewManutChoice() {
  openModal('modal-tipo-manut');
}

function openNewManutProg() {
  document.getElementById('prog-id').value         = '';
  document.getElementById('prog-item').value       = '';
  document.getElementById('prog-intervalo').value  = '';
  document.getElementById('prog-ultima-km').value  = '';
  document.getElementById('modal-prog-title').textContent = 'Nova Manutenção Programada';
  populateVeiculoSelects();
  openModal('modal-manut-prog');
}

async function editManutProg(id) {
  var { data: p } = await db.from('manut_programada').select('*').eq('id', id).single();
  if (!p) return;
  await populateVeiculoSelects();
  document.getElementById('prog-id').value         = p.id;
  document.getElementById('prog-moto').value       = p.veiculo_id || '';
  document.getElementById('prog-item').value       = p.item || '';
  document.getElementById('prog-intervalo').value  = p.intervalo_km || '';
  document.getElementById('prog-ultima-km').value  = p.ultima_km || '';
  document.getElementById('modal-prog-title').textContent = 'Editar Manutenção Programada';
  openModal('modal-manut-prog');
}

async function submitManutProg() {
  var id = document.getElementById('prog-id').value;
  var p = {
    veiculo_id:   document.getElementById('prog-moto').value || null,
    item:         document.getElementById('prog-item').value.trim(),
    intervalo_km: parseInt(document.getElementById('prog-intervalo').value) || null,
    ultima_km:    parseInt(document.getElementById('prog-ultima-km').value) || null
  };
  if (!p.item || !p.intervalo_km) { alert('Item e intervalo são obrigatórios.'); return; }
  var result = id
    ? await db.from('manut_programada').update(p).eq('id', id)
    : await db.from('manut_programada').insert(p);
  if (result.error) { alert('Erro ao salvar: ' + result.error.message); return; }
  closeModal('modal-manut-prog');
  renderManutProgramada();
}

function abrirRegistrarTroca(progId, veiculoId, item) {
  document.getElementById('troca-prog-id').value    = progId;
  document.getElementById('troca-veiculo-id').value = veiculoId;
  document.getElementById('troca-km').value         = '';
  document.getElementById('troca-custo').value      = '';
  document.getElementById('modal-troca-title').textContent = 'Registrar: ' + item;
  openModal('modal-registrar-troca');
}

async function submitRegistrarTroca() {
  var progId     = document.getElementById('troca-prog-id').value;
  var veiculoId  = document.getElementById('troca-veiculo-id').value;
  var km         = parseInt(document.getElementById('troca-km').value);
  var custo      = parseFloat(document.getElementById('troca-custo').value) || null;
  if (!km) { alert('Informe o KM da troca.'); return; }
  var { data: prog } = await db.from('manut_programada').select('*').eq('id', progId).single();
  if (!prog) return;
  await db.from('manut_programada').update({ ultima_km: km }).eq('id', progId);
  var { data: vei } = await db.from('veiculos').select('km_atual').eq('id', veiculoId).single();
  if (vei && (!vei.km_atual || km > vei.km_atual)) {
    await db.from('veiculos').update({ km_atual: km }).eq('id', veiculoId);
  }
  if (custo) {
    await db.from('manutencoes').insert({
      veiculo_id: veiculoId,
      tipo: prog.item,
      descricao: prog.item,
      custo: custo,
      km: km,
      data: hojeLocalStr()
    });
  }
  closeModal('modal-registrar-troca');
  renderManutProgramada();
  loadNotificacoes();
}

// --- ALUGUÉIS ---
function toggleCaucaoData() {
  var val = document.getElementById('aluguel-caucao-devolvido').value;
  document.getElementById('row-caucao-data').style.display = val === 'sim' ? 'block' : 'none';
}

function calcTotal() {
  var inicio  = document.getElementById('aluguel-inicio').value;
  var fim     = document.getElementById('aluguel-fim').value;
  var valor   = parseFloat(document.getElementById('aluguel-valor').value) || 0;
  var periodo = document.getElementById('aluguel-periodo').value;
  var diasLabel = document.getElementById('aluguel-dias-label');
  if (inicio && fim) {
    var dias = Math.max(1, Math.ceil((new Date(fim) - new Date(inicio)) / 86400000));
    if (diasLabel) diasLabel.textContent = '(' + dias + ' dia' + (dias !== 1 ? 's' : '') + ')';
    if (valor) {
      var unidades;
      if (periodo === 'semana')   unidades = dias / 7;
      if (periodo === 'mes')      unidades = dias / 30;
      document.getElementById('aluguel-total').value = (unidades * valor).toFixed(2);
    }
  } else {
    if (diasLabel) diasLabel.textContent = '';
  }
}

function preencherFim(qtd, unidade) {
  var inicio = document.getElementById('aluguel-inicio').value;
  if (!inicio) { alert('Preencha a data de início primeiro.'); return; }
  var d = new Date(inicio + 'T00:00:00');
  d.setDate(d.getDate() + (unidade === 'mes' ? qtd * 30 : qtd * 7));
  var fim = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  document.getElementById('aluguel-fim').value = fim;
  calcTotal();
}

function ajustarFim(delta) {
  var inicio = document.getElementById('aluguel-inicio').value;
  var fim    = document.getElementById('aluguel-fim').value;
  var base   = fim || inicio;
  if (!base) { alert('Preencha a data de início primeiro.'); return; }
  var d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + delta * 7);
  if (inicio && d <= new Date(inicio + 'T00:00:00')) return;
  document.getElementById('aluguel-fim').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  calcTotal();
}

async function renderAlugueis(ordenarPorVencimento) {
  showLoading('alugueis-tbody', 12);
  var fmId = document.getElementById('filtro-moto-aluguel') ? document.getElementById('filtro-moto-aluguel').value : '';
  var fsId = document.getElementById('filtro-status-aluguel') ? document.getElementById('filtro-status-aluguel').value : '';

  var orderCol = ordenarPorVencimento ? 'fim' : 'created_at';
  var query = db.from('alugueis').select('*, veiculos(modelo, placa, ano, cor)').order(orderCol, { ascending: !!ordenarPorVencimento });
  if (fmId) query = query.eq('veiculo_id', fmId);
  if (fsId) query = query.eq('status', fsId);

  const { data } = await query;
  const a = data || [];
  var hojeA = hojeLocalStr();
  document.getElementById('alugueis-count').textContent = a.length;
  document.getElementById('alugueis-tbody').innerHTML = a.length
    ? a.map(function(x) {
        var vei = x.veiculos;
        var vencido = x.status === 'ativo' && x.fim && x.fim < hojeA;
        return '<tr' + (vencido ? ' class="row-vencido"' : '') + '>' +
          '<td>' + (vei ? veiculoLabel(vei) : '-') + '</td>' +
          '<td>' + x.cliente + '</td>' +
          '<td>' + (x.cpf || '-') + '</td>' +
          '<td>' + (x.telefone || '-') + '</td>' +
          '<td>' + fmtDate(x.inicio) + '</td>' +
          '<td>' + fmtDate(x.fim) + (vencido ? ' <span class="badge badge-red">Vencido</span>' : '') + '</td>' +
          '<td>' + (periodoLabel[x.periodo] || '-') + '</td>' +
          '<td>' + fmtBRL(x.valor) + '</td>' +
          '<td><strong>' + fmtBRL(x.total) + '</strong></td>' +
          '<td>' + (x.caucao ? fmtBRL(x.caucao) + (x.caucao_devolvido === 'sim' ? ' <span class="badge badge-green">Dev.</span>' : ' <span class="badge badge-red">Pend.</span>') : '-') + '</td>' +
          '<td>' + statusBadge(x.status, 'aluguel') + '</td>' +
          '<td>' +
            '<div class="btn-actions">' +
              '<button class="btn btn-sm btn-info" onclick="abrirParcelas(\'' + x.id + '\')">Parcelas</button>' +
              '<button class="btn btn-sm btn-info" onclick="gerarContrato(\'' + x.id + '\')">Contrato</button>' +
              (x.status === 'ativo' ? '<button class="btn btn-sm btn-warning" onclick="renovarContrato(\'' + x.id + '\')">Renovar</button>' : '') +
              (x.status === 'ativo' ? '<button class="btn btn-sm btn-danger" onclick="encerrarContrato(\'' + x.id + '\')">Encerrar</button>' : '') +
              (x.status === 'encerrado' && x.caucao && x.caucao_devolvido !== 'sim' ? '<button class="btn btn-sm btn-primary" onclick="marcarCaucaoDevolvido(\'' + x.id + '\',\'\')">✅ Devolver caução</button>' : '') +
              '<button class="btn btn-sm btn-secondary" onclick="editAluguel(\'' + x.id + '\')">Editar</button>' +
              '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'aluguel\',\'' + x.id + '\')">Excluir</button>' +
            '</div>' +
          '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="12">Nenhum aluguel encontrado</td></tr>';
}

function openNewAluguel() {
  document.getElementById('form-aluguel').reset();
  document.getElementById('aluguel-id').value = '';
  document.getElementById('modal-aluguel-title').textContent = 'Novo Aluguel';
  populateVeiculoSelects();
  populateClienteSelect();
  openModal('modal-aluguel');
}

async function editAluguel(id) {
  const { data: a } = await db.from('alugueis').select('*').eq('id', id).single();
  if (!a) return;
  await populateVeiculoSelects();
  await populateClienteSelect();
  document.getElementById('aluguel-id').value       = a.id;
  document.getElementById('aluguel-moto').value     = a.veiculo_id || '';
  document.getElementById('aluguel-cliente-select').value = a.cliente_id || '';
  document.getElementById('aluguel-cpf').value      = a.cpf || '';
  document.getElementById('aluguel-telefone').value = a.telefone || '';
  document.getElementById('aluguel-cnh').value      = a.cnh || '';
  document.getElementById('aluguel-endereco').value = a.endereco || '';
  document.getElementById('aluguel-inicio').value   = a.inicio || '';
  document.getElementById('aluguel-fim').value      = a.fim || '';
  document.getElementById('aluguel-periodo').value  = a.periodo || 'semana';
  document.getElementById('aluguel-valor').value    = a.valor || '';
  document.getElementById('aluguel-total').value    = a.total || '';
  document.getElementById('aluguel-caucao').value             = a.caucao || '';
  document.getElementById('aluguel-caucao-devolvido').value   = a.caucao_devolvido || 'nao';
  document.getElementById('aluguel-caucao-data').value        = a.caucao_data || '';
  document.getElementById('row-caucao-data').style.display    = a.caucao_devolvido === 'sim' ? 'block' : 'none';
  document.getElementById('aluguel-status').value             = a.status || 'ativo';
  document.getElementById('modal-aluguel-title').textContent = 'Editar Aluguel';
  openModal('modal-aluguel');
}

async function encerrarContrato(id) {
  if (!confirm('Encerrar este contrato? O status mudará para "Encerrado".')) return;
  var hoje = hojeLocalStr();
  var { data: a } = await db.from('alugueis').select('fim').eq('id', id).single();
  var novoFim = (!a.fim || a.fim > hoje) ? hoje : a.fim;
  await db.from('alugueis').update({ status: 'encerrado', fim: novoFim }).eq('id', id);
  // Parcelas em aberto de contrato encerrado não devem continuar gerando cobrança
  var { data: abertas } = await db.from('parcelas').select('id').eq('aluguel_id', id).eq('pago', false);
  if (abertas && abertas.length && confirm('Este contrato tem ' + abertas.length + ' parcela(s) em aberto. Excluir essas parcelas? (As pagas são mantidas.)')) {
    await db.from('parcelas').delete().eq('aluguel_id', id).eq('pago', false);
  }
  renderAlugueis();
  loadNotificacoes();
}

async function marcarCaucaoDevolvido(aluguelId, notifKey) {
  if (!confirm('Confirmar devolução do caução ao cliente?')) return;
  var hoje = hojeLocalStr();
  await db.from('alugueis').update({ caucao_devolvido: 'sim', caucao_data: hoje }).eq('id', aluguelId);
  if (notifKey) dismissNotif(notifKey);
  renderAlugueis();
  loadNotificacoes();
}

async function renovarContrato(id) {
  const { data: a } = await db.from('alugueis').select('*').eq('id', id).single();
  if (!a) return;
  await populateVeiculoSelects();
  await populateClienteSelect();

  // Nova data de início = dia seguinte ao fim do contrato atual
  var novoInicio = '';
  if (a.fim) {
    var d = new Date(a.fim + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    novoInicio = d.toISOString().split('T')[0];
  } else {
    novoInicio = hojeLocalStr();
  }

  // Nova data de fim = +30 dias a partir do novo início
  var d2 = new Date(novoInicio + 'T00:00:00');
  d2.setDate(d2.getDate() + 30);
  var novoFim = d2.toISOString().split('T')[0];

  document.getElementById('aluguel-id').value                  = ''; // novo registro
  document.getElementById('aluguel-moto').value                = a.veiculo_id || '';
  document.getElementById('aluguel-cliente-select').value      = a.cliente_id || '';
  document.getElementById('aluguel-cpf').value                 = a.cpf || '';
  document.getElementById('aluguel-telefone').value            = a.telefone || '';
  document.getElementById('aluguel-cnh').value                 = a.cnh || '';
  document.getElementById('aluguel-endereco').value            = a.endereco || '';
  document.getElementById('aluguel-inicio').value              = novoInicio;
  document.getElementById('aluguel-fim').value                 = novoFim;
  document.getElementById('aluguel-periodo').value             = a.periodo || 'semana';
  document.getElementById('aluguel-valor').value               = a.valor || '';
  document.getElementById('aluguel-total').value               = a.total || '';
  document.getElementById('aluguel-caucao').value              = '0';
  document.getElementById('aluguel-caucao-devolvido').value    = 'nao';
  document.getElementById('aluguel-caucao-data').value         = '';
  document.getElementById('row-caucao-data').style.display     = 'none';
  document.getElementById('aluguel-status').value              = 'ativo';
  document.getElementById('modal-aluguel-title').textContent   = '🔄 Renovar Contrato — ' + a.cliente;
  openModal('modal-aluguel');
}

async function submitAluguel() {
  var inicio = document.getElementById('aluguel-inicio').value;
  var fim    = document.getElementById('aluguel-fim').value;
  if (fim && fim <= inicio) {
    alert('A data de fim deve ser depois da data de início.');
    return;
  }
  var contratoWin = window.open('', '_blank');
  const id  = document.getElementById('aluguel-id').value;
  const sel = document.getElementById('aluguel-cliente-select');
  const aluguel = {
    cliente_id:       sel.value || null,
    cliente:          sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '',
    veiculo_id:       document.getElementById('aluguel-moto').value || null,
    cpf:              document.getElementById('aluguel-cpf').value.trim(),
    telefone:         document.getElementById('aluguel-telefone').value.trim(),
    cnh:              document.getElementById('aluguel-cnh').value.trim(),
    endereco:         document.getElementById('aluguel-endereco').value.trim(),
    inicio:           document.getElementById('aluguel-inicio').value,
    fim:              document.getElementById('aluguel-fim').value || null,
    periodo:          document.getElementById('aluguel-periodo').value,
    valor:            parseFloat(document.getElementById('aluguel-valor').value) || null,
    total:            parseFloat(document.getElementById('aluguel-total').value) || null,
    caucao:           parseFloat(document.getElementById('aluguel-caucao').value) || null,
    caucao_devolvido: document.getElementById('aluguel-caucao-devolvido').value,
    caucao_data:      document.getElementById('aluguel-caucao-data').value || null,
    status:           document.getElementById('aluguel-status').value
  };
  var result = id
    ? await db.from('alugueis').update(aluguel).eq('id', id).select()
    : await db.from('alugueis').insert(aluguel).select();
  if (result.error) {
    if (contratoWin) contratoWin.close();
    alert('Erro ao salvar: ' + result.error.message);
    return;
  }
  var savedId = id || (result.data && result.data[0] ? result.data[0].id : null);
  // Novo aluguel: marca a moto como alugada automaticamente
  if (!id && aluguel.veiculo_id) {
    await db.from('veiculos').update({ status: 'alugada' }).eq('id', aluguel.veiculo_id);
  }
  if (!id && savedId) await gerarParcelas(savedId, aluguel);
  closeModal('modal-aluguel');
  renderAlugueis();
  if (!id && savedId && contratoWin) gerarContrato(savedId, contratoWin);
  else if (contratoWin) contratoWin.close();
}

async function gerarParcelas(aluguelId, aluguel) {
  if (!aluguel.inicio || !aluguel.valor) return;
  var diasPeriodo = aluguel.periodo === 'mes' ? 30 : 7;
  var inicio = new Date(aluguel.inicio + 'T00:00:00');
  var fim = aluguel.fim ? new Date(aluguel.fim + 'T00:00:00') : null;
  var parcelas = [];
  var num = 1;
  var venc = new Date(inicio);

  // Parcela 1: caução + primeira semana/mês
  var valorP1 = aluguel.valor + (aluguel.caucao || 0);
  var descP1 = aluguel.caucao
    ? 'Parcela 1 — ' + (aluguel.periodo === 'mes' ? 'Mês' : 'Semana') + ' 1 + Caução'
    : 'Parcela 1 — ' + (aluguel.periodo === 'mes' ? 'Mês' : 'Semana') + ' 1';
  var inicioStr = venc.getFullYear() + '-' + String(venc.getMonth() + 1).padStart(2, '0') + '-' + String(venc.getDate()).padStart(2, '0');
  parcelas.push({ aluguel_id: aluguelId, numero: num, descricao: descP1, valor: valorP1, vencimento: inicioStr, pago: false });
  num++;
  venc.setDate(venc.getDate() + diasPeriodo);

  // Parcelas seguintes — venc < fim (não <=) para não gerar parcela no último dia do contrato
  while (!fim || venc < fim) {
    var vencStr = venc.getFullYear() + '-' + String(venc.getMonth() + 1).padStart(2, '0') + '-' + String(venc.getDate()).padStart(2, '0');
    var desc = 'Parcela ' + num + ' — ' + (aluguel.periodo === 'mes' ? 'Mês' : 'Semana') + ' ' + num;
    parcelas.push({ aluguel_id: aluguelId, numero: num, descricao: desc, valor: aluguel.valor, vencimento: vencStr, pago: false });
    num++;
    venc.setDate(venc.getDate() + diasPeriodo);
    if (!fim && num > 52) break; // segurança: máximo 52 parcelas se não tiver data fim
  }

  var res = await db.from('parcelas').insert(parcelas);
  if (res.error) { alert('Erro ao gerar parcelas: ' + res.error.message); return false; }
  return true;
}

// --- MODAL PARCELAS ---
async function abrirParcelas(aluguelId) {
  _diasParadosAluguelId = aluguelId;
  var { data: aluguel } = await db.from('alugueis')
    .select('*, veiculos(modelo, placa)').eq('id', aluguelId).single();
  var { data: parcelas } = await db.from('parcelas')
    .select('*').eq('aluguel_id', aluguelId).order('numero');

  if (!aluguel) return;
  var vei = aluguel.veiculos;
  var totalPago   = (parcelas||[]).filter(function(p){ return p.pago; }).reduce(function(s,p){ return s + Number(p.valor_pago || p.valor); }, 0);
  var totalPendente = (parcelas||[]).filter(function(p){ return !p.pago; }).reduce(function(s,p){ return s + Number(p.valor); }, 0);
  var caucao = Number(aluguel.caucao || 0);
  var aluguelSemCaucao = Number(aluguel.total || 0);

  document.getElementById('modal-parcelas-titulo').textContent =
    (vei ? veiculoLabel(vei) + ' — ' : '') + aluguel.cliente;

  var caucaoInfo = caucao > 0
    ? '<div style="font-size:0.78rem;color:var(--text2);margin-bottom:0.75rem">' +
        'Aluguel: ' + fmtBRL(aluguelSemCaucao) + ' + Caução: ' + fmtBRL(caucao) + ' = Total a receber: <strong>' + fmtBRL(aluguelSemCaucao + caucao) + '</strong>' +
        ' &nbsp;<button class="btn btn-sm btn-secondary" onclick="regerarParcelas(\'' + aluguelId + '\')" style="font-size:0.72rem;padding:2px 8px">↺ Regenerar</button>' +
      '</div>'
    : '<div style="text-align:right;margin-bottom:0.5rem">' +
        '<button class="btn btn-sm btn-secondary" onclick="regerarParcelas(\'' + aluguelId + '\')" style="font-size:0.72rem;padding:2px 8px">↺ Regenerar</button>' +
      '</div>';

  document.getElementById('modal-parcelas-resumo').innerHTML =
    caucaoInfo +
    '<div style="display:flex;gap:1.5rem;flex-wrap:wrap;margin-bottom:1rem">' +
      '<span style="font-size:0.85rem">' + IC.check + ' Pago: <strong style="color:var(--green)">' + fmtBRL(totalPago) + '</strong></span>' +
      '<span style="font-size:0.85rem">' + IC.clock + ' Pendente: <strong style="color:var(--red)">' + fmtBRL(totalPendente) + '</strong></span>' +
    '</div>';

  var hoje = hojeLocalStr();
  document.getElementById('modal-parcelas-lista').innerHTML = (parcelas||[]).length
    ? (parcelas||[]).map(function(p) {
        var atrasado = !p.pago && p.vencimento < hoje;
        var cls = p.pago ? 'parcela-paga' : atrasado ? 'parcela-atrasada' : 'parcela-pendente';
        var badge = p.pago
          ? '<span class="badge badge-green">' + IC.check + ' Pago' + (p.data_pagamento ? ' ' + fmtDate(p.data_pagamento) : '') + '</span>'
          : atrasado
            ? '<span class="badge badge-red">' + IC.warn + ' Atrasado</span>'
            : '<span class="badge badge-yellow">' + IC.clock + ' Pendente</span>';
        var safeDesc = (p.descricao || '').replace(/'/g, "\\'");
        var btn = p.pago
          ? '<button class="btn btn-sm btn-secondary" onclick="toggleParcela(\'' + p.id + '\', false, \'' + aluguelId + '\')">Desfazer</button>'
          : '<button class="btn btn-sm btn-primary" onclick="abrirPagarParcela(\'' + p.id + '\',\'' + aluguelId + '\',' + p.valor + ',\'' + p.vencimento + '\',\'' + safeDesc + '\',\'\')">Marcar pago</button>' +
            '<button class="btn btn-sm btn-danger" onclick="excluirParcela(\'' + p.id + '\',\'' + aluguelId + '\')" title="Excluir parcela">×</button>';
        var valorExibido = p.pago && p.valor_pago && Number(p.valor_pago) !== Number(p.valor)
          ? fmtBRL(p.valor) + ' → <strong>' + fmtBRL(p.valor_pago) + '</strong>'
          : fmtBRL(p.valor);
        return '<div class="parcela-item ' + cls + '">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
            '<div style="font-weight:600;font-size:0.9rem;flex:1;min-width:0">' + p.descricao + '</div>' +
            '<div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0">' + badge + btn + '</div>' +
          '</div>' +
          '<div style="font-size:0.78rem;color:var(--text2);margin-top:0.25rem">Vence: ' + fmtDate(p.vencimento) + ' · ' + valorExibido + '</div>' +
        '</div>';
      }).join('')
    : '<p style="color:var(--text2);padding:1rem 0">Nenhuma parcela encontrada. <button class="btn btn-sm btn-primary" onclick="gerarParcelasManual(\'' + aluguelId + '\')">Gerar parcelas</button></p>';

  openModal('modal-parcelas');
}

async function excluirParcela(parcelaId, aluguelId) {
  if (!confirm('Excluir esta parcela? Ela some da lista e das cobranças.')) return;
  await db.from('parcelas').delete().eq('id', parcelaId);
  abrirParcelas(aluguelId);
  loadNotificacoes();
}

async function toggleParcela(parcelaId, pago, aluguelId) {
  var hoje = hojeLocalStr();
  await db.from('parcelas').update({
    pago: pago,
    data_pagamento: pago ? hoje : null
  }).eq('id', parcelaId);
  abrirParcelas(aluguelId);
}

async function gerarParcelasManual(aluguelId) {
  var { data: aluguel } = await db.from('alugueis').select('*').eq('id', aluguelId).single();
  if (!aluguel) { alert('Aluguel não encontrado.'); return; }
  if (!aluguel.inicio) { alert('Este aluguel não tem data de início cadastrada. Edite o aluguel e preencha a data de início.'); return; }
  if (!aluguel.valor) { alert('Este aluguel não tem valor cadastrado. Edite o aluguel e preencha o valor.'); return; }
  var ok = await gerarParcelas(aluguelId, aluguel);
  if (ok) abrirParcelas(aluguelId);
}

var _diasParadosAluguelId = null;

function abrirDiasParados() {
  document.getElementById('dias-parados-qtd').value = '';
  document.getElementById('dias-parados-motivo').value = '';
  openModal('modal-dias-parados');
}

var _diasParadosBusy = false;

async function confirmarDiasParados() {
  if (_diasParadosBusy) return;
  var dias = parseInt(document.getElementById('dias-parados-qtd').value);
  if (!dias) { alert('Informe quantos dias a moto ficou parada. (Use número negativo para corrigir um lançamento errado.)'); return; }

  var aluguelId = _diasParadosAluguelId;
  if (!aluguelId) return;

  _diasParadosBusy = true;
  try {
    var { data: parcelas } = await db.from('parcelas')
      .select('*').eq('aluguel_id', aluguelId).eq('pago', false);

    if (!parcelas || parcelas.length === 0) {
      alert('Não há parcelas em aberto para ajustar.');
      closeModal('modal-dias-parados');
      return;
    }

    for (var i = 0; i < parcelas.length; i++) {
      var p = parcelas[i];
      var d = new Date(p.vencimento + 'T00:00:00');
      d.setDate(d.getDate() + dias);
      var novoVenc = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      await db.from('parcelas').update({ vencimento: novoVenc }).eq('id', p.id);
    }

    closeModal('modal-dias-parados');
    alert('✅ ' + parcelas.length + ' parcela(s) em aberto ' + (dias > 0 ? 'adiada(s)' : 'adiantada(s)') + ' em ' + Math.abs(dias) + ' dia(s).');
    abrirParcelas(aluguelId);
  } finally {
    _diasParadosBusy = false;
  }
}

async function regerarParcelas(aluguelId) {
  if (!confirm('Isso vai apagar todas as parcelas atuais e gerar novamente. Continuar?')) return;
  var { data: aluguel } = await db.from('alugueis').select('*').eq('id', aluguelId).single();
  if (!aluguel) { alert('Aluguel não encontrado.'); return; }
  await db.from('parcelas').delete().eq('aluguel_id', aluguelId);
  var ok = await gerarParcelas(aluguelId, aluguel);
  if (ok) abrirParcelas(aluguelId);
}

// --- MANUTENÇÕES ---
function renderManutencoes() { renderManutencoesTab(); }

function openNewManutencao() {
  document.getElementById('form-manutencao').reset();
  document.getElementById('manut-id').value = '';
  document.getElementById('modal-manut-title').textContent = 'Nova Manutenção';
  populateVeiculoSelects();
  openModal('modal-manutencao');
}

async function editManutencao(id) {
  const { data: m } = await db.from('manutencoes').select('*').eq('id', id).single();
  if (!m) return;
  await populateVeiculoSelects();
  document.getElementById('manut-id').value      = m.id;
  document.getElementById('manut-moto').value    = m.veiculo_id || '';
  document.getElementById('manut-tipo').value    = m.tipo || '';
  document.getElementById('manut-data').value    = m.data || '';
  document.getElementById('manut-custo').value   = m.custo || '';
  document.getElementById('manut-km').value        = m.km || '';
  document.getElementById('manut-prox-km').value   = m.prox_km || '';
  document.getElementById('manut-prox-data').value = m.prox_data || '';
  document.getElementById('manut-desc').value      = m.descricao || '';
  document.getElementById('modal-manut-title').textContent = 'Editar Manutenção';
  openModal('modal-manutencao');
}

async function submitManutencao() {
  const id = document.getElementById('manut-id').value;
  const m = {
    veiculo_id: document.getElementById('manut-moto').value || null,
    tipo:       document.getElementById('manut-tipo').value,
    data:       document.getElementById('manut-data').value,
    custo:      parseFloat(document.getElementById('manut-custo').value) || null,
    km:         parseInt(document.getElementById('manut-km').value) || null,
    prox_km:    document.getElementById('manut-prox-km').value || null,
    prox_data:  document.getElementById('manut-prox-data').value || null,
    descricao:  document.getElementById('manut-desc').value.trim()
  };
  var result = id
    ? await db.from('manutencoes').update(m).eq('id', id)
    : await db.from('manutencoes').insert(m);
  if (result.error) { alert('Erro ao salvar: ' + result.error.message); return; }
  closeModal('modal-manutencao');
  if (document.getElementById('custos-geral').classList.contains('active')) renderManutencoesTab();
}

// --- DESPESAS (accordion por moto) ---
function _getProgRecorrentes(vei, hoje, pagoDesp) {
  var p2 = function(n) { return String(n).padStart(2, '0'); };
  var isoD = function(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  var isPago = function(tipoKey, vencStr) {
    if (!pagoDesp) return false;
    return pagoDesp.some(function(d) { return d.programada && d.pago && d.tipo === tipoKey && d.vencimento === vencStr; });
  };
  // Override: programada=true, pago=false record salvo manualmente para sobrescrever a data calculada
  var findOverride = function(tipoKey) {
    if (!pagoDesp) return null;
    return pagoDesp.find(function(d) { return d.programada && !d.pago && d.tipo === tipoKey; }) || null;
  };
  var entries = [];
  // IPVA — usa override se existir, senão percorre meses até achar o próximo não pago
  var ipvaMeses = [2, 3, 4, 5, 6];
  var ipvaOverride = findOverride('IPVA');
  if (ipvaOverride) {
    var dIpvaO = new Date(ipvaOverride.vencimento + 'T00:00:00');
    var mesO = dIpvaO.getMonth() + 1;
    var tipoLabelO = (mesO >= 2 && mesO <= 6) ? 'IPVA (parcela ' + (mesO - 1) + '/5)' : 'IPVA';
    entries.push({ tipo: tipoLabelO, data: dIpvaO, valor: '—', valorNum: null, diff: Math.round((dIpvaO - hoje) / 86400000), overrideId: ipvaOverride.id });
  } else {
    var encontrou = false;
    for (var y = hoje.getFullYear(); y <= hoje.getFullYear() + 2 && !encontrou; y++) {
      for (var i = 0; i < ipvaMeses.length && !encontrou; i++) {
        var d = new Date(y, ipvaMeses[i] - 1, 10);
        if (d >= hoje && !isPago('IPVA', isoD(d))) {
          entries.push({ tipo: 'IPVA (parcela ' + (ipvaMeses[i] - 1) + '/5)', data: d, valor: '—', valorNum: null, diff: Math.round((d - hoje) / 86400000) });
          encontrou = true;
        }
      }
    }
  }
  // Licenciamento — usa override se existir, senão avança 1 ano se já pago
  if (vei.placa) {
    var digitos = vei.placa.replace(/\D/g, '');
    var ult = digitos.length ? parseInt(digitos.slice(-1)) : null;
    if (ult !== null) {
      var licOverride = findOverride('Licenciamento');
      if (licOverride) {
        var dLicO = new Date(licOverride.vencimento + 'T00:00:00');
        entries.push({ tipo: 'Licenciamento', data: dLicO, valor: '—', valorNum: null, diff: Math.round((dLicO - hoje) / 86400000), overrideId: licOverride.id });
      } else {
        var mesLic = (ult === 0 ? 10 : ult) + 2;
        var anoLic = hoje.getFullYear();
        if (mesLic > 12) { mesLic -= 12; anoLic++; }
        var dLic = new Date(anoLic, mesLic - 1, 10);
        if (dLic < hoje) dLic = new Date(anoLic + 1, mesLic - 1, 10);
        while (isPago('Licenciamento', isoD(dLic))) {
          dLic = new Date(dLic.getFullYear() + 1, mesLic - 1, 10);
        }
        entries.push({ tipo: 'Licenciamento', data: dLic, valor: '—', valorNum: null, diff: Math.round((dLic - hoje) / 86400000) });
      }
    }
  }
  // Seguro + Rastreador — usa override se existir, senão avança 1 mês se já pago
  if (vei.seguro_rastreador_mensal) {
    var segOverride = findOverride('Seguro + Rastreador');
    if (segOverride) {
      var dSegO = new Date(segOverride.vencimento + 'T00:00:00');
      entries.push({ tipo: 'Seguro + Rastreador', data: dSegO, valor: fmtBRL(vei.seguro_rastreador_mensal), valorNum: vei.seguro_rastreador_mensal, diff: Math.round((dSegO - hoje) / 86400000), overrideId: segOverride.id });
    } else {
      var dSeg = new Date(hoje.getFullYear(), hoje.getMonth(), 10);
      if (dSeg < hoje) dSeg = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 10);
      while (isPago('Seguro + Rastreador', isoD(dSeg))) {
        dSeg = new Date(dSeg.getFullYear(), dSeg.getMonth() + 1, 10);
      }
      entries.push({ tipo: 'Seguro + Rastreador', data: dSeg, valor: fmtBRL(vei.seguro_rastreador_mensal), valorNum: vei.seguro_rastreador_mensal, diff: Math.round((dSeg - hoje) / 86400000) });
    }
  }
  return entries;
}

function _sitBadge(diff) {
  if (diff < 0)  return '<span class="badge badge-red">' + IC.warn + ' Vencido há ' + Math.abs(diff) + ' dia(s)</span>';
  if (diff === 0) return '<span class="badge badge-red">' + IC.warn + ' Vence hoje</span>';
  if (diff <= 10) return '<span class="badge badge-yellow">' + IC.dot_yel + ' Em ' + diff + ' dia(s)</span>';
  return '<span class="badge badge-green">' + IC.check + ' Em dia</span>';
}

function _buildDespesaMotoBody(vei, motoDesp) {
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  var p2 = function(n) { return String(n).padStart(2, '0'); };
  var fmtD = function(d) { return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear(); };
  var isoD = function(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  var subHdr = function(txt) { return '<div style="font-weight:600;font-size:0.82rem;color:var(--text2);letter-spacing:0.06em;text-transform:uppercase;margin:0.75rem 0 0.4rem">' + txt + '</div>'; };
  var progs = _getProgRecorrentes(vei, hoje, motoDesp);
  // IDs dos registros que estão sendo usados como override de data — não duplicar no bloco manual
  var overrideIds = {};
  progs.forEach(function(e) { if (e.overrideId) overrideIds[e.overrideId] = true; });
  var progRows = progs.map(function(e) {
    var tipoKey  = e.tipo.indexOf('IPVA') === 0 ? 'IPVA' : e.tipo.indexOf('Seguro') === 0 ? 'Seguro + Rastreador' : e.tipo;
    var safeTipo = e.tipo.replace(/'/g, "\\'");
    var safeKey  = tipoKey.replace(/'/g, "\\'");
    var safeVenc = isoD(e.data);
    var safeOvId = e.overrideId ? String(e.overrideId).replace(/'/g, "\\'") : '';
    var editarBtn = e.tipo.indexOf('Seguro') === 0
      ? ' <button class="btn btn-sm btn-secondary" onclick="abrirEditarSeguro(\'' + vei.id + '\',' + (e.valorNum || 'null') + ',\'' + safeVenc + '\',\'' + safeOvId + '\')">✎ Editar</button>'
      : '';
    return '<tr>' +
      '<td>' + e.tipo + '</td>' +
      '<td>' + fmtD(e.data) + '</td>' +
      '<td>' + e.valor + '</td>' +
      '<td>' + _sitBadge(e.diff) + '</td>' +
      '<td><div class="btn-actions">' +
        '<button class="btn btn-sm btn-success" onclick="abrirPagarDespesaProgModal(\'' + vei.id + '\',\'' + safeKey + '\',\'' + safeVenc + '\',\'' + safeTipo + '\',' + (e.valorNum || '') + ')">✓ Pagar</button>' +
        editarBtn +
      '</div></td>' +
    '</tr>';
  }).join('');
  // Manually-added programadas that aren't auto-calc overrides (e.g. multas, taxas extras)
  var motoProgM = motoDesp.filter(function(d) { return d.programada && !d.pago && !overrideIds[d.id]; });
  motoProgM.sort(function(a, b) { return (a.vencimento || '').localeCompare(b.vencimento || ''); });
  var progMRows = motoProgM.map(function(x) {
    var safeId   = String(x.id).replace(/'/g, "\\'");
    var safeTipo = String(x.tipo || '').replace(/'/g, "\\'");
    var safeVenc = x.vencimento || '';
    var vencDate = x.vencimento ? new Date(x.vencimento + 'T00:00:00') : null;
    var diff = vencDate ? Math.ceil((vencDate - hoje) / 86400000) : null;
    return '<tr>' +
      '<td>' + (x.tipo || '—') + '</td>' +
      '<td>' + (x.vencimento ? x.vencimento.split('-').reverse().join('/') : '—') + '</td>' +
      '<td>' + (x.valor ? fmtBRL(x.valor) : '—') + '</td>' +
      '<td>' + (diff !== null ? _sitBadge(diff) : '—') + '</td>' +
      '<td><div class="btn-actions">' +
        '<button class="btn btn-sm btn-success" onclick="abrirPagarDespesaProgModal(\'' + vei.id + '\',\'' + safeTipo + '\',\'' + safeVenc + '\',\'' + safeTipo + '\',' + (x.valor || '') + ')">✓ Pagar</button>' +
        '<button class="btn btn-sm btn-danger" style="margin-left:4px" onclick="confirmDelete(\'despesa\',\'' + safeId + '\')">Excluir</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');
  progRows = progRows + progMRows;
  if (!progRows) progRows = '<tr class="empty-row"><td colspan="4">Nenhuma despesa programada configurada.</td></tr>';

  // Despesas Avulsas = programadas pagas + avulsas (programada=false), misturadas
  var motoPagas   = motoDesp.filter(function(d) { return d.programada && d.pago; });
  var motoAvulsas = motoDesp.filter(function(d) { return !d.programada; });
  var combined    = motoPagas.concat(motoAvulsas);
  combined.sort(function(a, b) { return (b.vencimento || '').localeCompare(a.vencimento || ''); });
  var avulsasRows = combined.map(function(x) {
    var venc = x.vencimento ? x.vencimento.split('-').reverse().join('/') : '—';
    var safeId   = String(x.id).replace(/'/g, "\\'");
    var safeTipo = String(x.tipo || '').replace(/'/g, "\\'");
    var safeVenc = x.vencimento || '';
    var acao = x.programada
      ? '<button class="btn btn-sm btn-danger" onclick="desfazerPagamentoProg(\'' + vei.id + '\',\'' + safeTipo + '\',\'' + safeVenc + '\',\'' + safeId + '\')">↩ Desfazer</button>'
      : '<button class="btn btn-sm btn-secondary" onclick="editDespesa(\'' + safeId + '\')">✎ Editar</button>' +
        ' <button class="btn btn-sm btn-danger" onclick="confirmDelete(\'despesa\',\'' + safeId + '\')">Excluir</button>';
    return '<tr>' +
      '<td>' + (x.tipo || '—') + '</td>' +
      '<td>' + venc + '</td>' +
      '<td>' + (x.valor ? fmtBRL(x.valor) : '—') + '</td>' +
      '<td><div class="btn-actions">' + acao + '</div></td>' +
    '</tr>';
  }).join('');
  if (!avulsasRows) avulsasRows = '<tr class="empty-row"><td colspan="4">Nenhuma despesa avulsa registrada.</td></tr>';

  var totalDesp = combined.reduce(function(s, x) { return s + Number(x.valor || 0); }, 0);

  return subHdr('Programadas (Recorrentes)') +
    '<div class="table-wrap"><table>' +
      '<thead><tr><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th></th></tr></thead>' +
      '<tbody>' + progRows + '</tbody></table></div>' +
    subHdr('Despesas Avulsas') +
    '<div class="table-wrap"><table>' +
      '<thead><tr><th>Tipo</th><th>Data</th><th>Valor</th><th>Ação</th></tr></thead>' +
      '<tbody>' + avulsasRows + '</tbody></table></div>' +
    '<div style="text-align:right;padding:0.6rem 0.25rem;font-weight:700;font-size:0.9rem;border-top:1px solid var(--border);margin-top:0.25rem">Total em despesas: <span style="color:var(--red)">' + fmtBRL(totalDesp) + '</span></div>';
}

function abrirEditarSeguro(veiculoId, valorAtual, dataAtual, overrideId) {
  document.getElementById('es-veiculo-id').value = veiculoId || '';
  document.getElementById('es-override-id').value = overrideId || '';
  document.getElementById('es-valor').value = valorAtual ? String(valorAtual).replace('.', ',') : '';
  document.getElementById('es-vencimento').value = dataAtual || '';
  document.getElementById('es-obs').value = '';
  openModal('modal-editar-seguro');
}

async function salvarEditarSeguro() {
  var veiculoId  = document.getElementById('es-veiculo-id').value;
  var overrideId = document.getElementById('es-override-id').value;
  var valorRaw   = document.getElementById('es-valor').value.replace(',', '.').trim();
  var valor      = valorRaw ? parseFloat(valorRaw) : null;
  var vencimento = document.getElementById('es-vencimento').value;
  var obs        = document.getElementById('es-obs').value.trim();

  if (!veiculoId) return;
  if (!valor && !vencimento) { alert('Informe ao menos o valor ou a data de vencimento.'); return; }

  var erros = [];

  // Atualiza valor mensal no veículo
  if (valor) {
    var { error: errVei } = await db.from('veiculos').update({ seguro_rastreador_mensal: valor }).eq('id', veiculoId);
    if (errVei) erros.push('Erro ao atualizar valor: ' + errVei.message);
  }

  // Salva/atualiza override de data na tabela despesas
  if (vencimento) {
    var despData = { veiculo_id: veiculoId, tipo: 'Seguro + Rastreador', vencimento: vencimento, valor: valor, programada: true, pago: false, obs: obs || null };
    var errDesp;
    if (overrideId) {
      ({ error: errDesp } = await db.from('despesas').update(despData).eq('id', overrideId));
    } else {
      ({ error: errDesp } = await db.from('despesas').insert(despData));
    }
    if (errDesp) erros.push('Erro ao salvar data: ' + errDesp.message);
  }

  if (erros.length) { alert(erros.join('\n')); return; }

  closeModal('modal-editar-seguro');
  _despesasCache = null;
  if (document.getElementById('custos-geral').classList.contains('active')) renderDespesasTab();
  loadNotificacoes();
}

async function registrarDespesaProg(veiculoId, tipo, vencimento) {
  await populateVeiculoSelects();
  document.getElementById('form-despesa').reset();
  document.getElementById('despesa-id').value        = '';
  document.getElementById('modal-despesa-title').textContent = 'Registrar Despesa';
  document.getElementById('despesa-moto').value      = veiculoId;
  var tipoSelect = tipo.indexOf('IPVA') === 0 ? 'IPVA' : tipo.indexOf('Seguro') === 0 ? 'Seguro' : tipo;
  document.getElementById('despesa-tipo').value      = tipoSelect;
  document.getElementById('despesa-ano').value       = vencimento ? vencimento.substring(0, 4) : new Date().getFullYear();
  document.getElementById('despesa-vencimento').value = vencimento;
  openModal('modal-despesa');
}

var _despesasCache = null;

async function renderDespesasTab() {
  var container = document.getElementById('despesas-motos-list');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--text2);padding:1rem 0">Carregando...</p>';
  var [veiculosRes, despesasRes] = await Promise.all([
    db.from('veiculos').select('id, modelo, placa, seguro_rastreador_mensal').order('modelo'),
    db.from('despesas').select('id, tipo, ano, valor, vencimento, obs, veiculo_id, programada, pago').order('created_at', { ascending: false })
  ]);
  var veiculos = veiculosRes.data || [];
  var allDespesas = despesasRes.data || [];
  _despesasCache = { veiculos: veiculos, allDespesas: allDespesas };
  if (!veiculos.length) {
    container.innerHTML = '<p style="color:var(--text2);text-align:center;padding:2rem">Nenhuma moto cadastrada.</p>';
    return;
  }
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  container.innerHTML = veiculos.map(function(vei) {
    var motoDesp  = allDespesas.filter(function(d) { return d.veiculo_id === vei.id; });
    var progs     = _getProgRecorrentes(vei, hoje, motoDesp);
    var overrideIds2 = {};
    progs.forEach(function(e) { if (e.overrideId) overrideIds2[e.overrideId] = true; });
    var p2h = function(n) { return String(n).padStart(2, '0'); };
    var vencidas = 0, proximas = 0;
    progs.forEach(function(e) {
      var tipoKey = e.tipo.indexOf('IPVA') === 0 ? 'IPVA' : e.tipo.indexOf('Seguro') === 0 ? 'Seguro + Rastreador' : e.tipo;
      var venc = e.data.getFullYear() + '-' + p2h(e.data.getMonth() + 1) + '-' + p2h(e.data.getDate());
      var pago = motoDesp.some(function(d) { return d.programada && d.pago && d.tipo === tipoKey && d.vencimento === venc; });
      if (pago) return;
      if (e.diff < 0) vencidas++; else if (e.diff <= 10) proximas++;
    });
    var motoProgM = motoDesp.filter(function(d) { return d.programada && !d.pago && !overrideIds2[d.id]; });
    motoProgM.forEach(function(x) {
      if (!x.vencimento) return;
      var diff = Math.round((new Date(x.vencimento + 'T00:00:00') - hoje) / 86400000);
      if (diff < 0) vencidas++; else if (diff <= 10) proximas++;
    });
    var badges = vencidas ? '<span class="badge badge-red" style="margin-left:0.5rem">' + IC.warn + ' ' + vencidas + ' vencida(s)</span>' : '';
    badges += proximas ? '<span class="badge badge-yellow" style="margin-left:0.5rem">' + IC.dot_yel + ' ' + proximas + ' próxima(s)</span>' : '';
    if (!vencidas && !proximas) badges += '<span class="badge badge-green" style="margin-left:0.5rem">' + IC.check + ' Em dia</span>';
    return '<div style="border:1px solid var(--border);border-radius:0.75rem;margin-bottom:0.6rem;overflow:hidden">' +
      '<div onclick="toggleDespesaMoto(\'' + vei.id + '\')" style="display:flex;align-items:center;gap:0.5rem;padding:0.8rem 1rem;cursor:pointer;background:var(--bg3);user-select:none">' +
        '<span id="acc-desp-arrow-' + vei.id + '" style="font-size:0.7rem;color:var(--text2);transition:transform 0.2s">▶</span>' +
        '<span style="font-weight:600">' + veiculoLabel(vei) + '</span>' +
        badges +
      '</div>' +
      '<div id="acc-desp-body-' + vei.id + '" style="display:none;padding:0.5rem 1rem 1rem"></div>' +
    '</div>';
  }).join('');
}

function toggleDespesaMoto(veiculoId) {
  var body  = document.getElementById('acc-desp-body-' + veiculoId);
  var arrow = document.getElementById('acc-desp-arrow-' + veiculoId);
  if (!body) return;
  var open = body.style.display !== 'none';
  if (open) {
    body.style.display = 'none';
    if (arrow) arrow.textContent = '▶';
  } else {
    if (!body.innerHTML.trim() && _despesasCache) {
      var vei      = _despesasCache.veiculos.find(function(v) { return v.id === veiculoId; });
      var motoDesp = _despesasCache.allDespesas.filter(function(d) { return d.veiculo_id === veiculoId; });
      if (vei) body.innerHTML = _buildDespesaMotoBody(vei, motoDesp);
    }
    body.style.display = 'block';
    if (arrow) arrow.textContent = '▼';
  }
}

function renderDespesas() { renderDespesasTab(); }

async function abrirDespesaNotif(veiculoId, tipo, vencimento, notifKey) {
  _pendingNotifKey = notifKey || null;
  document.getElementById('notif-dropdown').style.display = 'none';
  showSection('custos-geral');
  showCustosTab('despesas');
  document.getElementById('form-despesa').reset();
  document.getElementById('despesa-id').value = '';
  document.getElementById('modal-despesa-title').textContent = 'Nova Despesa';
  document.getElementById('despesa-tipo').value = tipo;
  document.getElementById('despesa-ano').value = new Date().getFullYear();
  document.getElementById('despesa-vencimento').value = vencimento;
  openModal('modal-despesa');
  await populateVeiculoSelects();
  document.getElementById('despesa-moto').value = veiculoId;
}

function openNewDespesaChoice() { openModal('modal-tipo-despesa'); }

function openNewDespesaProg() {
  document.getElementById('dp-id').value         = '';
  document.getElementById('dp-tipo').value       = '';
  document.getElementById('dp-valor').value      = '';
  document.getElementById('dp-vencimento').value = '';
  document.getElementById('dp-obs').value        = '';
  document.getElementById('modal-despesa-prog-title').textContent = 'Nova Despesa Programada';
  populateVeiculoSelects();
  openModal('modal-despesa-prog');
}

async function editDespesaProgAuto(veiculoId, tipo, vencimento, overrideId) {
  await populateVeiculoSelects();
  document.getElementById('dp-id').value         = overrideId || '';
  document.getElementById('dp-moto').value       = veiculoId;
  var tipoSelect = tipo.indexOf('IPVA') === 0 ? 'IPVA' : tipo.indexOf('Seguro') === 0 ? 'Seguro' : tipo;
  document.getElementById('dp-tipo').value       = tipoSelect;
  document.getElementById('dp-valor').value      = '';
  document.getElementById('dp-vencimento').value = vencimento;
  document.getElementById('dp-obs').value        = '';
  document.getElementById('modal-despesa-prog-title').textContent = 'Editar Despesa Programada';
  openModal('modal-despesa-prog');
}

function excluirDespesaAutoCalc() {
  alert('Esta despesa é calculada automaticamente com base nos dados da moto e não pode ser excluída.');
}

function abrirPagarDespesaProgModal(veiculoId, tipoKey, vencimento, displayTipo, valorSugerido) {
  document.getElementById('pdp-veiculo-id').value  = veiculoId;
  document.getElementById('pdp-tipo-key').value    = tipoKey;
  document.getElementById('pdp-vencimento').value  = vencimento;
  document.getElementById('pdp-valor').value       = valorSugerido ? String(valorSugerido).replace('.', ',') : '';
  document.getElementById('modal-pagar-despesa-prog-title').textContent = 'Pagar — ' + displayTipo;
  openModal('modal-pagar-despesa-prog');
}

async function submitPagarDespesaProg() {
  var veiculoId  = document.getElementById('pdp-veiculo-id').value;
  var tipoKey    = document.getElementById('pdp-tipo-key').value;
  var vencimento = document.getElementById('pdp-vencimento').value;
  var raw        = document.getElementById('pdp-valor').value.trim().replace(',', '.');
  var valor      = parseFloat(raw);
  if (raw === '' || isNaN(valor)) { alert('Informe o valor pago.'); return; }
  closeModal('modal-pagar-despesa-prog');
  await marcarDespesaProgPaga(veiculoId, tipoKey, vencimento, valor);
}

async function marcarDespesaProgPaga(veiculoId, tipoKey, vencimento, valor) {
  // Apaga override de data (programada=true, pago=false) antes de registrar o pagamento
  await db.from('despesas')
    .delete()
    .eq('veiculo_id', veiculoId)
    .eq('tipo', tipoKey)
    .eq('programada', true)
    .eq('pago', false);
  if (_despesasCache) {
    _despesasCache.allDespesas = _despesasCache.allDespesas.filter(function(d) {
      return !(d.veiculo_id === veiculoId && d.tipo === tipoKey && d.programada && !d.pago);
    });
  }
  var res = await db.from('despesas').insert({
    veiculo_id: veiculoId,
    tipo: tipoKey,
    vencimento: vencimento,
    valor: (valor === null || valor === undefined || isNaN(valor)) ? null : valor,
    programada: true,
    pago: true
  }).select('id').single();
  if (res.error) { alert('Erro ao marcar como pago: ' + res.error.message); return; }
  if (_despesasCache) {
    _despesasCache.allDespesas.push({
      id: res.data ? res.data.id : '_tmp',
      veiculo_id: veiculoId, tipo: tipoKey, vencimento: vencimento, valor: valor, programada: true, pago: true
    });
  }
  _refreshDespesaAccordion(veiculoId);
}

async function desmarcarDespesaProgPaga(veiculoId, tipoKey, vencimento) {
  await db.from('despesas')
    .delete()
    .eq('veiculo_id', veiculoId)
    .eq('tipo', tipoKey)
    .eq('vencimento', vencimento)
    .eq('programada', true)
    .eq('pago', true);
  if (_despesasCache) {
    _despesasCache.allDespesas = _despesasCache.allDespesas.filter(function(d) {
      return !(d.veiculo_id === veiculoId && d.tipo === tipoKey && d.vencimento === vencimento && d.programada && d.pago);
    });
  }
  _refreshDespesaAccordion(veiculoId);
}

async function desfazerPagamentoProg(veiculoId, tipoKey, vencimento, id) {
  if (!confirm('Desfazer pagamento de ' + tipoKey + ' (' + (vencimento ? vencimento.split('-').reverse().join('/') : '—') + ')?')) return;
  await db.from('despesas').delete().eq('id', id);
  if (_despesasCache) {
    _despesasCache.allDespesas = _despesasCache.allDespesas.filter(function(d) { return d.id !== id; });
  }
  _refreshDespesaAccordion(veiculoId);
}

function _refreshDespesaAccordion(veiculoId) {
  var body = document.getElementById('acc-desp-body-' + veiculoId);
  if (!body || !_despesasCache) return;
  var vei      = _despesasCache.veiculos.find(function(v) { return v.id === veiculoId; });
  var motoDesp = _despesasCache.allDespesas.filter(function(d) { return d.veiculo_id === veiculoId; });
  if (vei) { body.innerHTML = _buildDespesaMotoBody(vei, motoDesp); body.style.display = 'block'; }
}

async function editDespesaProg(id) {
  var { data: d } = await db.from('despesas').select('*').eq('id', id).single();
  if (!d) return;
  await populateVeiculoSelects();
  document.getElementById('dp-id').value         = d.id;
  document.getElementById('dp-moto').value       = d.veiculo_id || '';
  document.getElementById('dp-tipo').value       = d.tipo || '';
  document.getElementById('dp-valor').value      = d.valor || '';
  document.getElementById('dp-vencimento').value = d.vencimento || '';
  document.getElementById('dp-obs').value        = d.obs || '';
  document.getElementById('modal-despesa-prog-title').textContent = 'Editar Despesa Programada';
  openModal('modal-despesa-prog');
}

async function submitDespesaProg() {
  var id = document.getElementById('dp-id').value;
  var veiculoId = document.getElementById('dp-moto').value || null;
  var d = {
    veiculo_id:  veiculoId,
    tipo:        document.getElementById('dp-tipo').value,
    valor:       parseFloat(document.getElementById('dp-valor').value) || null,
    vencimento:  document.getElementById('dp-vencimento').value || null,
    obs:         document.getElementById('dp-obs').value.trim(),
    programada:  true,
    pago:        false
  };
  if (!d.tipo || !d.vencimento) { alert('Tipo e vencimento são obrigatórios.'); return; }
  var result;
  if (id) {
    result = await db.from('despesas').update(d).eq('id', id);
  } else {
    result = await db.from('despesas').insert(d).select('*').single();
  }
  if (result.error) { alert('Erro ao salvar: ' + result.error.message); return; }
  closeModal('modal-despesa-prog');
  if (_despesasCache && veiculoId) {
    if (id) {
      var idx = _despesasCache.allDespesas.findIndex(function(r) { return r.id === id; });
      if (idx >= 0) Object.assign(_despesasCache.allDespesas[idx], d);
      else _despesasCache.allDespesas.push(Object.assign({ id: id }, d));
    } else if (result.data && result.data.id) {
      _despesasCache.allDespesas.push(result.data);
    } else {
      _despesasCache = null;
      if (document.getElementById('custos-geral').classList.contains('active')) renderDespesasTab();
      return;
    }
    _refreshDespesaAccordion(veiculoId);
  } else {
    _despesasCache = null;
    if (document.getElementById('custos-geral').classList.contains('active')) renderDespesasTab();
  }
}

function openNewDespesa() {
  document.getElementById('form-despesa').reset();
  document.getElementById('despesa-id').value = '';
  document.getElementById('modal-despesa-title').textContent = 'Nova Despesa';
  populateVeiculoSelects();
  openModal('modal-despesa');
}

async function openNewDespesaAvulsa(veiculoId) {
  document.getElementById('form-despesa').reset();
  document.getElementById('despesa-id').value = '';
  document.getElementById('modal-despesa-title').textContent = 'Nova Despesa Avulsa';
  await populateVeiculoSelects();
  if (veiculoId) document.getElementById('despesa-moto').value = veiculoId;
  openModal('modal-despesa');
}


async function editDespesa(id) {
  const { data: d } = await db.from('despesas').select('*').eq('id', id).single();
  if (!d) return;
  await populateVeiculoSelects();
  document.getElementById('despesa-id').value         = d.id;
  document.getElementById('despesa-moto').value       = d.veiculo_id || '';
  document.getElementById('despesa-tipo').value       = d.tipo || '';
  document.getElementById('despesa-ano').value        = d.ano || '';
  document.getElementById('despesa-valor').value      = d.valor || '';
  document.getElementById('despesa-vencimento').value = d.vencimento || '';
  document.getElementById('despesa-obs').value        = d.obs || '';
  document.getElementById('modal-despesa-title').textContent = 'Editar Despesa';
  openModal('modal-despesa');
}

async function submitDespesa(e) {
  e.preventDefault();
  const id = document.getElementById('despesa-id').value;
  const d = {
    veiculo_id:  document.getElementById('despesa-moto').value || null,
    tipo:        document.getElementById('despesa-tipo').value,
    ano:         document.getElementById('despesa-ano').value || null,
    valor:       document.getElementById('despesa-valor').value || null,
    vencimento:  document.getElementById('despesa-vencimento').value || null,
    obs:         document.getElementById('despesa-obs').value.trim(),
    programada:  false,
    pago:        true
  };
  var result;
  if (id) {
    result = await db.from('despesas').update(d).eq('id', id);
  } else {
    result = await db.from('despesas').insert(d).select('*').single();
  }
  if (result.error) { alert('Erro ao salvar: ' + result.error.message); return; }
  closeModal('modal-despesa');
  if (_pendingNotifKey) {
    dismissNotif(_pendingNotifKey);
    if (!id && result.data && result.data.id) dismissNotif('despesa_' + result.data.id);
    _pendingNotifKey = null;
  }
  var veiculoId = d.veiculo_id;
  if (_despesasCache && veiculoId) {
    if (id) {
      var idx = _despesasCache.allDespesas.findIndex(function(r) { return r.id === id; });
      if (idx >= 0) Object.assign(_despesasCache.allDespesas[idx], d);
      else _despesasCache.allDespesas.push(Object.assign({ id: id }, d));
    } else if (result.data && result.data.id) {
      _despesasCache.allDespesas.push(result.data);
    } else {
      _despesasCache = null;
      if (document.getElementById('custos-geral').classList.contains('active')) renderDespesasTab();
      return;
    }
    _refreshDespesaAccordion(veiculoId);
  } else {
    _despesasCache = null;
    if (document.getElementById('custos-geral').classList.contains('active')) renderDespesasTab();
  }
}

// --- RELATÓRIOS ---
function resetFiltroMes() {
  document.getElementById('filtro-mes').value = '';
  renderRelatorios();
}

async function renderRelatorios() {
  var filtroMes = document.getElementById('filtro-mes').value;
  const [{ data: veiculos }, { data: alugueis }, { data: manutencoes }, { data: despesas }, { data: parcelasPagas }] = await Promise.all([
    db.from('veiculos').select('*'),
    db.from('alugueis').select('*').neq('status', 'cancelado'),
    db.from('manutencoes').select('*'),
    db.from('despesas').select('*'),
    db.from('parcelas').select('*, alugueis(veiculo_id, caucao)').eq('pago', true)
  ]);

  var v = veiculos || [];
  var a = alugueis || [], m = manutencoes || [], d = despesas || [];
  var pp = parcelasPagas || [];

  if (filtroMes) {
    a = a.filter(function(x) { return x.inicio && x.inicio.startsWith(filtroMes); });
    m = m.filter(function(x) { return x.data && x.data.startsWith(filtroMes); });
    d = d.filter(function(x) { return x.vencimento && x.vencimento.startsWith(filtroMes); });
    pp = pp.filter(function(x) { return x.data_pagamento && x.data_pagamento.startsWith(filtroMes); });
  }

  // Mapa: veiculo_id → receita de parcelas pagas (sem caução)
  function valorSemCaucaoRel(p) {
    var v = Number(p.valor_pago || p.valor || 0);
    if (p.numero === 1 && p.alugueis && p.alugueis.caucao) v = Math.max(0, v - Number(p.alugueis.caucao));
    return v;
  }
  var receitaPorVeiculo = {};
  pp.forEach(function(p) {
    var vid = p.alugueis && p.alugueis.veiculo_id;
    if (vid) receitaPorVeiculo[vid] = (receitaPorVeiculo[vid] || 0) + valorSemCaucaoRel(p);
  });

  var totalReceita = 0, totalCustos = 0, totalAlugueis = 0;
  var todosAlugueis = alugueis || [];

  var rows = v.map(function(vei) {
    var receita = receitaPorVeiculo[vei.id] || 0;
    var custos  = m.filter(function(x) { return x.veiculo_id === vei.id; })
                  .reduce(function(s, x) { return s + Number(x.custo || 0); }, 0)
                + d.filter(function(x) { return x.veiculo_id === vei.id && x.pago; })
                  .reduce(function(s, x) { return s + Number(x.valor || 0); }, 0);
    var qtd = a.filter(function(x) { return x.veiculo_id === vei.id; }).length;
    var lucro = receita - custos;
    totalReceita  += receita;
    totalCustos   += custos;
    totalAlugueis += qtd;

    // Payback
    var valorCompra = Number(vei.valor_compra || 0);
    var paybackTxt = '';
    if (!valorCompra) {
      paybackTxt = 'Informe o valor de compra';
    } else {
      var lucroMensal = 0;
      if (filtroMes) {
        lucroMensal = lucro;
      } else {
        var alugsVei = todosAlugueis.filter(function(x) { return x.veiculo_id === vei.id; });
        var datas = alugsVei.map(function(x) { return x.inicio; }).filter(Boolean).sort();
        if (datas.length > 0) {
          var mesesDecorridos = Math.max(1, Math.ceil((new Date(hojeLocalStr()) - new Date(datas[0] + 'T00:00:00')) / (30 * 86400000)));
          lucroMensal = lucro / mesesDecorridos;
        }
      }
      if (lucroMensal > 0) {
        var mesesPB = Math.ceil(valorCompra / lucroMensal);
        paybackTxt = mesesPB <= 12
          ? mesesPB + ' mês(es)'
          : Math.floor(mesesPB / 12) + ' ano(s)' + (mesesPB % 12 > 0 ? ' e ' + (mesesPB % 12) + ' mês(es)' : '');
      } else {
        paybackTxt = 'Sem lucro positivo';
      }
    }

    return { vei: vei, receita: receita, custos: custos, lucro: lucro, qtd: qtd, valorCompra: valorCompra, paybackTxt: paybackTxt };
  });

  var grid = document.getElementById('relatorio-motos-grid');
  grid.innerHTML = rows.length
    ? rows.map(function(r) {
        var lc = r.lucro >= 0 ? 'text-green' : 'text-red';
        var paybackLabel = filtroMes ? 'Payback (neste ritmo)' : 'Payback (média histórica)';
        return '<div class="relatorio-card">' +
          '<h4>' + veiculoLabel(r.vei) + '</h4>' +
          '<div class="rel-row"><span>Receita</span><span class="text-green">' + fmtBRL(r.receita) + '</span></div>' +
          '<div class="rel-row"><span>Custos</span><span class="text-red">' + fmtBRL(r.custos) + '</span></div>' +
          '<div class="rel-row"><span>Aluguéis</span><span>' + r.qtd + '</span></div>' +
          '<div class="rel-row"><span>Lucro/Prejuízo</span><span class="' + lc + '">' + fmtBRL(r.lucro) + '</span></div>' +
          (r.valorCompra ? '<div class="rel-row"><span>Investimento</span><span>' + fmtBRL(r.valorCompra) + '</span></div>' : '') +
          '<div class="rel-row"><span>' + paybackLabel + '</span><span style="color:var(--yellow);font-weight:600">' + r.paybackTxt + '</span></div>' +
          '</div>';
      }).join('')
    : '<p style="color:var(--text2)">Nenhum veículo cadastrado.</p>';

  var tbody = document.getElementById('relatorio-tbody');
  tbody.innerHTML = rows.length
    ? rows.map(function(r) {
        var lc = r.lucro >= 0 ? 'text-green' : 'text-red';
        return '<tr>' +
          '<td>' + veiculoLabel(r.vei) + '</td>' +
          '<td class="text-green">' + fmtBRL(r.receita) + '</td>' +
          '<td class="text-red">'   + fmtBRL(r.custos)  + '</td>' +
          '<td class="' + lc + '"><strong>' + fmtBRL(r.lucro) + '</strong></td>' +
          '<td>' + r.qtd + '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="5">Nenhum dado encontrado</td></tr>';

  var lucroTotal = totalReceita - totalCustos;
  document.getElementById('relatorio-tfoot').innerHTML =
    '<td><strong>TOTAL</strong></td>' +
    '<td class="text-green"><strong>' + fmtBRL(totalReceita) + '</strong></td>' +
    '<td class="text-red"><strong>'   + fmtBRL(totalCustos)  + '</strong></td>' +
    '<td class="' + (lucroTotal >= 0 ? 'text-green' : 'text-red') + '"><strong>' + fmtBRL(lucroTotal) + '</strong></td>' +
    '<td><strong>' + totalAlugueis + '</strong></td>';
}

// --- DELETE ---
function confirmDelete(type, id) {
  var btn = document.getElementById('confirm-delete-btn');
  btn.onclick = async function() {
    var tableMap  = { cliente: 'clientes', veiculo: 'veiculos', aluguel: 'alugueis', manutencao: 'manutencoes', despesa: 'despesas', manut_prog: 'manut_programada' };
    var renderMap = {
      cliente:    function() { renderClientes(); populateClienteSelect(); },
      veiculo:    function() { renderVeiculos(); populateVeiculoSelects(); },
      aluguel:    renderAlugueis,
      manutencao: renderManutencoes,
      despesa:    renderDespesas,
      manut_prog: renderManutProgramada
    };
    await db.from(tableMap[type]).delete().eq('id', id);
    closeModal('modal-confirm');
    renderMap[type]();
  };
  openModal('modal-confirm');
}

// --- CHECKLIST DE COMPRA ---
var CHECKLIST = [
  { cat: '📄 Documentação', items: [
    { id: 'c01', text: 'CRLV em dia e no nome do vendedor' },
    { id: 'c02', text: 'Número do chassi confere com o documento' },
    { id: 'c03', text: 'Sem multas, débitos ou recall pendente' },
    { id: 'c04', text: 'Sem financiamento em aberto (checar no Detran)' },
    { id: 'c05', text: 'Chassi original — sem sinais de lixa, solda ou adulteração' },
  ]},
  { cat: '⚙️ Motor', items: [
    { id: 'c06', text: 'Parte fácil a frio, sem empurrar ou esquentar antes' },
    { id: 'c07', text: 'Sem barulhos estranhos (batidas, chiados, estalos)' },
    { id: 'c08', text: 'Sem fumaça azul ou preta no escapamento' },
    { id: 'c09', text: 'Sem vazamento de óleo embaixo ou nas juntas' },
    { id: 'c10', text: 'Óleo com nível OK e cor clara (não preto nem com água)' },
    { id: 'c11', text: 'Temperatura normal após rodar — não esquenta rápido demais' },
  ]},
  { cat: '⚡ Parte Elétrica', items: [
    { id: 'c12', text: 'Farol dianteiro e lanterna traseira funcionando' },
    { id: 'c13', text: 'Setas (pisca-pisca) dos dois lados funcionando' },
    { id: 'c14', text: 'Painel de instrumentos (velocímetro, hodômetro) funcionando' },
    { id: 'c15', text: 'Buzina funcionando' },
    { id: 'c16', text: 'Bateria OK — parte sem ajuda externa ou troca recente' },
  ]},
  { cat: '🛑 Freios', items: [
    { id: 'c17', text: 'Freio dianteiro com boa pressão, sem esponjamento' },
    { id: 'c18', text: 'Freio traseiro travando corretamente' },
    { id: 'c19', text: 'Pastilhas ou lonas com espessura suficiente' },
    { id: 'c20', text: 'Sem barulhos ao frear (chiado, rangido)' },
  ]},
  { cat: '➿ Suspensão', items: [
    { id: 'c21', text: 'Garfo dianteiro sem vazamento de óleo' },
    { id: 'c22', text: 'Amortecedor traseiro sem folga excessiva ou barulho' },
    { id: 'c23', text: 'Sem vibrações ou batidas fortes ao passar em lombadas' },
  ]},
  { cat: '🛞 Pneus, Rodas e Corrente', items: [
    { id: 'c24', text: 'Pneu dianteiro — sem rachado, bolha, careca ou desgaste irregular' },
    { id: 'c25', text: 'Pneu traseiro — sem rachado, bolha, careca ou desgaste irregular' },
    { id: 'c26', text: 'Rodas sem amassados, trincas ou empenamento' },
    { id: 'c27', text: 'Corrente lubrificada, tensão OK, sem elos travados' },
  ]},
  { cat: 'Funilaria e Estrutura', items: [
    { id: 'c28', text: 'Quadro sem sinais de batida, dobra ou solda improvisada' },
    { id: 'c29', text: 'Sem ferrugem excessiva no chassi ou escapamento' },
    { id: 'c30', text: 'Plásticos e carenagens sem trincas graves' },
    { id: 'c31', text: 'Retrovisores, para-lama e banco em bom estado' },
  ]},
  { cat: '🚦 Teste em Movimento', items: [
    { id: 'c32', text: 'Câmbio troca suavemente todas as marchas' },
    { id: 'c33', text: 'Embreagem com boa regulagem — não patina nem agarra' },
    { id: 'c34', text: 'Moto não puxa para um lado (alinhamento OK)' },
    { id: 'c35', text: 'Aceleração e frenagem suaves, sem sustos' },
  ]},
];

var checklistState = JSON.parse(localStorage.getItem('chk') || '{}');

function onPlacaInput(input) {
  input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  document.getElementById('chk-btn-detran').style.display = input.value.length >= 7 ? 'inline-flex' : 'none';
  document.getElementById('chk-copiado').style.display = 'none';
}

function abrirDetran() {
  var placa = document.getElementById('chk-placa').value.toUpperCase();
  navigator.clipboard.writeText(placa).catch(function() {});
  document.getElementById('chk-copiado').style.display = 'block';
  window.open('https://sistemas.detran.ce.gov.br/central', '_blank');
}


function buildChecklist() {
  var body = document.getElementById('checklist-body');
  body.innerHTML = CHECKLIST.map(function(group) {
    var items = group.items.map(function(item) {
      return '<div class="checklist-item" id="chk-row-' + item.id + '">' +
        '<span class="checklist-text">' + item.text + '</span>' +
        '<div class="checklist-btns">' +
          '<button class="chk-btn chk-ok"  onclick="setCheck(\'' + item.id + '\',\'ok\')"  title="Aprovado">✓</button>' +
          '<button class="chk-btn chk-na"  onclick="setCheck(\'' + item.id + '\',\'na\')"  title="Não aplicável">X</button>' +
          '<button class="chk-btn chk-bad" onclick="setCheck(\'' + item.id + '\',\'bad\')" title="Reprovado">R</button>' +
        '</div>' +
      '</div>';
    }).join('');
    return '<div class="checklist-group">' +
      '<div class="checklist-group-title">' + group.cat + '</div>' +
      items +
    '</div>';
  }).join('');
  updateChecklistUI();
}

function setCheck(id, val) {
  checklistState[id] = checklistState[id] === val ? null : val;
  localStorage.setItem('chk', JSON.stringify(checklistState));
  updateChecklistUI();
}

function updateChecklistUI() {
  var ok = 0, na = 0, bad = 0, total = 0;
  CHECKLIST.forEach(function(group) {
    group.items.forEach(function(item) {
      total++;
      var row = document.getElementById('chk-row-' + item.id);
      if (!row) return;
      var state = checklistState[item.id];
      row.className = 'checklist-item' +
        (state === 'ok' ? ' item-ok' : state === 'na' ? ' item-na' : state === 'bad' ? ' item-bad' : '');
      row.querySelector('.chk-ok').className  = 'chk-btn chk-ok'  + (state === 'ok'  ? ' active' : '');
      row.querySelector('.chk-na').className  = 'chk-btn chk-na'  + (state === 'na'  ? ' active' : '');
      row.querySelector('.chk-bad').className = 'chk-btn chk-bad' + (state === 'bad' ? ' active' : '');
      if (state === 'ok')  ok++;
      if (state === 'na')  na++;
      if (state === 'bad') bad++;
    });
  });
  var pendentes = total - ok - na - bad;
  var verdict = '', vclass = 'verdict-none';
  if (ok + bad === 0) {
    verdict = 'Nenhum item avaliado';
  } else if (bad === 0) {
    verdict = '✓ Excelente — pode comprar!'; vclass = 'verdict-great';
  } else if (bad <= 2) {
    verdict = '⚠ Atenção — negocie o preço'; vclass = 'verdict-ok';
  } else if (bad <= 5) {
    verdict = '⚠ Muito cuidado — avalie bem'; vclass = 'verdict-ok';
  } else {
    verdict = 'R Não compre — muitos problemas'; vclass = 'verdict-bad';
  }
  document.getElementById('checklist-score').innerHTML =
    '<div class="score-stat"><span class="score-num" style="color:#4ade80">' + ok  + '</span><span class="score-lbl">Aprovado</span></div>' +
    '<div class="score-divider"></div>' +
    '<div class="score-stat"><span class="score-num" style="color:#fbbf24">' + na  + '</span><span class="score-lbl">N/A</span></div>' +
    '<div class="score-divider"></div>' +
    '<div class="score-stat"><span class="score-num" style="color:#f87171">' + bad + '</span><span class="score-lbl">Reprovado</span></div>' +
    '<div class="score-divider"></div>' +
    '<div class="score-stat"><span class="score-num" style="color:var(--text2)">' + pendentes + '</span><span class="score-lbl">Pendentes</span></div>' +
    '<span class="score-verdict ' + vclass + '">' + verdict + '</span>';
}

function resetChecklist() {
  if (!confirm('Resetar todos os itens do checklist?')) return;
  checklistState = {};
  localStorage.removeItem('chk');
  updateChecklistUI();
}

// --- CONTRATO ---
async function gerarContrato(id, win) {
  var { data: a } = await db.from('alugueis')
    .select('*, veiculos(modelo, placa, ano, cor)')
    .eq('id', id).single();
  if (!a) return;

  var vei = a.veiculos || {};
  var nomeCliente = a.cliente || '-';
  var cpfCliente  = a.cpf    || '-';
  var cnhCliente  = a.cnh    || '-';
  var endCliente  = a.endereco  || '-';
  var telCliente  = a.telefone  || '-';

  function fmtCPF(c) {
    if (!c) return '-';
    c = c.replace(/\D/g,'');
    return c.length === 11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4') : c;
  }
  function fmtValor(v) {
    return v ? 'R$ ' + parseFloat(v).toFixed(2).replace('.',',') : '-';
  }
  function fmtD(d) {
    return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
  }
  var periodoTexto = { dia: 'Diária', semana: 'Semanal', quinzena: 'Quinzenal', mes: 'Mensal' };
  var hoje = new Date().toLocaleDateString('pt-BR');
  var contratoNum = 'CTR-' + id.substring(0,8).toUpperCase();
  var cfg = getConfig();

  var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
    '<title>Contrato — ' + nomeCliente + '</title><style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.7;color:#000;background:#fff;padding:2cm;max-width:21cm;margin:0 auto}' +
    'h1{text-align:center;font-size:16pt;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px}' +
    '.sub{text-align:center;font-size:10pt;color:#444;margin-bottom:20px}' +
    '.ref{text-align:right;font-size:10pt;color:#555;margin-bottom:18px}' +
    '.sec{font-size:11pt;font-weight:bold;text-transform:uppercase;margin:18px 0 8px;border-bottom:1px solid #000;padding-bottom:2px}' +
    '.cl{margin-bottom:10px;text-align:justify}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:12px}' +
    'td{padding:4px 8px;border:1px solid #ccc;font-size:11pt}' +
    'td.lb{font-weight:bold;width:36%;background:#f5f5f5}' +
    '.asrow{display:flex;justify-content:space-between;gap:32px;margin-top:40px}' +
    '.asbox{flex:1;text-align:center}' +
    '.asline{border-top:1px solid #000;margin-bottom:6px;margin-top:48px}' +
    '.asname{font-size:10pt}' +
    '.pbtn{position:fixed;top:16px;right:16px;padding:10px 20px;background:#1a73e8;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-family:sans-serif}' +
    '@media print{.pbtn{display:none}body{padding:1.5cm}}' +
    '</style></head><body>' +
    '<button class="pbtn" onclick="window.print()">Imprimir / Salvar PDF</button>' +
    '<h1>Contrato de Locação de Motocicleta</h1>' +
    '<div class="sub">Contrato firmado entre as partes identificadas abaixo.</div>' +
    '<div class="ref">Nº ' + contratoNum + ' &nbsp;|&nbsp; ' + cfg.cidade + ', ' + hoje + '</div>' +

    '<div class="sec">1. Das Partes</div>' +
    '<table>' +
      '<tr><td class="lb">Locador (Proprietário)</td><td>' + cfg.nome + '</td></tr>' +
      '<tr><td class="lb">CPF do Locador</td><td>' + cfg.cpf + '</td></tr>' +
      '<tr><td class="lb">Endereço do Locador</td><td>' + cfg.endereco + '</td></tr>' +
      '<tr><td class="lb">Locatário</td><td>' + nomeCliente + '</td></tr>' +
      '<tr><td class="lb">CPF do Locatário</td><td>' + fmtCPF(cpfCliente) + '</td></tr>' +
      '<tr><td class="lb">CNH do Locatário</td><td>' + cnhCliente + '</td></tr>' +
      '<tr><td class="lb">Endereço do Locatário</td><td>' + endCliente + '</td></tr>' +
      '<tr><td class="lb">Telefone do Locatário</td><td>' + telCliente + '</td></tr>' +
    '</table>' +

    '<div class="sec">2. Do Objeto</div>' +
    '<table>' +
      '<tr><td class="lb">Motocicleta</td><td>' + (vei.modelo||'-') + '</td></tr>' +
      '<tr><td class="lb">Placa</td><td>' + (vei.placa||'-') + '</td></tr>' +
      '<tr><td class="lb">Ano</td><td>' + (vei.ano||'-') + '</td></tr>' +
      '<tr><td class="lb">Cor</td><td>' + (vei.cor||'-') + '</td></tr>' +
      '<tr><td class="lb">Chassi</td><td>' + (vei.chassi||'-') + '</td></tr>' +
      '<tr><td class="lb">RENAVAM</td><td>' + (vei.renavam||'-') + '</td></tr>' +
    '</table>' +

    '<div class="sec">3. Do Prazo e Valor</div>' +
    '<table>' +
      '<tr><td class="lb">Início da Locação</td><td>' + fmtD(a.inicio) + '</td></tr>' +
      '<tr><td class="lb">Fim da Locação</td><td>' + (a.fim ? fmtD(a.fim) : '-') + '</td></tr>' +
      '<tr><td class="lb">Modalidade</td><td>' + (periodoTexto[a.periodo]||a.periodo||'-') + '</td></tr>' +
      '<tr><td class="lb">Valor por período</td><td>' + fmtValor(a.valor) + '</td></tr>' +
      '<tr><td class="lb">Valor Total</td><td>' + fmtValor(a.total) + '</td></tr>' +
      '<tr><td class="lb">Caução</td><td>' + (a.caucao ? fmtValor(a.caucao) : 'Não aplicável') + '</td></tr>' +
    '</table>' +

    '<div class="sec">4. Pagamento</div>' +
    '<div class="cl"><strong>4.1</strong> Pagar antes do vencimento garante <strong>3% de desconto</strong>.</div>' +
    '<div class="cl"><strong>4.2</strong> Pagar no dia do vencimento: valor cheio, sem desconto nem acréscimo.</div>' +
    '<div class="cl"><strong>4.3</strong> Atraso gera <strong>multa de 2%</strong> (cobrada uma vez só no primeiro dia) mais <strong>juros de 1% ao mês</strong>. Exemplo: parcela de ' + fmtValor(a.valor) + ' atrasada 7 dias = ' + fmtValor((a.valor||0) + (a.valor||0)*0.02 + (a.valor||0)*(0.01/30)*7) + ' no total.</div>' +
    '<div class="cl"><strong>4.4</strong> Se atrasar, a moto pode ser <strong>bloqueada pelo rastreador sem aviso</strong>. O bloqueio só é retirado após o pagamento total.</div>' +
    '<div class="cl"><strong>4.5</strong> Atraso igual ou superior a <strong>7 (sete) dias</strong> autoriza o Locador a <strong>recolher a moto imediatamente</strong>, onde ela estiver, sem necessidade de aviso prévio. O recolhimento não cancela a dívida: os valores em aberto continuam sendo devidos, podendo ser descontados do caução.</div>' +
    '<div class="cl"><strong>4.6</strong> O limite de uso é de <strong>1.000 km por semana</strong>. Ultrapassar pode gerar cobrança extra ou rescisão do contrato.</div>' +

    '<div class="sec">5. Obrigações do Locatário</div>' +
    '<div class="cl"><strong>5.1</strong> Devolver a moto nas mesmas condições em que recebeu, salvo desgaste normal.</div>' +
    '<div class="cl"><strong>5.2</strong> Usar capacete e todos os equipamentos exigidos pelo Código de Trânsito.</div>' +
    '<div class="cl"><strong>5.3</strong> Não emprestar nem sublocar a moto para ninguém sem autorização escrita do Locador.</div>' +
    '<div class="cl"><strong>5.4</strong> Manter o tanque abastecido e avisar o Locador se o óleo estiver baixo. A troca de óleo é por conta do Locador.</div>' +
    '<div class="cl"><strong>5.5</strong> Todas as multas de trânsito durante o período de locação são por conta do Locatário.</div>' +
    '<div class="cl"><strong>5.6</strong> Proibido usar a moto para atividades ilegais, carregar cargas não permitidas ou participar de rachas.</div>' +
    '<div class="cl"><strong>5.7</strong> Em caso de acidente, roubo, furto ou qualquer ocorrência policial, avisar o Locador imediatamente.</div>' +
    '<div class="cl"><strong>5.8</strong> Em até <strong>24 horas</strong> após assinar, aceitar a transferência do veículo para seu nome no app <strong>CDT (Carteira Digital de Trânsito)</strong>. Caso contrário, o contrato poderá ser cancelado.</div>' +
    '<div class="cl"><strong>5.9</strong> Proibido circular a mais de <strong>100 km</strong> de Fortaleza-CE. Se descumprir, a moto é recolhida sem devolução do caução.</div>' +
    '<div class="cl"><strong>5.10</strong> Proibido fazer qualquer modificação na moto (peças, pintura, escapamento, etc.) sem autorização escrita. Se fizer, paga o conserto para voltar ao estado original.</div>' +
    '<div class="cl"><strong>5.11</strong> Toda multa deve ser paga no prazo, mesmo que queira recorrer. Se recorrer e ganhar, o valor é devolvido em até <strong>5 dias úteis</strong>. Se não pagar no prazo, o valor é descontado do caução.</div>' +
    '<div class="cl"><strong>5.12</strong> Se se envolver em acidente comprovadamente sob efeito de álcool, drogas ou remédios que proíbem dirigir, pagará o <strong>valor FIPE da moto</strong> na data do acidente. O caução é retido e o restante cobrado judicialmente.</div>' +

    '<div class="sec">6. Danos à Moto</div>' +
    '<div class="cl"><strong>6.1</strong> O Locatário é responsável por qualquer dano causado durante a locação (batidas, tombamentos, vandalismo). Desgaste normal não é cobrado.</div>' +
    '<div class="cl"><strong>6.2</strong> Acidente por culpa do Locatário: dano até R$1.000 → paga o valor exato. Dano acima de R$1.000 → aciona seguro e paga franquia de R$1.000 (descontado do caução). Culpa de terceiro com seguro → sem custo pro Locatário. Terceiro sem seguro → o terceiro paga a franquia.</div>' +
    '<div class="cl"><strong>6.3</strong> O caução pode ser usado para cobrir danos, multas ou valores em aberto ao final do contrato.</div>' +
    '<div class="cl"><strong>6.4</strong> O caução só é devolvido <strong>30 dias após o fim do contrato</strong>, para verificar se veio alguma multa ou pendência. Se houver, o valor é descontado antes da devolução.</div>' +
    '<div class="cl"><strong>6.5</strong> Se o caução for usado para cobrir qualquer valor durante o contrato, o Locatário tem até <strong>7 dias</strong> para repor o valor descontado e manter o caução no valor original. Enquanto não repuser, o Locador poderá bloquear a moto.</div>' +

    '<div class="sec">7. Prazo e Encerramento</div>' +
    '<div class="cl"><strong>7.1</strong> O prazo mínimo deste contrato é de <strong>30 dias</strong>.</div>' +
    '<div class="cl"><strong>7.2</strong> O Locatário só pode pedir para encerrar após os 30 dias iniciais, com aviso de pelo menos <strong>5 dias de antecedência</strong>. Devolver a moto antes dos 30 dias não cancela o que deve pagar.</div>' +
    '<div class="cl"><strong>7.3</strong> Devolver a moto com atraso gera cobrança proporcional pelos dias a mais.</div>' +
    '<div class="cl"><strong>7.4</strong> Se qualquer regra deste contrato for descumprida, o Locador pode recolher a moto imediatamente e cobrar os valores devidos.</div>' +
    '<div class="cl"><strong>7.5</strong> O Locador pode encerrar o contrato a <strong>qualquer hora</strong>, avisando com 24 horas de antecedência. O caução é devolvido após os 30 dias de verificação.</div>' +
    '<div class="cl"><strong>7.6</strong> Não há moto reserva em caso de manutenção ou pane. Em caso de colisão, pode haver moto reserva conforme disponibilidade. Se a moto ficar parada por problema do Locador, os dias parados são <strong>adicionados ao prazo do contrato</strong> — ou seja, o Locatário ganha dias a mais no final. Exemplo: contrato de 35 dias com 1 dia parado = 36 dias de uso efetivo.</div>' +

    '<div class="sec">8. Sem Vínculo de Emprego</div>' +
    '<div class="cl"><strong>8.1</strong> Este é um contrato de aluguel de moto, não de emprego. Não existe nenhum vínculo empregatício entre as partes.</div>' +
    '<div class="cl"><strong>8.2</strong> O Locatário é profissional autônomo: define sozinho seus horários, rotas e para quais aplicativos ou clientes trabalha, sem qualquer subordinação ao Locador. Isso <strong>não afasta as regras deste contrato</strong> — o uso da moto continua sujeito a todas as obrigações, limites e proibições previstos neste documento.</div>' +
    '<div class="cl"><strong>8.3</strong> O Locatário é responsável pelo próprio INSS e impostos. O Locador não tem nenhuma obrigação trabalhista.</div>' +
    '<div class="cl"><strong>8.4</strong> Se o Locatário alegar que é empregado do Locador, isso será quebra grave de contrato e ele pagará todas as custas do processo judicial.</div>' +
    '<div class="sec">9. Em caso de conflito</div>' +
    '<div class="cl"><strong>9.1</strong> Qualquer problema que não for resolvido entre as partes será tratado no foro de Fortaleza/CE.</div>' +

    '<div class="cl" style="margin-top:16px;text-align:justify">As partes declaram ter lido e concordado com todos os termos acima, assinando este contrato em 2 vias.</div>' +
    '<div class="cl" style="text-align:center;margin-top:8px"><strong>' + cfg.cidade + ', ' + hoje + '</strong></div>' +

    '<div class="asrow">' +
      '<div class="asbox"><div class="asline"></div><div class="asname"><strong>' + cfg.nome + '</strong><br>Locador — CPF ' + cfg.cpf + '</div></div>' +
      '<div class="asbox"><div class="asline"></div><div class="asname"><strong>' + nomeCliente + '</strong><br>Locatário — CPF ' + fmtCPF(cpfCliente) + '</div></div>' +
    '</div>' +
    '<div class="asrow" style="margin-top:32px">' +
      '<div class="asbox"><div class="asline"></div><div class="asname">Testemunha 1<br>Nome: _________________________ &nbsp; CPF: ___________________</div></div>' +
      '<div class="asbox"><div class="asline"></div><div class="asname">Testemunha 2<br>Nome: _________________________ &nbsp; CPF: ___________________</div></div>' +
    '</div>' +
    '</body></html>';

  var w = win || window.open('', '_blank', 'width=920,height=750,scrollbars=yes');
  w.document.write(html);
  w.document.close();
}

// --- COBRANÇAS ---
function gerarPixEMV(chave) {
  function campo(id, val) { return id + String(val.length).padStart(2, '0') + val; }
  var mai = campo('00', 'BR.GOV.BCB.PIX') + campo('01', chave);
  var emv = campo('00', '01') + campo('26', mai) + campo('52', '0000') + campo('53', '986') +
    campo('58', 'BR') + campo('59', 'Vrunn') + campo('60', 'Fortaleza') +
    campo('62', campo('05', '0001')) + '6304';
  var crc = 0xFFFF;
  for (var i = 0; i < emv.length; i++) {
    crc ^= emv.charCodeAt(i) << 8;
    for (var j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return emv + crc.toString(16).toUpperCase().padStart(4, '0');
}

async function renderCobrancas() {
  var container = document.getElementById('cobrancas-lista');
  var countEl   = document.getElementById('cobrancas-count');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--text2);padding:1rem">Carregando...</div>';

  var hojeStr = hojeLocalStr();
  var dias    = parseInt((document.getElementById('cobrancas-dias') || {}).value || '2', 10);
  var emNStr  = new Date(new Date(hojeStr).getTime() + dias * 86400000).toISOString().split('T')[0];

  var { data: parcelas } = await db
    .from('parcelas')
    .select('*, alugueis!inner(cliente, telefone, status, veiculos(modelo, placa))')
    .eq('pago', false)
    .eq('alugueis.status', 'ativo')
    .lte('vencimento', emNStr)
    .order('vencimento');

  parcelas = (parcelas || []).filter(function(p) { return p.alugueis; });

  if (countEl) countEl.textContent = parcelas.length || '';

  if (!parcelas.length) {
    container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text2)">' + IC.chkCirc + ' Nenhuma cobrança pendente nos próximos ' + dias + ' dias</div>';
    return;
  }

  var pixCode = gerarPixEMV('aba0d81b-5cb4-446f-bd89-e444f266d103');

  container.innerHTML = parcelas.map(function(p) {    var alu    = p.alugueis || {};
    var vei    = alu.veiculos;
    var nome   = (alu.cliente || 'Cliente').toUpperCase();
    var fone   = (alu.telefone || '').replace(/\D/g, '');
    var atrasada = p.vencimento < hojeStr;
    var hoje0    = p.vencimento === hojeStr;
    var valorDesc = Math.round(p.valor * 0.97 * 100) / 100;

    var statusLabel = atrasada
      ? IC.warn + ' Atrasada desde ' + fmtDate(p.vencimento)
      : hoje0
        ? IC.dot_red + ' Vence hoje!'
        : IC.cal + ' Vence em ' + fmtDate(p.vencimento);
    var corStatus = atrasada ? 'var(--red)' : hoje0 ? 'var(--yellow)' : 'var(--blue2)';
    var bordaCard = atrasada ? 'var(--red)' : hoje0 ? 'var(--yellow)' : 'var(--blue)';

    var nomeDisplay = nome.charAt(0) + nome.slice(1).toLowerCase();
    var motoLabel   = vei ? vei.modelo + (vei.placa ? ' · ' + vei.placa : '') : '';

    var msg = 'Aviso automático — Vrunn Sistema: Olá, ' + nomeDisplay + '.\n\n';
    if (atrasada) {
      msg += 'O pagamento do aluguel';
      if (vei) msg += ' da ' + vei.modelo;
      msg += ' no valor de *' + fmtBRL(p.valor) + '* consta em atraso (venceu em ' + fmtDate(p.vencimento) + ').\n\nPor favor, regularize assim que possível.';
    } else {
      msg += 'Lembrete: o pagamento do aluguel';
      if (vei) msg += ' da ' + vei.modelo;
      msg += ' no valor de *' + fmtBRL(p.valor) + '* vence ' + (hoje0 ? '*hoje*' : 'em *' + fmtDate(p.vencimento) + '*') + '.';
      if (!hoje0) msg += '\n\n💡 Pagando antes do vencimento, o sistema aplica *3% de desconto* — fica *' + fmtBRL(valorDesc) + '*.';
    }
    var pagarLink = 'https://naldinhosahdo.github.io/Empresa-de-motos-/pagar.html?v=' +
      encodeURIComponent(String(p.valor)) + '&n=' + encodeURIComponent(nomeDisplay) +
      '&d=' + encodeURIComponent(p.vencimento);
    msg += '\n\n📲 *Pagar agora:* ' + pagarLink + '\n_(O link mostra o valor atualizado do dia e o QR Code para pagamento)_\n\nMensagem gerada automaticamente pelo sistema Vrunn 🏍️';

    var encodedMsg = encodeURIComponent(msg);
    var url = fone
      ? 'intent://send?phone=55' + fone + '&text=' + encodedMsg + '#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end'
      : null;

    var btnStyle1 = 'text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.45rem 0.85rem';
    var btnStyle2 = btnStyle1 + ';background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3)';
    var btnStyle3 = btnStyle1 + ';background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3)';

    var diasAtraso = atrasada ? Math.round((new Date(hojeStr + 'T00:00:00') - new Date(p.vencimento + 'T00:00:00')) / 86400000) : 0;
    var multaVal   = atrasada ? Math.round(p.valor * 0.02 * 100) / 100 : 0;
    var jurosVal   = atrasada ? Math.round(p.valor * (0.01 / 30) * diasAtraso * 100) / 100 : 0;
    var valorComMulta = atrasada ? Math.round((p.valor + multaVal + jurosVal) * 100) / 100 : p.valor;

    var msg2 = 'Aviso automático — Vrunn Sistema: Identificamos pendência no pagamento de *' + fmtBRL(p.valor) + '* com vencimento em ' + fmtDate(p.vencimento) + (atrasada ? ', que está em atraso há *' + diasAtraso + ' dia(s)*.\n\n💸 Valor atualizado com encargos:\n• Valor original: ' + fmtBRL(p.valor) + '\n• Multa (2%): ' + fmtBRL(multaVal) + '\n• Juros (' + diasAtraso + ' dia(s)): ' + fmtBRL(jurosVal) + '\n• *Total a pagar: ' + fmtBRL(valorComMulta) + '*' : '.') + '\n\nCaso o pagamento não seja regularizado, a motocicleta será bloqueada automaticamente pelo sistema. O link abaixo sempre mostra o valor atualizado com os encargos do dia. Para regularizar acesse: ' + pagarLink;
    var msg3 = 'Aviso automático — Vrunn Sistema: O pagamento de *' + fmtBRL(p.valor) + '* com vencimento em ' + fmtDate(p.vencimento) + ' não foi realizado dentro do prazo estabelecido. A motocicleta foi bloqueada automaticamente pelo sistema e está impossibilitada de uso. O desbloqueio ocorrerá de forma automática mediante a confirmação do pagamento. Para regularizar acesse: ' + pagarLink + '\n\nApós a confirmação, o sistema processará o desbloqueio em até 30 minutos.';

    var btnsHtml = url
      ? '<div style="display:flex;flex-direction:column;gap:0.4rem;align-items:flex-end">' +
          '<a href="' + url + '" target="_blank" rel="noopener" class="btn btn-primary" style="' + btnStyle1 + '">Lembrete 1</a>' +
          '<a href="intent://send?phone=55' + fone + '&text=' + encodeURIComponent(msg2) + '#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end" target="_blank" rel="noopener" class="btn" style="' + btnStyle2 + '">⚠️ Lembrete 2</a>' +
          '<a href="intent://send?phone=55' + fone + '&text=' + encodeURIComponent(msg3) + '#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end" target="_blank" rel="noopener" class="btn" style="' + btnStyle3 + '">🔒 Lembrete 3</a>' +
        '</div>'
      : '<span style="font-size:0.78rem;color:var(--red)">Sem telefone</span>';

    return '<div class="cobranca-card" style="border-left-color:' + bordaCard + '">' +
      '<div class="cobranca-info">' +
        '<div class="cobranca-nome">' + nome + (motoLabel ? '<span class="cobranca-moto"> · ' + motoLabel + '</span>' : '') + '</div>' +
        '<div class="cobranca-status" style="color:' + corStatus + '">' + statusLabel + '</div>' +
        '<div class="cobranca-valor">' + fmtBRL(p.valor) + '</div>' +
      '</div>' +
      '<div class="cobranca-acao">' + btnsHtml + '</div>' +
    '</div>';
  }).join('');
}

// --- MULTAS ---
async function renderMultas() {
  var container = document.getElementById('multas-lista');
  var countEl   = document.getElementById('multas-count');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--text2);padding:1rem">Carregando...</div>';

  var { data: multas } = await db
    .from('multas')
    .select('*, veiculos(modelo, placa), alugueis(cliente, telefone)')
    .order('data_infracao', { ascending: false });

  multas = multas || [];
  if (countEl) countEl.textContent = multas.length || '';

  if (!multas.length) {
    container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text2)">' + IC.chkCirc + ' Nenhuma multa registrada</div>';
    return;
  }

  container.innerHTML = multas.map(function(m) {
    var vei = m.veiculos;
    var alu = m.alugueis;
    var pago = m.status === 'pago';
    var statusColor = pago ? 'var(--green)' : 'var(--red)';
    var statusLabel = pago ? IC.check + ' Pago' : IC.warn + ' Pendente';

    var fone = alu ? (alu.telefone || '').replace(/\D/g, '') : '';
    var nomeDisplay = alu ? alu.cliente : '';
    var msg = 'Olá ' + nomeDisplay + '! 😊\n\n';
    msg += 'Identificamos uma multa de trânsito';
    if (vei) msg += ' na ' + vei.modelo + ' · ' + vei.placa;
    msg += ', com data de ' + fmtDate(m.data_infracao) + '.\n\n';
    msg += '*Valor da multa:* ' + fmtBRL(m.valor);
    if (m.descricao) msg += '\n*Infração:* ' + m.descricao;
    msg += '\n\nPor favor, entre em contato para regularizar.\n\nAtt, Vrunn 🏍️';

    var whatsUrl = fone
      ? 'intent://send?phone=55' + fone + '&text=' + encodeURIComponent(msg) + '#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end'
      : null;

    var btnCobrar = (alu && whatsUrl)
      ? '<a href="' + whatsUrl + '" target="_blank" rel="noopener" class="btn btn-primary" style="text-decoration:none;font-size:0.8rem;text-align:center">Cobrar multa</a>'
      : '';

    var btnPagar = !pago
      ? '<button class="btn btn-secondary btn-sm" style="font-size:0.8rem" onclick="marcarMultaPaga(\'' + m.id + '\')">Pagar</button>'
      : '<button class="btn btn-sm" style="font-size:0.8rem;background:var(--green);color:#fff" onclick="marcarMultaPendente(\'' + m.id + '\')">Pago</button>';

    return '<div class="multa-card">' +
      '<div class="multa-info">' +
        '<div class="multa-veiculo">' + (vei ? vei.modelo + ' · ' + vei.placa : '—') + '</div>' +
        '<div class="multa-data">' + IC.cal + ' ' + fmtDate(m.data_infracao) + (m.descricao ? ' · ' + m.descricao : '') + '</div>' +
        '<div class="multa-responsavel">' + (alu ? alu.cliente : 'Sem aluguel nessa data') + '</div>' +
        '<div style="margin-top:0.35rem">' +
          '<span class="multa-valor">' + fmtBRL(m.valor) + '</span>' +
          '<span style="font-size:0.72rem;font-weight:700;color:' + statusColor + ';margin-left:0.5rem">' + statusLabel + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="multa-acoes">' +
        btnCobrar +
        btnPagar +
        '<button class="btn btn-danger btn-sm" onclick="deletarMulta(\'' + m.id + '\')">Excluir</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function renderCaucao() {
  var lista    = document.getElementById('caucao-lista');
  var countEl  = document.getElementById('caucao-count');
  if (!lista) return;
  lista.innerHTML = '<div style="color:var(--text2);padding:1rem">Carregando...</div>';

  var { data: alugueis } = await db
    .from('alugueis')
    .select('id, cliente, caucao, caucao_devolvido, inicio, fim, veiculos(modelo, placa)')
    .neq('status', 'cancelado')
    .gt('caucao', 0)
    .order('fim', { ascending: false });

  var todos = (alugueis || []);
  var pendentes = todos.filter(function(a) { return a.caucao_devolvido !== 'sim'; });
  if (countEl) countEl.textContent = pendentes.length || '';

  if (!todos.length) {
    lista.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text2)">Nenhum caução cadastrado</div>';
    return;
  }

  lista.innerHTML = todos.map(function(a) {
    var vei = a.veiculos;
    var devolvido = a.caucao_devolvido === 'sim';
    var borda = devolvido ? 'var(--green)' : 'var(--yellow)';
    var btn = devolvido
      ? '<button class="btn btn-sm" style="font-size:0.85rem;white-space:nowrap;background:var(--green);color:#fff" onclick="desfazerDevolucaoCaucao(\'' + a.id + '\')">Devolvido</button>'
      : '<button class="btn btn-primary" style="font-size:0.85rem;white-space:nowrap" onclick="devolverCaucao(\'' + a.id + '\')">Devolver</button>';
    return '<div class="cobranca-card" style="border-left-color:' + borda + ';opacity:' + (devolvido ? '0.6' : '1') + '">' +
      '<div class="cobranca-info">' +
        '<div class="cobranca-nome">' + a.cliente + '</div>' +
        '<div class="cobranca-status" style="color:var(--text2)">' + (vei ? vei.modelo + ' · ' + vei.placa : '') + '</div>' +
        '<div class="cobranca-status" style="color:var(--text2)">' + fmtDate(a.inicio) + (a.fim ? ' → ' + fmtDate(a.fim) : '') + '</div>' +
        '<div class="cobranca-valor" style="color:' + (devolvido ? 'var(--green)' : 'var(--yellow)') + '">' + fmtBRL(a.caucao) + '</div>' +
      '</div>' +
      '<div class="cobranca-acao">' + btn + '</div>' +
    '</div>';
  }).join('');
}

async function devolverCaucao(aluguelId) {
  if (!confirm('Confirmar devolução do caução?')) return;
  var { error } = await db.from('alugueis').update({ caucao_devolvido: 'sim', caucao_data: hojeLocalStr() }).eq('id', aluguelId);
  if (error) { alert('Erro: ' + error.message); return; }
  renderCaucao();
  renderDashboard();
}

async function desfazerDevolucaoCaucao(aluguelId) {
  if (!confirm('Desfazer devolução do caução?')) return;
  var { error } = await db.from('alugueis').update({ caucao_devolvido: 'nao', caucao_data: null }).eq('id', aluguelId);
  if (error) { alert('Erro: ' + error.message); return; }
  renderCaucao();
  renderDashboard();
}

async function abrirModalMulta() {
  var { data: veiculos } = await db.from('veiculos').select('id, modelo, placa').order('modelo');
  var sel = document.getElementById('multa-veiculo');
  sel.innerHTML = '<option value="">Selecione o veículo...</option>' +
    (veiculos || []).map(function(v) {
      return '<option value="' + v.id + '">' + v.modelo + ' · ' + v.placa + '</option>';
    }).join('');
  document.getElementById('multa-data').value = hojeLocalStr();
  document.getElementById('multa-valor').value = '';
  document.getElementById('multa-descricao').value = '';
  document.getElementById('multa-contrato-result').innerHTML = '';
  openModal('modal-multa');
}

async function buscarContratoMulta() {
  var veiculoId = document.getElementById('multa-veiculo').value;
  var data      = document.getElementById('multa-data').value;
  var resultEl  = document.getElementById('multa-contrato-result');
  if (!veiculoId || !data) { resultEl.innerHTML = ''; return; }

  var { data: contratos } = await db
    .from('alugueis')
    .select('id, cliente, inicio, fim')
    .eq('veiculo_id', veiculoId)
    .lte('inicio', data)
    .neq('status', 'cancelado')
    .order('inicio', { ascending: false });

  var contrato = (contratos || []).find(function(c) { return !c.fim || c.fim >= data; });

  if (contrato) {
    resultEl.innerHTML = '<div style="background:var(--bg);border:1px solid var(--green);border-radius:10px;padding:0.75rem;margin:0.5rem 0">' +
      '<div style="font-size:0.72rem;color:var(--green);font-weight:700">' + IC.check + ' Contrato encontrado</div>' +
      '<div style="font-size:0.9rem;font-weight:700;margin-top:0.2rem">' + contrato.cliente + '</div>' +
      '<div style="font-size:0.75rem;color:var(--text2)">Contrato: ' + fmtDate(contrato.inicio) + ' → ' + (contrato.fim ? fmtDate(contrato.fim) : 'em aberto') + '</div>' +
      '<input type="hidden" id="multa-aluguel-id" value="' + contrato.id + '">' +
      '</div>';
  } else {
    resultEl.innerHTML = '<div style="background:var(--bg);border:1px solid var(--yellow);border-radius:10px;padding:0.75rem;margin:0.5rem 0">' +
      '<div style="font-size:0.78rem;color:var(--yellow)">' + IC.warn + ' Nenhum aluguel ativo nessa data — a moto estava com você.</div>' +
      '<input type="hidden" id="multa-aluguel-id" value="">' +
      '</div>';
  }
}

async function salvarMulta() {
  var veiculoId  = document.getElementById('multa-veiculo').value;
  var data       = document.getElementById('multa-data').value;
  var valor      = parseFloat(document.getElementById('multa-valor').value);
  var descricao  = document.getElementById('multa-descricao').value.trim();
  var aluguelEl  = document.getElementById('multa-aluguel-id');
  var aluguelId  = aluguelEl ? (aluguelEl.value || null) : null;

  if (!veiculoId || !data || !valor) { alert('Preencha veículo, data e valor.'); return; }

  var { error } = await db.from('multas').insert({
    veiculo_id:    veiculoId,
    data_infracao: data,
    valor:         valor,
    descricao:     descricao || null,
    aluguel_id:    aluguelId || null,
    status:        'pendente'
  });
  if (error) { alert('Erro ao salvar: ' + error.message); return; }
  closeModal('modal-multa');
  renderMultas();
}

async function marcarMultaPaga(id) {
  var { data: multa } = await db.from('multas').select('valor, aluguel_id').eq('id', id).single();
  if (!multa) return;

  if (multa.aluguel_id) {
    var { data: aluguel } = await db.from('alugueis').select('caucao').eq('id', multa.aluguel_id).single();
    if (aluguel) {
      var novoCaucao = (Number(aluguel.caucao) || 0) - Number(multa.valor);
      await db.from('alugueis').update({ caucao: novoCaucao }).eq('id', multa.aluguel_id);
    }
  }

  await db.from('multas').update({ status: 'pago' }).eq('id', id);
  renderMultas();
}

async function marcarMultaPendente(id) {
  var { data: multa } = await db.from('multas').select('valor, aluguel_id').eq('id', id).single();
  if (!multa) return;

  if (multa.aluguel_id) {
    var { data: aluguel } = await db.from('alugueis').select('caucao').eq('id', multa.aluguel_id).single();
    if (aluguel) {
      var novoCaucao = (Number(aluguel.caucao) || 0) + Number(multa.valor);
      await db.from('alugueis').update({ caucao: novoCaucao }).eq('id', multa.aluguel_id);
    }
  }

  await db.from('multas').update({ status: 'pendente' }).eq('id', id);
  renderMultas();
}

async function deletarMulta(id) {
  if (!confirm('Excluir esta multa?')) return;
  var { error } = await db.from('multas').delete().eq('id', id);
  if (error) { alert('Erro: ' + error.message); return; }
  renderMultas();
}

// --- INIT ---
