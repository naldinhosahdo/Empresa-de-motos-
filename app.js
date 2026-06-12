// GereMoto — Gestão de Aluguel de Veículos
// Backend: Supabase

const SUPABASE_URL = 'https://ohukqqyktkrvqedhozgk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odWtxcXlrdGtydnFlZGhvemdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODkzMTQsImV4cCI6MjA5NTI2NTMxNH0.yKCkjINcQNcxiIqkfRUA507KlFymzTsInHTa6ObZzTM';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
var _pendingNotifKey = null;

// --- CONFIGURAÇÕES DO LOCADOR ---
var _configCache = { nome: '', cpf: '', endereco: '', cidade: 'Fortaleza/CE' };

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
  document.getElementById('config-cidade').value   = c.cidade   || '';
  openModal('modal-config');
}

async function salvarConfig() {
  var c = {
    id:       1,
    nome:     document.getElementById('config-nome').value.trim(),
    cpf:      document.getElementById('config-cpf').value.trim(),
    endereco: document.getElementById('config-endereco').value.trim(),
    cidade:   document.getElementById('config-cidade').value.trim()
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
  localStorage.setItem('notif_dismissed', JSON.stringify(arr));
}
function dismissNotif(key) {
  var dismissed = getNotifDismissed();
  if (!dismissed.includes(key)) dismissed.push(key);
  setNotifDismissed(dismissed);
  loadNotificacoes();
}
function dismissAllNotif() {
  if (!confirm('Tem certeza que deseja limpar todas as notificações?')) return;
  var items = document.querySelectorAll('#notif-list [data-key]');
  var dismissed = getNotifDismissed();
  items.forEach(function(el) {
    var k = el.getAttribute('data-key');
    if (k && !dismissed.includes(k)) dismissed.push(k);
  });
  setNotifDismissed(dismissed);
  loadNotificacoes();
}

function calcularValorParcela(valorOriginal, vencimento, dataPagamento) {
  var venc = new Date(vencimento + 'T00:00:00');
  var pag  = new Date(dataPagamento + 'T00:00:00');
  var diffDias = Math.round((pag - venc) / 86400000);
  if (diffDias < 0) {
    var desc = valorOriginal * 0.05;
    return { valor: valorOriginal - desc, descricao: 'Desconto 5%: −' + fmtBRL(desc), tipo: 'desconto' };
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
  var em5 = new Date(hoje.getTime() + 5 * 86400000);
  var em5Str = em5.toISOString().split('T')[0];
  var em2Str = new Date(hoje.getTime() + 2 * 86400000).toISOString().split('T')[0];
  var em7Str  = new Date(hoje.getTime() + 7 * 86400000).toISOString().split('T')[0];

  var hoje0Str = hojeLocalStr();
  var [{ data: despesasData }, { data: manutData }, { data: alugData }, { data: parcelasData }, { data: veiculosData }, { data: progsData }] = await Promise.all([
    db.from('despesas').select('*, veiculos(modelo, placa)')
      .lte('vencimento', em30Str).not('vencimento', 'is', null).order('vencimento'),
    db.from('manutencoes').select('*, veiculos(modelo, placa)')
      .lte('prox_data', em7Str).not('prox_data', 'is', null).order('prox_data'),
    db.from('alugueis').select('*, veiculos(modelo, placa)')
      .eq('status', 'ativo').lte('fim', em5Str).not('fim', 'is', null).order('fim'),
    db.from('parcelas').select('*, alugueis(cliente, veiculos(modelo, placa))')
      .eq('pago', false).lte('vencimento', em2Str).order('vencimento'),
    db.from('veiculos').select('id, modelo, placa, km_atual, seguro_rastreador_mensal'),
    db.from('manut_programada').select('*, veiculos(modelo, placa, km_atual)')
  ]);

  var alertasDespesas = (despesasData || []).filter(function(d) { return !d.pago && !d.programada; }).map(function(d) {
    return { key: 'despesa_' + d.id, data: d.vencimento, label: d.tipo, veiculo: d.veiculos, valor: fmtBRL(d.valor), tipo: 'despesa' };
  });
  var alertasManut = (manutData || []).map(function(m) {
    return { key: 'manut_' + m.id, data: m.prox_data, label: 'Manutenção: ' + (m.descricao || 'sem descrição'), veiculo: m.veiculos, valor: m.prox_km ? m.prox_km + ' km' : '', tipo: 'manut' };
  });
  var alertasAlug = (alugData || []).map(function(x) {
    return { key: 'aluguel_' + x.id, data: x.fim, label: 'Contrato vence — ' + (x.cliente || '-'), veiculo: x.veiculos, valor: '', tipo: 'aluguel' };
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
        if (dLic >= hoje0Str && dLic <= em30Str) {
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
            return d.veiculo_id === vei.id && d.programada && d.pago && d.tipo === 'Seguro + Rastreador' && d.vencimento === vencStr;
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
      if (dSegFinal <= em2Str) {
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
    var kmTexto = vencido ? '⚠️ Vencido (' + Math.abs(restante).toLocaleString('pt-BR') + ' km atrás)' : '🔴 Faltam ' + restante.toLocaleString('pt-BR') + ' km';
    alertasRecorrentes.push({
      key: 'prog_' + p.id + '_' + Math.floor(Number(vei.km_atual) / Number(p.intervalo_km)),
      data: hoje0Str,
      label: (p.item || 'Manutenção'),
      veiculo: { modelo: vei.modelo, placa: vei.placa },
      valor: kmTexto,
      tipo: 'recorrente'
    });
  });

  var todosAlertas = alertasDespesas.concat(alertasManut).concat(alertasAlug).concat(alertasParcelas).concat(alertasRecorrentes).sort(function(a, b) {
    return a.data < b.data ? -1 : a.data > b.data ? 1 : 0;
  });

  var dismissed = getNotifDismissed();
  var alertas = todosAlertas.filter(function(a) { return !dismissed.includes(a.key); });

  var badge = document.getElementById('notif-badge');
  var list  = document.getElementById('notif-list');

  if (!alertas.length) {
    badge.style.display = 'none';
    list.innerHTML = '<div class="notif-vazio">✅ Nenhum alerta no momento</div>';
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
    var quando  = diff < 0
      ? '⚠️ Venceu há ' + Math.abs(diff) + ' dia(s)'
      : diff === 0
        ? '🔴 Vence hoje!'
        : urgente
          ? '🔴 Vence em ' + diff + ' dia(s)'
          : '🟡 Vence em ' + diff + ' dia(s)';
    var safeKey = a.key.replace(/'/g, "\\'");
    var safeLabel = (a.label || '').replace(/'/g, "\\'");
    var pagarBtn = a.tipo === 'parcela' && a.parcelaId && a.aluguelId
      ? '<button class="btn btn-sm btn-primary" style="font-size:0.72rem;padding:3px 8px;margin-right:4px" onclick="abrirPagarParcela(\'' + a.parcelaId + '\',\'' + a.aluguelId + '\',' + a.valorNum + ',\'' + a.vencimentoStr + '\',\'' + safeLabel + '\',\'' + safeKey + '\')">Pago</button>'
      : '';
    var _c = "document.getElementById('notif-dropdown').style.display='none';";
    var bodyClick;
    if (a.tipo === 'parcela' && a.aluguelId) {
      bodyClick = 'onclick="' + _c + 'abrirParcelas(\'' + a.aluguelId + '\')" style="cursor:pointer"';
    } else if (a.tipo === 'aluguel') {
      bodyClick = 'onclick="' + _c + 'abrirContratosVencer()" style="cursor:pointer"';
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
        '<button class="notif-dismiss" onclick="dismissNotif(\'' + safeKey + '\')" title="Dispensar">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
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
  history.replaceState({ section: 'dashboard' }, '', '#dashboard');
  await loadConfig();
  renderDashboard();
  loadNotificacoes();
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

  if (addHistory !== false) {
    history.pushState({ section: name }, '', '#' + name);
  }
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
    db.from('parcelas').select('*, alugueis(veiculo_id)').eq('pago', true),
    db.from('parcelas').select('*, alugueis(cliente, veiculos(modelo, placa))').eq('pago', false).order('vencimento'),
    db.from('clientes').select('id')
  ]);

  const v = veiculos || [], a = alugueis || [], m = manutencoes || [], d = despesas || [], pp = parcelasPagas || [], pa = parcelasAbertas || [], cl = clientes || [];

  var hoje = new Date();
  var hojeStr = hojeLocalStr();
  var anoMes = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');

  var aNaoCancelado = a.filter(function(x) { return x.status !== 'cancelado'; });

  // Receita = apenas parcelas efetivamente pagas
  var receitaTotal = pp.reduce(function(s, x) { return s + Number(x.valor_pago || x.valor || 0); }, 0);
  var receitaMes   = pp.filter(function(x) { return x.data_pagamento && x.data_pagamento.startsWith(anoMes); })
                       .reduce(function(s, x) { return s + Number(x.valor_pago || x.valor || 0); }, 0);

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
  document.getElementById('dash-receita-mes-label').textContent = fmtBRL(receitaMes);
  document.getElementById('dash-receita-total').textContent     = fmtBRL(receitaTotal);

  document.getElementById('dash-custos-mes').textContent       = fmtBRL(custosMes);
  document.getElementById('dash-custos-mes-label').textContent = fmtBRL(custosMes);
  document.getElementById('dash-custos').textContent           = fmtBRL(custosTotal);

  var lucroMesEl = document.getElementById('dash-lucro-mes');
  lucroMesEl.textContent = fmtBRL(lucroMes);
  lucroMesEl.style.color = lucroMes >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('dash-lucro-mes-label').textContent = fmtBRL(lucroMes);
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
    if (diffDias > 30) return;
    var vei = v.find(function(vv) { return vv.id === x.veiculo_id; });
    vencimentos.push({ tipo: 'Contrato', descricao: 'Fim do aluguel — ' + (x.cliente || '-'), moto: vei ? veiculoLabel(vei) : '-', dias: diffDias });
  });
  d.forEach(function(x) {
    if (!x.vencimento || x.pago) return;
    var diffDias = Math.round((new Date(x.vencimento) - new Date(hojeStr)) / 86400000);
    if (diffDias > 30) return;
    var vei = v.find(function(vv) { return vv.id === x.veiculo_id; });
    vencimentos.push({ tipo: 'Despesa', descricao: x.descricao || x.tipo || 'Despesa', moto: vei ? veiculoLabel(vei) : '-', dias: diffDias });
  });
  m.forEach(function(x) {
    if (!x.prox_data) return;
    var diffDias = Math.round((new Date(x.prox_data) - new Date(hojeStr)) / 86400000);
    if (diffDias > 30) return;
    var vei = v.find(function(vv) { return vv.id === x.veiculo_id; });
    vencimentos.push({ tipo: 'Manutenção', descricao: x.tipo || 'Manutenção', moto: vei ? veiculoLabel(vei) : '-', dias: diffDias });
  });
  vencimentos.sort(function(a, b) { return a.dias - b.dias; });

  var vencEl = document.getElementById('dash-vencimentos-list');
  if (vencimentos.length === 0) {
    vencEl.innerHTML = '<span style="color:var(--text2);font-size:0.85rem">Nenhum vencimento nos próximos 30 dias</span>';
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

  // Moto mais rentável (baseado em parcelas pagas)
  var motoReceita = {};
  pp.forEach(function(p) {
    var vid = p.alugueis && p.alugueis.veiculo_id;
    if (vid) motoReceita[vid] = (motoReceita[vid] || 0) + Number(p.valor || 0);
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
      var status = atrasada ? '⚠️ Atrasada' : hoje0 ? '🔴 Vence hoje' : '📅 ' + fmtDate(p.vencimento);
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
async function renderClientes() {
  showLoading('clientes-tbody', 6);
  const { data } = await db.from('clientes').select('*').order('nome');
  const c = data || [];
  document.getElementById('clientes-count').textContent = c.length;
  document.getElementById('clientes-tbody').innerHTML = c.length
    ? c.map(function(cl) {
        var cat = cl.cnh_categoria || '';
        var catBadge = cat
          ? (cat.indexOf('A') !== -1
              ? ' <span class="badge badge-green">' + cat + '</span>'
              : ' <span class="badge badge-red" title="Categoria não permite moto">' + cat + ' ⚠️</span>')
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
    : '<tr class="empty-row"><td colspan="6">Nenhum cliente cadastrado</td></tr>';
}

function consultarCPF(tipo) {
  var cpf = document.getElementById('cliente-cpf').value.replace(/\D/g, '');
  if (!cpf) { alert('Preencha o CPF antes de consultar.'); return; }
  navigator.clipboard.writeText(cpf).catch(function() {});
  if (tipo === 'detran') {
    window.open('https://sistemas.detran.ce.gov.br/central', '_blank');
  } else if (tipo === 'receita') {
    window.open('https://servicos.receita.fazenda.gov.br/servicos/cpf/consultasituacao/consultapublica.asp', '_blank');
  } else if (tipo === 'senatran') {
    window.location.href = 'intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=br.gov.serpro.lince;end';
  } else if (tipo === 'serasa') {
    window.open('https://www.serasa.com.br/voceconsulta/', '_blank');
  } else {
    window.open('https://www.gov.br/pf/pt-br/assuntos/antecedentes-criminais', '_blank');
  }
  if (tipo === 'senatran') {
    alert('Abra o app Vio e escaneie o QR Code da CNH do cliente.');
  } else {
    alert('CPF ' + cpf + ' copiado! Cole no campo de busca do site que abriu.');
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

function parseCNHText(rawText) {
  var result = {};
  var text = rawText.replace(/[ \t]+/g, ' ');
  // Versão normalizada para buscas numéricas (O→0, I→1)
  var numT = text.replace(/O/g, '0').replace(/[Il|]/g, '1');
  console.log('[CNH OCR]', text.substring(0, 600));

  // === CPF: procura label "CPF" e pega o número logo depois ===
  var cpfAfter = numT.match(/CPF\s*[:\-]?\s*([\d\s.,\-]{11,20})/i);
  if (cpfAfter) {
    var d = cpfAfter[1].replace(/\D/g, '');
    if (d.length === 11 && !/^(\d)\1{10}$/.test(d))
      result.cpf = d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  // Fallback: padrão XXX.XXX.XXX-XX em qualquer lugar
  if (!result.cpf) {
    var cpfFmt = numT.match(/\b(\d{3})[.\s](\d{3})[.\s](\d{3})[-.\s](\d{2})\b/);
    if (cpfFmt) {
      var d2 = cpfFmt[1]+cpfFmt[2]+cpfFmt[3]+cpfFmt[4];
      if (!/^(\d)\1{10}$/.test(d2))
        result.cpf = cpfFmt[1]+'.'+cpfFmt[2]+'.'+cpfFmt[3]+'-'+cpfFmt[4];
    }
  }
  // Último recurso: 11 dígitos consecutivos
  if (!result.cpf) {
    var m11 = numT.match(/\b(\d{11})\b/g) || [];
    for (var k = 0; k < m11.length; k++) {
      if (!/^(\d)\1{10}$/.test(m11[k])) {
        result.cpf = m11[k].replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        break;
      }
    }
  }
  var cpfDigits = result.cpf ? result.cpf.replace(/\D/g, '') : '';

  // === NÚMERO DE REGISTRO: procura label "REGISTRO" e pega os dígitos depois ===
  var regAfter = numT.match(/REGISTRO\s*[:\-]?\s*(\d[\d\s]{10,13})/i);
  if (regAfter) {
    var r = regAfter[1].replace(/\D/g, '');
    if (r.length >= 9 && r !== cpfDigits) result.cnh = r.substring(0, 11);
  }
  // Fallback: 11 dígitos que não seja o CPF
  if (!result.cnh) {
    var all11 = numT.match(/\b\d{11}\b/g) || [];
    for (var j = 0; j < all11.length; j++) {
      if (all11[j] !== cpfDigits && !/^(\d)\1{10}$/.test(all11[j])) {
        result.cnh = all11[j]; break;
      }
    }
  }

  // === NOME: procura label "NOME" e pega o texto logo depois (até o próximo label ou linha) ===
  var nomeAfter = text.match(/\bNOME\b\s*[:\-]?\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇa-záéíóúâêîôûãõàç ]{3,59}?)(?=\n|\s{2,}|CPF\b|FILIA|DATA\b|NASC|\d{3}|CATEG)/i);
  if (nomeAfter) {
    result.nome = nomeAfter[1].trim();
  } else {
    // Fallback: nome que aparece logo antes do CPF no texto
    var cpfIdx = cpfDigits ? text.indexOf(result.cpf || cpfDigits) : -1;
    var zona = cpfIdx > 10 ? text.substring(0, cpfIdx) : text;
    var nRx = /\b([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ]{2,}(?:\s+(?:DA|DE|DO|DAS|DOS|[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇ]{2,})){1,5})\b/g;
    var nc, best = null;
    while ((nc = nRx.exec(zona)) !== null) {
      if (nc[1].split(/\s+/).length >= 2 && nc[1].length >= 8) best = nc[1].trim();
    }
    var ignoreDoc = /CARTEIRA|NACIONAL|HABILITAC|BRASIL|DETRAN|SENATRAN|REPUBLICA|FEDERATIVA|ESTADO|SECRETARIA|TRANSITO/i;
    if (best && !ignoreDoc.test(best)) result.nome = best;
  }
  // Limpa artefato OCR no início do nome
  if (result.nome)
    result.nome = result.nome.replace(/^([A-Z]{1,3}\s+){1,2}(?=[A-Z]{4,})/, '').trim();

  return result;
}

function parseComprovanteText(text) {
  var endMatch = text.match(/((?:Rua|Av\.|Avenida|Alameda|Travessa|Estrada|Praça|R\.|Al\.|Qd\.|Quadra)[^\n]{10,120})/i);
  return endMatch ? { endereco: endMatch[1].replace(/\s+/g, ' ').trim() } : {};
}

async function renderPDFToImage(file) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return new Promise(function(resolve, reject) {
    var fr = new FileReader();
    fr.onload = async function(e) {
      try {
        var pdf = await pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;
        var page = await pdf.getPage(1);
        var vp = page.getViewport({ scale: 2.5 });
        var canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
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
  status.style.color = '#2196F3';
  try {
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
    console.log('[CNH TEXT]', text.substring(0, 600));
    var data = parseCNHText(text);
    console.log('[CNH PARSED]', data);
    var ok = [], faltando = [];
    if (data.nome) { document.getElementById('cliente-nome').value = data.nome; ok.push('Nome'); } else faltando.push('Nome');
    if (data.cpf)  { document.getElementById('cliente-cpf').value  = data.cpf;  ok.push('CPF'); } else faltando.push('CPF');
    if (data.cnh)  { document.getElementById('cliente-cnh').value  = data.cnh;  ok.push('N° CNH'); } else faltando.push('N° CNH');
    status.style.color = ok.length ? (faltando.length ? 'orange' : 'var(--green)') : 'orange';
    status.textContent = ok.length
      ? '✓ ' + ok.join(', ') + (faltando.length ? ' | Faltou: ' + faltando.join(', ') : '')
      : '⚠ Não foi possível extrair. Preencha manualmente.';
  } catch(err) {
    console.error(err);
    status.style.color = 'var(--red)';
    status.textContent = '✗ Erro: ' + err.message;
  }
}

async function handleComprovanteUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  var status = document.getElementById('comprovante-upload-status');
  status.style.color = '#2196F3';
  try {
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
async function renderVeiculos() {
  showLoading('motos-tbody', 7);
  const { data } = await db.from('veiculos').select('*').order('created_at', { ascending: false });
  const v = data || [];
  document.getElementById('veiculos-count').textContent = v.length;
  document.getElementById('motos-tbody').innerHTML = v.length
    ? v.map(function(vei) {
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
    : '<tr class="empty-row"><td colspan="7">Nenhum veículo cadastrado</td></tr>';
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
  var subHdr  = function(txt) { return '<div style="font-weight:600;font-size:0.82rem;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase;margin:0.75rem 0 0.4rem">' + txt + '</div>'; };
  var progRows = motoProg.map(function(x) {
    var proximaKm = x.ultima_km ? (Number(x.ultima_km) + Number(x.intervalo_km)) : null;
    var restante  = (proximaKm && kmAtual) ? proximaKm - kmAtual : null;
    var situacao;
    if (!x.ultima_km) {
      situacao = '<span class="badge badge-gray">Não configurado</span>';
    } else if (restante !== null && restante <= 0) {
      situacao = '<span class="badge badge-red">⚠️ Vencido</span>';
    } else if (restante !== null && restante <= 100) {
      situacao = '<span class="badge badge-yellow">🔴 Em ' + restante.toLocaleString('pt-BR') + ' km</span>';
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
      '<td>' + fmtDate(x.data) + '</td>' +
      '<td>' + (x.prox_data ? fmtDate(x.prox_data) : (x.prox_km ? x.prox_km + ' km' : '—')) + '</td>' +
      '<td><div class="btn-actions">' +
        '<button class="btn btn-sm btn-secondary" onclick="editManutencao(\'' + x.id + '\')">Editar</button>' +
        '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'manutencao\',\'' + x.id + '\')">Excluir</button>' +
      '</div></td></tr>';
  }).join('') || '<tr class="empty-row"><td colspan="6">Nenhuma avulsa registrada.</td></tr>';
  var totalManut = motoAvul.reduce(function(s, x) { return s + Number(x.custo || 0); }, 0);
  return subHdr('📅 Programadas') +
    '<div class="table-wrap" style="margin-bottom:0.5rem"><table>' +
      '<thead><tr><th>Item</th><th>Intervalo</th><th>Última troca</th><th>KM Atual</th><th>Situação</th><th>Ações</th></tr></thead>' +
      '<tbody>' + progRows + '</tbody></table></div>' +
    subHdr('🔧 Manutenções Avulsas') +
    '<div class="table-wrap"><table>' +
      '<thead><tr><th>Tipo</th><th>Descrição</th><th>Custo</th><th>Data</th><th>Próx.</th><th>Ações</th></tr></thead>' +
      '<tbody>' + avulRows + '</tbody></table></div>' +
    '<div style="text-align:right;padding:0.6rem 0.25rem;font-weight:700;font-size:0.9rem;border-top:1px solid var(--border);margin-top:0.25rem">Total gasto em manutenções: <span style="color:var(--red)">' + fmtBRL(totalManut) + '</span></div>';
}

async function renderManutencoesTab() {
  var container = document.getElementById('manutencoes-motos-list');
  if (!container) return;
  container.innerHTML = '<p style="color:#94a3b8;padding:1rem 0">Carregando...</p>';
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
    container.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:2rem">Nenhuma moto cadastrada.</p>';
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
    if (vencidas) badges += '<span class="badge badge-red" style="margin-left:0.5rem">⚠️ ' + vencidas + ' vencida(s)</span>';
    if (proximas) badges += '<span class="badge badge-yellow" style="margin-left:0.5rem">🔴 ' + proximas + ' próxima(s)</span>';
    if (!vencidas && !proximas && motoProg.length) badges += '<span class="badge badge-green" style="margin-left:0.5rem">✅ Em dia</span>';
    var avulCount = motoAvul.length ? '<span style="margin-left:auto;font-size:0.82rem;color:#94a3b8">' + motoAvul.length + ' avulsa(s)</span>' : '';
    return '<div style="border:1px solid #334155;border-radius:0.5rem;margin-bottom:0.6rem;overflow:hidden">' +
      '<div onclick="toggleManutMoto(\'' + vei.id + '\')" style="display:flex;align-items:center;gap:0.5rem;padding:0.8rem 1rem;cursor:pointer;background:#1e293b;user-select:none">' +
        '<span id="acc-manut-arrow-' + vei.id + '" style="font-size:0.7rem;color:#94a3b8">▶</span>' +
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
              '<button class="btn btn-sm btn-info" onclick="abrirParcelas(\'' + x.id + '\')">💰 Parcelas</button>' +
              '<button class="btn btn-sm btn-info" onclick="gerarContrato(\'' + x.id + '\')">Contrato</button>' +
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
  parcelas.push({ aluguel_id: aluguelId, numero: num, descricao: descP1, valor: valorP1, vencimento: aluguel.inicio, pago: false });
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
      '<span style="font-size:0.85rem">✅ Pago: <strong style="color:var(--green)">' + fmtBRL(totalPago) + '</strong></span>' +
      '<span style="font-size:0.85rem">⏳ Pendente: <strong style="color:var(--red)">' + fmtBRL(totalPendente) + '</strong></span>' +
    '</div>';

  var hoje = hojeLocalStr();
  document.getElementById('modal-parcelas-lista').innerHTML = (parcelas||[]).length
    ? (parcelas||[]).map(function(p) {
        var atrasado = !p.pago && p.vencimento < hoje;
        var cls = p.pago ? 'parcela-paga' : atrasado ? 'parcela-atrasada' : 'parcela-pendente';
        var badge = p.pago
          ? '<span class="badge badge-green">✅ Pago' + (p.data_pagamento ? ' ' + fmtDate(p.data_pagamento) : '') + '</span>'
          : atrasado
            ? '<span class="badge badge-red">⚠️ Atrasado</span>'
            : '<span class="badge badge-yellow">⏳ Pendente</span>';
        var safeDesc = (p.descricao || '').replace(/'/g, "\\'");
        var btn = p.pago
          ? '<button class="btn btn-sm btn-secondary" onclick="toggleParcela(\'' + p.id + '\', false, \'' + aluguelId + '\')">Desfazer</button>'
          : '<button class="btn btn-sm btn-primary" onclick="abrirPagarParcela(\'' + p.id + '\',\'' + aluguelId + '\',' + p.valor + ',\'' + p.vencimento + '\',\'' + safeDesc + '\',\'\')">Marcar pago</button>';
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
  if (diff < 0)  return '<span class="badge badge-red">⚠️ Vencido há ' + Math.abs(diff) + ' dia(s)</span>';
  if (diff === 0) return '<span class="badge badge-red">⚠️ Vence hoje</span>';
  if (diff <= 30) return '<span class="badge badge-yellow">🟡 Em ' + diff + ' dia(s)</span>';
  return '<span class="badge badge-green">✅ Em dia</span>';
}

function _buildDespesaMotoBody(vei, motoDesp) {
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  var p2 = function(n) { return String(n).padStart(2, '0'); };
  var fmtD = function(d) { return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear(); };
  var isoD = function(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  var subHdr = function(txt) { return '<div style="font-weight:600;font-size:0.82rem;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase;margin:0.75rem 0 0.4rem">' + txt + '</div>'; };
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

  return subHdr('📅 Programadas (Recorrentes)') +
    '<div class="table-wrap"><table>' +
      '<thead><tr><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th></th></tr></thead>' +
      '<tbody>' + progRows + '</tbody></table></div>' +
    subHdr('🧾 Despesas Avulsas') +
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
  container.innerHTML = '<p style="color:#94a3b8;padding:1rem 0">Carregando...</p>';
  var [veiculosRes, despesasRes] = await Promise.all([
    db.from('veiculos').select('id, modelo, placa, seguro_rastreador_mensal').order('modelo'),
    db.from('despesas').select('id, tipo, ano, valor, vencimento, obs, veiculo_id, programada, pago').order('created_at', { ascending: false })
  ]);
  var veiculos = veiculosRes.data || [];
  var allDespesas = despesasRes.data || [];
  _despesasCache = { veiculos: veiculos, allDespesas: allDespesas };
  if (!veiculos.length) {
    container.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:2rem">Nenhuma moto cadastrada.</p>';
    return;
  }
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  container.innerHTML = veiculos.map(function(vei) {
    var motoDesp  = allDespesas.filter(function(d) { return d.veiculo_id === vei.id; });
    var progs     = _getProgRecorrentes(vei, hoje, motoDesp);
    var p2h = function(n) { return String(n).padStart(2, '0'); };
    var vencidas = 0, proximas = 0;
    progs.forEach(function(e) {
      var tipoKey = e.tipo.indexOf('IPVA') === 0 ? 'IPVA' : e.tipo.indexOf('Seguro') === 0 ? 'Seguro + Rastreador' : e.tipo;
      var venc = e.data.getFullYear() + '-' + p2h(e.data.getMonth() + 1) + '-' + p2h(e.data.getDate());
      var pago = motoDesp.some(function(d) { return d.programada && d.pago && d.tipo === tipoKey && d.vencimento === venc; });
      if (pago) return;
      if (e.diff < 0) vencidas++; else if (e.diff <= 30) proximas++;
    });
    var motoProgM = motoDesp.filter(function(d) { return d.programada && !d.pago; });
    motoProgM.forEach(function(x) {
      if (!x.vencimento) return;
      var diff = Math.round((new Date(x.vencimento + 'T00:00:00') - hoje) / 86400000);
      if (diff < 0) vencidas++; else if (diff <= 30) proximas++;
    });
    var badges = vencidas ? '<span class="badge badge-red" style="margin-left:0.5rem">⚠️ ' + vencidas + ' vencida(s)</span>' : '';
    badges += proximas ? '<span class="badge badge-yellow" style="margin-left:0.5rem">🟡 ' + proximas + ' próxima(s)</span>' : '';
    if (!vencidas && !proximas) badges += '<span class="badge badge-green" style="margin-left:0.5rem">✅ Em dia</span>';
    return '<div style="border:1px solid #334155;border-radius:0.5rem;margin-bottom:0.6rem;overflow:hidden">' +
      '<div onclick="toggleDespesaMoto(\'' + vei.id + '\')" style="display:flex;align-items:center;gap:0.5rem;padding:0.8rem 1rem;cursor:pointer;background:#1e293b;user-select:none">' +
        '<span id="acc-desp-arrow-' + vei.id + '" style="font-size:0.7rem;color:#94a3b8;transition:transform 0.2s">▶</span>' +
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
    db.from('parcelas').select('*, alugueis(veiculo_id)').eq('pago', true)
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

  // Mapa: veiculo_id → receita de parcelas pagas
  var receitaPorVeiculo = {};
  pp.forEach(function(p) {
    var vid = p.alugueis && p.alugueis.veiculo_id;
    if (vid) receitaPorVeiculo[vid] = (receitaPorVeiculo[vid] || 0) + Number(p.valor || 0);
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
  { cat: '🏍️ Funilaria e Estrutura', items: [
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
    '<button class="pbtn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>' +
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
    '</table>' +

    '<div class="sec">3. Do Prazo e Valor</div>' +
    '<table>' +
      '<tr><td class="lb">Início da Locação</td><td>' + fmtD(a.inicio) + '</td></tr>' +
      '<tr><td class="lb">Fim da Locação</td><td>' + (a.fim ? fmtD(a.fim) : 'A combinar') + '</td></tr>' +
      '<tr><td class="lb">Modalidade</td><td>' + (periodoTexto[a.periodo]||a.periodo||'-') + '</td></tr>' +
      '<tr><td class="lb">Valor por período</td><td>' + fmtValor(a.valor) + '</td></tr>' +
      '<tr><td class="lb">Valor Total</td><td>' + fmtValor(a.total) + '</td></tr>' +
      '<tr><td class="lb">Caução</td><td>' + (a.caucao ? fmtValor(a.caucao) : 'Não aplicável') + '</td></tr>' +
    '</table>' +

    '<div class="sec">4. Do Pagamento</div>' +
    '<div class="cl"><strong>4.1</strong> Pagando antes do vencimento, o Locatário tem <strong>5% de desconto</strong> no valor da parcela.</div>' +
    '<div class="cl"><strong>4.2</strong> Pagando no dia do vencimento, o valor é o cheio, sem desconto nem acréscimo.</div>' +
    '<div class="cl"><strong>4.3</strong> O atraso gera <strong>multa de 2%</strong> sobre o valor da parcela (cobrada uma única vez no primeiro dia) mais <strong>juros de 1% ao mês</strong> (0,033% ao dia) enquanto o débito permanecer em aberto. Exemplo: parcela de ' + fmtValor(a.valor) + ' atrasada 7 dias = ' + fmtValor(a.valor) + ' + multa ' + fmtValor((a.valor||0)*0.02) + ' + juros ' + fmtValor((a.valor||0)*(0.01/30)*7) + ' = ' + fmtValor((a.valor||0) + (a.valor||0)*0.02 + (a.valor||0)*(0.01/30)*7) + '.</div>' +
    '<div class="cl"><strong>4.4</strong> Em caso de atraso, o Locador poderá <strong>bloquear a moto pelo rastreador a qualquer momento, sem aviso prévio</strong>. O bloqueio só será retirado após o pagamento total do débito com a multa.</div>' +

    '<div class="sec">5. O que o Locatário deve fazer</div>' +
    '<div class="cl"><strong>5.1</strong> Devolver a moto nas mesmas condições em que recebeu, salvo desgaste normal de uso.</div>' +
    '<div class="cl"><strong>5.2</strong> Usar capacete e todos os equipamentos de segurança exigidos pelo Código de Trânsito.</div>' +
    '<div class="cl"><strong>5.3</strong> Não emprestar, ceder nem sublocar a moto para outra pessoa sem autorização escrita do Locador.</div>' +
    '<div class="cl"><strong>5.4</strong> Manter o tanque abastecido e verificar regularmente o nível de óleo do motor, comunicando ao Locador caso esteja abaixo do normal. A adição e a troca de óleo são de responsabilidade exclusiva do Locador.</div>' +
    '<div class="cl"><strong>5.5</strong> Todas as multas de trânsito cometidas durante a locação são de responsabilidade do Locatário.</div>' +
    '<div class="cl"><strong>5.6</strong> É proibido usar a moto para atividades ilegais, carregar cargas não permitidas ou participar de rachas e competições.</div>' +
    '<div class="cl"><strong>5.7</strong> Em caso de acidente, roubo, furto ou qualquer ocorrência policial, avisar o Locador imediatamente.</div>' +
    '<div class="cl"><strong>5.8</strong> O Locatário tem até <strong>24 horas</strong> após a assinatura deste contrato para aceitar, no aplicativo <strong>Carteira Digital de Trânsito (CDT)</strong>, a transferência do veículo para seu nome como condutor principal. Caso não cumpra esse prazo, o Locador poderá cancelar a locação.</div>' +
    '<div class="cl"><strong>5.9</strong> O Locatário não pode circular com o veículo a mais de <strong>100 km</strong> de distância do local de retirada (Fortaleza-CE). O descumprimento desse limite autoriza o Locador a recolher a moto imediatamente, sem devolução do caução.</div>' +

    '<div class="sec">6. Danos à Moto</div>' +
    '<div class="cl"><strong>6.1</strong> O Locatário é responsável por qualquer dano causado à moto durante a locação, como batidas, tombamentos ou vandalismo. Danos por desgaste normal não são cobrados.</div>' +
    '<div class="cl"><strong>6.2</strong> Em caso de acidente por culpa do Locatário, ele é responsável pelos danos à moto. Se o valor do dano for menor que R$ 1.000,00, paga o valor exato do dano. Se for maior, aciona-se o seguro e o Locatário paga a franquia de R$ 1.000,00, descontado do caução. Se o caução não for suficiente, o Locatário deverá pagar a diferença. Se a culpa for de terceiro e este possuir seguro, o Locador acionará o seguro do terceiro, sem custo para o Locatário. Se o terceiro não possuir seguro, o Locador acionará o próprio seguro e a franquia de R$ 1.000,00 será cobrada do terceiro responsável.</div>' +
    '<div class="cl"><strong>6.3</strong> A caução pode ser usada para cobrir danos, multas ou valores em aberto no final do contrato.</div>' +
    '<div class="cl"><strong>6.4</strong> O caução será devolvido somente após <strong>30 dias</strong> do término do contrato, prazo necessário para verificação de multas de trânsito pendentes, danos e débitos. Conforme o art. 281, §1º, II do CTB, o órgão autuador tem até 30 dias para expedir notificações de infração. Identificada qualquer pendência, o valor correspondente será descontado do caução antes da devolução.</div>' +

    '<div class="sec">7. Cancelamento e Encerramento</div>' +
    '<div class="cl"><strong>7.1</strong> O contrato é firmado pelo prazo determinado na cláusula 1.1. O Locatário <strong>não pode cancelar antecipadamente</strong>, sendo responsável pelo pagamento de todos os dias contratados, independentemente da devolução da moto antes do prazo.</div>' +
    '<div class="cl"><strong>7.2</strong> Devolver a moto após o prazo combinado gera cobrança proporcional pelos dias extras.</div>' +
    '<div class="cl"><strong>7.3</strong> Se qualquer regra deste contrato for descumprida, o Locador poderá recolher a moto imediatamente.</div>' +

    '<div class="sec">8. Em caso de conflito</div>' +
    '<div class="cl"><strong>8.1</strong> Qualquer problema que não seja resolvido entre as partes será tratado no foro da Comarca de Fortaleza/CE.</div>' +

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

// --- INIT ---
