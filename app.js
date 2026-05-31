// GereMoto — Gestão de Aluguel de Veículos
// Backend: Supabase

const SUPABASE_URL = 'https://ohukqqyktkrvqedhozgk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odWtxcXlrdGtydnFlZGhvemdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODkzMTQsImV4cCI6MjA5NTI2NTMxNH0.yKCkjINcQNcxiIqkfRUA507KlFymzTsInHTa6ObZzTM';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
var _pendingNotifKey = null;

// --- CONFIGURAÇÕES DO LOCADOR ---
var CONFIG_KEY = 'geremoto_config';
function getConfig() {
  try {
    var c = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return {
      nome:     c.nome     || 'Arisnaldo Sahdo Freire',
      cpf:      c.cpf      || '071.235.863-36',
      endereco: c.endereco || 'Rua Alameda das Borboletas, nº 69, Fortaleza - CE',
      cidade:   c.cidade   || 'Fortaleza/CE'
    };
  } catch(e) {
    return { nome: 'Arisnaldo Sahdo Freire', cpf: '071.235.863-36', endereco: 'Rua Alameda das Borboletas, nº 69, Fortaleza - CE', cidade: 'Fortaleza/CE' };
  }
}
function abrirConfig() {
  var c = getConfig();
  document.getElementById('config-nome').value     = c.nome;
  document.getElementById('config-cpf').value      = c.cpf;
  document.getElementById('config-endereco').value = c.endereco;
  document.getElementById('config-cidade').value   = c.cidade;
  openModal('modal-config');
}
function salvarConfig() {
  var c = {
    nome:     document.getElementById('config-nome').value.trim(),
    cpf:      document.getElementById('config-cpf').value.trim(),
    endereco: document.getElementById('config-endereco').value.trim(),
    cidade:   document.getElementById('config-cidade').value.trim()
  };
  if (!c.nome || !c.cpf) { alert('Nome e CPF são obrigatórios.'); return; }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
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
    var multa = valorOriginal * 0.05 * diffDias;
    return { valor: valorOriginal + multa, descricao: 'Multa: ' + diffDias + ' dia(s) × 5% = +' + fmtBRL(multa), tipo: 'multa' };
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

  var hoje0Str = hojeLocalStr();
  var [{ data: despesasData }, { data: manutData }, { data: alugData }, { data: parcelasData }, { data: veiculosData }, { data: progsData }] = await Promise.all([
    db.from('despesas').select('*, veiculos(modelo, placa)')
      .lte('vencimento', em30Str).not('vencimento', 'is', null).order('vencimento'),
    db.from('manutencoes').select('*, veiculos(modelo, placa)')
      .lte('prox_data', em30Str).not('prox_data', 'is', null).order('prox_data'),
    db.from('alugueis').select('*, veiculos(modelo, placa)')
      .eq('status', 'ativo').lte('fim', em5Str).not('fim', 'is', null).order('fim'),
    db.from('parcelas').select('*, alugueis(cliente, veiculos(modelo, placa))')
      .eq('pago', false).lte('vencimento', em2Str).order('vencimento'),
    db.from('veiculos').select('id, modelo, placa, km_atual, seguro_rastreador_mensal'),
    db.from('manut_programada').select('*, veiculos(modelo, placa, km_atual)')
  ]);

  var alertasDespesas = (despesasData || []).map(function(d) {
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
  var em7Str   = new Date(hoje.getTime() + 7 * 86400000).toISOString().split('T')[0];
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
    // Seguro + Rastreador — mensal, dia 10, avisa com 7 dias
    if (vei.seguro_rastreador_mensal) {
      var dSeg = new Date(hoje.getFullYear(), hoje.getMonth(), 10);
      if (dSeg < hoje) dSeg = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 10);
      var dSegStr = dSeg.getFullYear() + '-' + p2(dSeg.getMonth() + 1) + '-10';
      if (dSegStr >= hoje0Str && dSegStr <= em7Str) {
        alertasRecorrentes.push({ key: 'seguro_' + vei.id + '_' + dSegStr, data: dSegStr,
          label: 'Seguro + Rastreador',
          veiculo: vl, valor: fmtBRL(vei.seguro_rastreador_mensal), tipo: 'recorrente', veiculoId: vei.id, tipoLabel: 'Seguro' });
      }
    }
  });

  // Manutenção programada — alerta quando km_atual >= proxima_km - 500
  (progsData || []).forEach(function(p) {
    var vei = p.veiculos;
    if (!p.ultima_km || !vei || !vei.km_atual) return;
    var proximaKm = Number(p.ultima_km) + Number(p.intervalo_km);
    var restante = proximaKm - Number(vei.km_atual);
    if (restante > 500) return;
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
      bodyClick = 'onclick="' + _c + 'showSection(\'custos-geral\');showCustosTab(\'avulsa\')" style="cursor:pointer"';
    } else if (a.tipo === 'despesa') {
      bodyClick = 'onclick="' + _c + 'showSection(\'custos-geral\');showCustosTab(\'despesas\')" style="cursor:pointer"';
    } else if (a.tipo === 'recorrente' && a.key.indexOf('prog_') === 0) {
      bodyClick = 'onclick="' + _c + 'showSection(\'custos-geral\');showCustosTab(\'programada\')" style="cursor:pointer"';
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
function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-wrapper').style.display = 'block';
  history.replaceState({ section: 'dashboard' }, '', '#dashboard');
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
function showSection(name, addHistory) {
  document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(a) { a.classList.remove('active'); });
  document.getElementById(name).classList.add('active');
  var link = document.querySelector('[data-section="' + name + '"]');
  if (link) link.classList.add('active');
  document.getElementById('navLinks').classList.remove('open');

  if (name === 'dashboard')  renderDashboard();
  if (name === 'clientes')   renderClientes();
  if (name === 'motos')      renderVeiculos();
  if (name === 'alugueis')   { populateClienteSelect(); populateVeiculoSelects(); renderAlugueis(); }
  if (name === 'custos-geral') { showCustosTab('avulsa'); }
  if (name === 'relatorios') renderRelatorios();
  if (name === 'checklist')  buildChecklist();

  if (addHistory !== false) {
    history.pushState({ section: name }, '', '#' + name);
  }
}

function abrirContratosVencer() {
  populateClienteSelect();
  populateVeiculoSelects();
  document.getElementById('filtro-status-aluguel').value = 'ativo';
  showSection('alugueis');
  renderAlugueis(true);
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
    showSection(a.dataset.section);
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
  const [{ data: veiculos }, { data: alugueis }, { data: manutencoes }, { data: despesas }, { data: parcelasPagas }, { data: parcelasAbertas }] = await Promise.all([
    db.from('veiculos').select('*'),
    db.from('alugueis').select('*'),
    db.from('manutencoes').select('*'),
    db.from('despesas').select('*'),
    db.from('parcelas').select('*, alugueis(veiculo_id)').eq('pago', true),
    db.from('parcelas').select('*, alugueis(cliente, veiculos(modelo, placa))').eq('pago', false).order('vencimento')
  ]);

  const v = veiculos || [], a = alugueis || [], m = manutencoes || [], d = despesas || [], pp = parcelasPagas || [], pa = parcelasAbertas || [];

  var hoje = new Date();
  var hojeStr = hojeLocalStr();
  var anoMes = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');

  var aNaoCancelado = a.filter(function(x) { return x.status !== 'cancelado'; });

  // Receita = apenas parcelas efetivamente pagas
  var receitaTotal = pp.reduce(function(s, x) { return s + Number(x.valor_pago || x.valor || 0); }, 0);
  var receitaMes   = pp.filter(function(x) { return x.data_pagamento && x.data_pagamento.startsWith(anoMes); })
                       .reduce(function(s, x) { return s + Number(x.valor_pago || x.valor || 0); }, 0);

  var custosTotal = m.reduce(function(s, x) { return s + Number(x.custo || 0); }, 0)
                  + d.reduce(function(s, x) { return s + Number(x.valor || 0); }, 0);
  var custosMes   = m.filter(function(x) { return x.data && x.data.startsWith(anoMes); })
                    .reduce(function(s, x) { return s + Number(x.custo || 0); }, 0)
                  + d.filter(function(x) { return x.vencimento && x.vencimento.startsWith(anoMes); })
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

  var caucaoPendente = aNaoCancelado
    .filter(function(x) { return x.caucao_devolvido !== 'sim'; })
    .reduce(function(s, x) { return s + Number(x.caucao || 0); }, 0);
  document.getElementById('dash-caucao').textContent = fmtBRL(caucaoPendente);

  var ocupacao = v.length > 0 ? Math.round((motosAlugadas / v.length) * 100) : 0;
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
    if (!x.vencimento) return;
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
  if (tipo === 'tjce') {
    window.open('https://esaj.tjce.jus.br/cpopg/open.do', '_blank');
  } else {
    window.open('https://www.gov.br/pf/pt-br/assuntos/antecedentes-criminais', '_blank');
  }
  alert('CPF ' + cpf + ' copiado! Cole no campo de busca do site que abriu.');
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
  ['aluguel-moto', 'manut-moto', 'despesa-moto', 'prog-moto'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = v.length ? opts : noOpt;
  });
  var filterOpts = '<option value="">Todos</option>' + opts;
  ['filtro-moto-aluguel', 'filtro-moto-manut', 'filtro-moto-despesa'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = filterOpts;
  });
  var elProg = document.getElementById('filtro-moto-prog');
  if (elProg) elProg.innerHTML = opts;
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
  document.getElementById('btn-nova-avulsa').style.display  = tab === 'avulsa'      ? '' : 'none';
  document.getElementById('btn-nova-prog').style.display    = tab === 'programada'  ? '' : 'none';
  document.getElementById('btn-nova-despesa').style.display = tab === 'despesas'    ? '' : 'none';
  if (tab === 'avulsa')     renderManutencoes();
  if (tab === 'programada') { populateVeiculoSelects(); renderManutProgramada(); }
  if (tab === 'despesas')   renderDespesas();
}

// --- MANUTENÇÃO PROGRAMADA ---
async function renderManutProgramada() {
  var tbody = document.getElementById('programada-tbody');
  if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Carregando...</td></tr>';
  var fmId = document.getElementById('filtro-moto-prog') ? document.getElementById('filtro-moto-prog').value : '';
  var query = db.from('manut_programada').select('*, veiculos(modelo, placa, km_atual)').order('created_at');
  if (fmId) query = query.eq('veiculo_id', fmId);
  var { data: progs } = await query;
  var p = progs || [];
  if (!tbody) return;
  if (!p.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Nenhuma manutenção programada para esta moto. Clique em "+ Programada" para adicionar.</td></tr>';
    return;
  }
  tbody.innerHTML = p.map(function(x) {
    var vei = x.veiculos;
    var kmAtual = vei ? (Number(vei.km_atual) || 0) : 0;
    var proximaKm = x.ultima_km ? (Number(x.ultima_km) + Number(x.intervalo_km)) : null;
    var restante  = (proximaKm && kmAtual) ? proximaKm - kmAtual : null;
    var situacao;
    if (!x.ultima_km) {
      situacao = '<span class="badge badge-gray">Não configurado</span>';
    } else if (restante !== null && restante <= 0) {
      situacao = '<span class="badge badge-red">⚠️ Vencido</span>';
    } else if (restante !== null && restante <= 500) {
      situacao = '<span class="badge badge-yellow">🔴 Em ' + restante.toLocaleString('pt-BR') + ' km</span>';
    } else if (restante !== null) {
      situacao = '<span class="badge badge-green">Em ' + restante.toLocaleString('pt-BR') + ' km</span>';
    } else {
      situacao = '<span class="badge badge-gray">—</span>';
    }
    var safeItem = (x.item || '').replace(/'/g, "\\'");
    return '<tr>' +
      '<td><strong>' + (x.item || '-') + '</strong></td>' +
      '<td>A cada ' + Number(x.intervalo_km).toLocaleString('pt-BR') + ' km</td>' +
      '<td>' + (x.ultima_km ? Number(x.ultima_km).toLocaleString('pt-BR') + ' km' : '—') + '</td>' +
      '<td>' + (kmAtual ? kmAtual.toLocaleString('pt-BR') + ' km' : '—') + '</td>' +
      '<td>' + situacao + '</td>' +
      '<td><div class="btn-actions">' +
        '<button class="btn btn-sm btn-primary" onclick="abrirRegistrarTroca(\'' + x.id + '\',\'' + x.veiculo_id + '\',\'' + safeItem + '\')">✓ Registrar</button>' +
        '<button class="btn btn-sm btn-secondary" onclick="editManutProg(\'' + x.id + '\')">Editar</button>' +
        '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'manut_prog\',\'' + x.id + '\')">Excluir</button>' +
      '</div></td></tr>';
  }).join('');
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
    : '<div style="text-align:right;margin-bottom:0.5rem"><button class="btn btn-sm btn-secondary" onclick="regerarParcelas(\'' + aluguelId + '\')" style="font-size:0.72rem;padding:2px 8px">↺ Regenerar</button></div>';

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
          '<div>' +
            '<div style="font-weight:600;font-size:0.9rem">' + p.descricao + '</div>' +
            '<div style="font-size:0.78rem;color:var(--text2)">Vence: ' + fmtDate(p.vencimento) + ' · ' + valorExibido + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem">' + badge + btn + '</div>' +
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
async function renderManutencoes() {
  showLoading('manutencoes-tbody', 7);
  var fmId = document.getElementById('filtro-moto-manut') ? document.getElementById('filtro-moto-manut').value : '';
  var query = db.from('manutencoes').select('*, veiculos(modelo, placa)').order('created_at', { ascending: false });
  if (fmId) query = query.eq('veiculo_id', fmId);
  const { data } = await query;
  const m = data || [];
  document.getElementById('manutencoes-tbody').innerHTML = m.length
    ? m.map(function(x) {
        var vei = x.veiculos;
        return '<tr>' +
          '<td>' + (vei ? veiculoLabel(vei) : '-') + '</td>' +
          '<td>' + x.tipo + '</td>' +
          '<td>' + (x.descricao || '-') + '</td>' +
          '<td><span class="text-red">' + fmtBRL(x.custo) + '</span></td>' +
          '<td>' + fmtDate(x.data) + '</td>' +
          '<td>' + (x.prox_data ? fmtDate(x.prox_data) : (x.prox_km ? x.prox_km + ' km' : '-')) + '</td>' +
          '<td>' +
            '<div class="btn-actions">' +
              '<button class="btn btn-sm btn-secondary" onclick="editManutencao(\'' + x.id + '\')">Editar</button>' +
              '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'manutencao\',\'' + x.id + '\')">Excluir</button>' +
            '</div>' +
          '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="7">Nenhuma manutenção encontrada</td></tr>';
}

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
  if (document.getElementById('custos-geral').classList.contains('active')) renderManutencoes();
}

// --- DESPESAS ---
async function renderDespesas() {
  showLoading('despesas-tbody', 7);
  var fmId = document.getElementById('filtro-moto-despesa') ? document.getElementById('filtro-moto-despesa').value : '';
  var query = db.from('despesas').select('*, veiculos(modelo, placa)').order('created_at', { ascending: false });
  if (fmId) query = query.eq('veiculo_id', fmId);
  const { data } = await query;
  const d = data || [];
  document.getElementById('despesas-tbody').innerHTML = d.length
    ? d.map(function(x) {
        var vei = x.veiculos;
        return '<tr>' +
          '<td>' + (vei ? veiculoLabel(vei) : '-') + '</td>' +
          '<td>' + x.tipo + '</td>' +
          '<td>' + (x.ano || '-') + '</td>' +
          '<td><span class="text-red">' + fmtBRL(x.valor) + '</span></td>' +
          '<td>' + fmtDate(x.vencimento) + '</td>' +
          '<td>' + (x.obs || '-') + '</td>' +
          '<td>' +
            '<div class="btn-actions">' +
              '<button class="btn btn-sm btn-secondary" onclick="editDespesa(\'' + x.id + '\')">Editar</button>' +
              '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'despesa\',\'' + x.id + '\')">Excluir</button>' +
            '</div>' +
          '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="7">Nenhuma despesa encontrada</td></tr>';
}

async function abrirDespesaNotif(veiculoId, tipo, vencimento, notifKey) {
  _pendingNotifKey = notifKey || null;
  document.getElementById('notif-dropdown').style.display = 'none';
  showSection('custos-geral');
  showCustosTab('despesas');
  document.getElementById('form-despesa').reset();
  document.getElementById('despesa-id').value = '';
  document.getElementById('modal-despesa-title').textContent = 'Nova Despesa Fixa';
  document.getElementById('despesa-tipo').value = tipo;
  document.getElementById('despesa-ano').value = new Date().getFullYear();
  document.getElementById('despesa-vencimento').value = vencimento;
  openModal('modal-despesa');
  await populateVeiculoSelects();
  document.getElementById('despesa-moto').value = veiculoId;
}

function openNewDespesa() {
  document.getElementById('form-despesa').reset();
  document.getElementById('despesa-id').value = '';
  document.getElementById('modal-despesa-title').textContent = 'Nova Despesa Fixa';
  populateVeiculoSelects();
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
  document.getElementById('modal-despesa-title').textContent = 'Editar Despesa Fixa';
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
    obs:         document.getElementById('despesa-obs').value.trim()
  };
  var result;
  if (id) {
    result = await db.from('despesas').update(d).eq('id', id);
  } else {
    result = await db.from('despesas').insert(d).select('id').single();
  }
  if (result.error) { alert('Erro ao salvar: ' + result.error.message); return; }
  closeModal('modal-despesa');
  if (_pendingNotifKey) {
    dismissNotif(_pendingNotifKey);
    if (!id && result.data && result.data.id) dismissNotif('despesa_' + result.data.id);
    _pendingNotifKey = null;
  }
  if (document.getElementById('custos-geral').classList.contains('active')) renderDespesas();
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
                + d.filter(function(x) { return x.veiculo_id === vei.id; })
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
    '<div class="sub">Instrumento Particular de Locação celebrado entre as partes abaixo qualificadas.</div>' +
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
    '<div class="cl"><strong>4.1</strong> O pagamento efetuado antes da data de vencimento garantirá ao Locatário desconto de <strong>5% (cinco por cento)</strong> sobre o valor da parcela.</div>' +
    '<div class="cl"><strong>4.2</strong> O pagamento realizado na data do vencimento será pelo valor integral acordado, sem acréscimos ou descontos.</div>' +
    '<div class="cl"><strong>4.3</strong> O atraso no pagamento implicará multa moratória de <strong>5% (cinco por cento) do valor da parcela por dia de atraso</strong>, calculada de forma simples (não composta), incidindo a partir do primeiro dia após o vencimento. Exemplo: parcela de ' + fmtValor(a.valor) + ' atrasada 3 dias = ' + fmtValor(a.valor) + ' + ' + fmtValor((a.valor||0) * 0.05 * 3) + ' = ' + fmtValor((a.valor||0) * 1.15) + '.</div>' +
    '<div class="cl"><strong>4.4</strong> O atraso no pagamento autoriza o Locador a acionar o <strong>bloqueio remoto do veículo</strong> via dispositivo rastreador, independentemente de notificação prévia, permanecendo o veículo bloqueado até a quitação integral do débito acrescido das multas moratórias devidas.</div>' +

    '<div class="sec">5. Das Obrigações do Locatário</div>' +
    '<div class="cl"><strong>5.1</strong> O Locatário se compromete a devolver o veículo nas mesmas condições em que o recebeu, salvo desgaste natural de uso.</div>' +
    '<div class="cl"><strong>5.2</strong> É obrigatório o uso de capacete e demais equipamentos de segurança previstos no Código de Trânsito Brasileiro.</div>' +
    '<div class="cl"><strong>5.3</strong> É vedado ao Locatário sublocar, ceder ou emprestar o veículo a terceiros sem autorização prévia e por escrito do Locador.</div>' +
    '<div class="cl"><strong>5.4</strong> O Locatário é responsável pelo abastecimento de combustível e por manter o nível de óleo do motor dentro da faixa adequada durante todo o período de locação, adquirindo e adicionando óleo sempre que necessário. A troca periódica de óleo, por quilometragem ou tempo, é de responsabilidade exclusiva do Locador.</div>' +
    '<div class="cl"><strong>5.5</strong> Todas as multas de trânsito, infrações e penalidades ocorridas durante o período de locação são de inteira responsabilidade do Locatário.</div>' +
    '<div class="cl"><strong>5.6</strong> Fica proibida a utilização do veículo para atividades ilícitas, transporte de cargas não autorizadas ou participação em competições de qualquer natureza.</div>' +
    '<div class="cl"><strong>5.7</strong> O Locatário se obriga a comunicar imediatamente o Locador em caso de acidente, roubo, furto ou qualquer ocorrência policial envolvendo o veículo.</div>' +

    '<div class="sec">6. Da Responsabilidade por Danos</div>' +
    '<div class="cl"><strong>6.1</strong> O Locatário responde por todos os danos causados ao veículo durante o período de locação, sejam por colisão, tombamento, vandalismo ou qualquer outro sinistro, exceto os decorrentes de desgaste natural.</div>' +
    '<div class="cl"><strong>6.2</strong> O valor da caução poderá ser retido total ou parcialmente para cobrir danos, multas ou débitos pendentes ao final do contrato.</div>' +

    '<div class="sec">7. Da Rescisão</div>' +
    '<div class="cl"><strong>7.1</strong> O presente contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 24 (vinte e quatro) horas.</div>' +
    '<div class="cl"><strong>7.2</strong> A devolução do veículo fora do prazo acordado implicará cobrança proporcional pelo período excedente, conforme a modalidade contratada.</div>' +
    '<div class="cl"><strong>7.3</strong> O descumprimento de qualquer cláusula deste contrato autoriza o Locador a reaver o veículo imediatamente, independentemente de notificação judicial.</div>' +

    '<div class="sec">8. Do Foro</div>' +
    '<div class="cl"><strong>8.1</strong> As partes elegem o foro da Comarca de Fortaleza, Estado do Ceará, para dirimir quaisquer controvérsias oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.</div>' +

    '<div class="cl" style="margin-top:16px;text-align:justify">E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma.</div>' +
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
