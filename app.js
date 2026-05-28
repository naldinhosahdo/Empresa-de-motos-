// GereMoto — Gestão de Aluguel de Veículos
// Backend: Supabase

const SUPABASE_URL = 'https://ohukqqyktkrvqedhozgk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odWtxcXlrdGtydnFlZGhvemdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODkzMTQsImV4cCI6MjA5NTI2NTMxNH0.yKCkjINcQNcxiIqkfRUA507KlFymzTsInHTa6ObZzTM';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- FORMATTERS ---
function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
async function loadNotificacoes() {
  var hoje = new Date();
  hoje.setHours(0,0,0,0);
  var em30 = new Date(hoje.getTime() + 30 * 86400000);
  var em30Str = em30.toISOString().split('T')[0];

  var [{ data: despesasData }, { data: manutData }] = await Promise.all([
    db.from('despesas').select('*, veiculos(modelo, placa)')
      .lte('vencimento', em30Str).not('vencimento', 'is', null).order('vencimento'),
    db.from('manutencoes').select('*, veiculos(modelo, placa)')
      .lte('prox_data', em30Str).not('prox_data', 'is', null).order('prox_data')
  ]);

  var alertasDespesas = (despesasData || []).map(function(d) {
    return { data: d.vencimento, label: d.tipo, veiculo: d.veiculos, valor: fmtBRL(d.valor), tipo: 'despesa' };
  });
  var alertasManut = (manutData || []).map(function(m) {
    return { data: m.prox_data, label: 'Manutenção: ' + (m.descricao || 'sem descrição'), veiculo: m.veiculos, valor: m.prox_km ? m.prox_km + ' km' : '', tipo: 'manut' };
  });

  var alertas = alertasDespesas.concat(alertasManut).sort(function(a, b) {
    return a.data < b.data ? -1 : a.data > b.data ? 1 : 0;
  });

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
    return '<div class="notif-item ' + cls + '">' +
      '<div class="notif-item-titulo">' + a.label + ' — ' + vei + '</div>' +
      '<div class="notif-item-desc">' + quando + (a.valor ? ' · ' + a.valor : '') + '</div>' +
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
  var btn = document.getElementById('login-btn');
  btn.textContent = 'Entrando...';
  btn.disabled = true;
  var email = document.getElementById('login-email').value.trim();
  var pass  = document.getElementById('login-pass').value;
  var { error } = await db.auth.signInWithPassword({ email: email, password: pass });
  if (error) {
    document.getElementById('login-erro').style.display = 'block';
    btn.textContent = 'Entrar';
    btn.disabled = false;
  } else {
    showApp();
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
  if (name === 'moto-detalhe') { /* handled by openMotoDetalhe */ }
  if (name === 'relatorios') renderRelatorios();
  if (name === 'checklist')  buildChecklist();

  if (addHistory !== false) {
    history.pushState({ section: name }, '', '#' + name);
  }
}

window.addEventListener('popstate', function(e) {
  var section = (e.state && e.state.section) || 'dashboard';
  showSection(section, false);
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
  const [{ data: veiculos }, { data: alugueis }, { data: manutencoes }, { data: despesas }] = await Promise.all([
    db.from('veiculos').select('*'),
    db.from('alugueis').select('*'),
    db.from('manutencoes').select('*'),
    db.from('despesas').select('*')
  ]);

  const v = veiculos || [], a = alugueis || [], m = manutencoes || [], d = despesas || [];

  var hoje = new Date();
  var hojeStr = hoje.toISOString().split('T')[0];
  var anoMes = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');

  var aNaoCancelado = a.filter(function(x) { return x.status !== 'cancelado'; });

  // Financial metrics
  var receitaTotal = aNaoCancelado.reduce(function(s, x) { return s + Number(x.total || 0); }, 0);
  var receitaMes   = aNaoCancelado.filter(function(x) { return x.inicio && x.inicio.startsWith(anoMes); })
                                  .reduce(function(s, x) { return s + Number(x.total || 0); }, 0);

  var custosTotal = m.reduce(function(s, x) { return s + Number(x.custo || 0); }, 0)
                  + d.reduce(function(s, x) { return s + Number(x.valor || 0); }, 0);
  var custosMes   = m.filter(function(x) { return x.data && x.data.startsWith(anoMes); })
                    .reduce(function(s, x) { return s + Number(x.custo || 0); }, 0)
                  + d.filter(function(x) { return x.vencimento && x.vencimento.startsWith(anoMes); })
                    .reduce(function(s, x) { return s + Number(x.valor || 0); }, 0);

  var lucroTotal = receitaTotal - custosTotal;
  var lucroMes   = receitaMes - custosMes;

  document.getElementById('dash-total-motos').textContent = v.length;

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

  // Operational metrics
  var motosDisponiveis = v.filter(function(x) { return x.status === 'disponivel'; }).length;
  document.getElementById('dash-disponiveis').textContent = motosDisponiveis + ' / ' + v.length;

  var alugueisAtivos = a.filter(function(x) { return x.status === 'ativo'; }).length;
  document.getElementById('dash-ativos').textContent = alugueisAtivos;

  var caucaoPendente = aNaoCancelado
    .filter(function(x) { return x.caucao_devolvido !== 'sim'; })
    .reduce(function(s, x) { return s + Number(x.caucao || 0); }, 0);
  document.getElementById('dash-caucao').textContent = fmtBRL(caucaoPendente);

  var ocupacao = v.length > 0 ? Math.round((alugueisAtivos / v.length) * 100) : 0;
  document.getElementById('dash-ocupacao').textContent = ocupacao + '%';

  // Vencimentos próximos (up to 30 days, including overdue)
  var vencimentos = [];
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

  // Moto mais rentável
  var motoReceita = {};
  aNaoCancelado.forEach(function(x) {
    if (!x.veiculo_id) return;
    motoReceita[x.veiculo_id] = (motoReceita[x.veiculo_id] || 0) + Number(x.total || 0);
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

  // Recent tables
  var tbody1 = document.getElementById('dash-alugueis-tbody');
  var lastA   = a.slice().reverse().slice(0, 5);
  tbody1.innerHTML = lastA.length
    ? lastA.map(function(x) {
        var vei = v.find(function(vv) { return vv.id === x.veiculo_id; });
        return '<tr><td>' + (vei ? veiculoLabel(vei) : '-') + '</td><td>' + x.cliente + '</td><td>' + fmtBRL(x.total) + '</td><td>' + statusBadge(x.status, 'aluguel') + '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="4">Nenhum aluguel registrado</td></tr>';

  var tbody2 = document.getElementById('dash-manut-tbody');
  var lastM   = m.slice().reverse().slice(0, 5);
  tbody2.innerHTML = lastM.length
    ? lastM.map(function(x) {
        var vei = v.find(function(vv) { return vv.id === x.veiculo_id; });
        return '<tr><td>' + (vei ? veiculoLabel(vei) : '-') + '</td><td>' + x.tipo + '</td><td>' + fmtBRL(x.custo) + '</td><td>' + fmtDate(x.data) + '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="4">Nenhum custo registrado</td></tr>';
}

// --- CLIENTES ---
async function renderClientes() {
  showLoading('clientes-tbody', 6);
  const { data } = await db.from('clientes').select('*').order('nome');
  const c = data || [];
  document.getElementById('clientes-tbody').innerHTML = c.length
    ? c.map(function(cl) {
        return '<tr>' +
          '<td><strong>' + cl.nome + '</strong></td>' +
          '<td>' + (cl.cpf || '-') + '</td>' +
          '<td>' + (cl.telefone || '-') + '</td>' +
          '<td>' + (cl.cnh || '-') + '</td>' +
          '<td>' + (cl.endereco || '-') + '</td>' +
          '<td>' +
            '<button class="btn btn-sm btn-secondary" onclick="editCliente(\'' + cl.id + '\')">Editar</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'cliente\',\'' + cl.id + '\')">Excluir</button>' +
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
            '<div style="display:flex;flex-direction:column;gap:4px;align-items:stretch">' +
              '<button class="btn btn-sm btn-info" onclick="openMotoDetalhe(\'' + vei.id + '\')">Detalhes</button>' +
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
  document.getElementById('moto-status').value     = v.status || 'disponivel';
  document.getElementById('moto-obs').value        = v.obs || '';
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
    valor_compra:  document.getElementById('moto-valor-compra').value || null,
    status:        document.getElementById('moto-status').value,
    obs:           document.getElementById('moto-obs').value.trim()
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
  ['aluguel-moto', 'manut-moto', 'despesa-moto'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = v.length ? opts : noOpt;
  });
  var filterOpts = '<option value="">Todos</option>' + opts;
  ['filtro-moto-aluguel', 'filtro-moto-manut', 'filtro-moto-despesa'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = filterOpts;
  });
}

var periodoLabel = { dia: 'Dia', semana: 'Semana', mes: 'Mês' };

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
  if (inicio && fim && valor) {
    var dias = Math.max(1, Math.ceil((new Date(fim) - new Date(inicio)) / 86400000));
    if (diasLabel) diasLabel.textContent = '(' + dias + ' dia' + (dias !== 1 ? 's' : '') + ')';
    var unidades;
    if (periodo === 'dia')      unidades = dias;
    if (periodo === 'semana')   unidades = dias / 7;
    if (periodo === 'quinzena') unidades = dias / 15;
    if (periodo === 'mes')      unidades = dias / 30;
    document.getElementById('aluguel-total').value = (unidades * valor).toFixed(2);
  } else {
    if (diasLabel) diasLabel.textContent = '';
  }
}

async function renderAlugueis() {
  showLoading('alugueis-tbody', 12);
  var fmId = document.getElementById('filtro-moto-aluguel') ? document.getElementById('filtro-moto-aluguel').value : '';
  var fsId = document.getElementById('filtro-status-aluguel') ? document.getElementById('filtro-status-aluguel').value : '';

  var query = db.from('alugueis').select('*, veiculos(modelo, placa, ano, cor)').order('created_at', { ascending: false });
  if (fmId) query = query.eq('veiculo_id', fmId);
  if (fsId) query = query.eq('status', fsId);

  const { data } = await query;
  const a = data || [];
  document.getElementById('alugueis-tbody').innerHTML = a.length
    ? a.map(function(x) {
        var vei = x.veiculos;
        return '<tr>' +
          '<td>' + (vei ? veiculoLabel(vei) : '-') + '</td>' +
          '<td>' + x.cliente + '</td>' +
          '<td>' + (x.cpf || '-') + '</td>' +
          '<td>' + (x.telefone || '-') + '</td>' +
          '<td>' + fmtDate(x.inicio) + '</td>' +
          '<td>' + fmtDate(x.fim) + '</td>' +
          '<td>' + (periodoLabel[x.periodo] || '-') + '</td>' +
          '<td>' + fmtBRL(x.valor) + '</td>' +
          '<td><strong>' + fmtBRL(x.total) + '</strong></td>' +
          '<td>' + (x.caucao ? fmtBRL(x.caucao) + (x.caucao_devolvido === 'sim' ? ' <span class="badge badge-green">Dev.</span>' : ' <span class="badge badge-red">Pend.</span>') : '-') + '</td>' +
          '<td>' + statusBadge(x.status, 'aluguel') + '</td>' +
          '<td>' +
            '<button class="btn btn-sm btn-info" onclick="gerarContrato(\'' + x.id + '\')">📄 Contrato</button> ' +
            '<button class="btn btn-sm btn-secondary" onclick="editAluguel(\'' + x.id + '\')">Editar</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'aluguel\',\'' + x.id + '\')">Excluir</button>' +
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
  closeModal('modal-aluguel');
  renderAlugueis();
  if (!id && savedId && contratoWin) gerarContrato(savedId, contratoWin);
  else if (contratoWin) contratoWin.close();
}

// --- MOTO DETALHE ---
var currentMotoId = null;
var currentMotoData = null;

var CG160_SCHEDULE = [
  { intervalo: 1000,  tipo: 'Verificação',  item: 'Nível de óleo do motor' },
  { intervalo: 1000,  tipo: 'Verificação',  item: 'Pressão dos pneus (diant. e tras.)' },
  { intervalo: 1000,  tipo: 'Lubrificação', item: 'Corrente de transmissão' },
  { intervalo: 3000,  tipo: 'Troca',        item: 'Óleo do motor + filtro de óleo' },
  { intervalo: 6000,  tipo: 'Limpeza',      item: 'Filtro de ar' },
  { intervalo: 6000,  tipo: 'Verificação',  item: 'Vela de ignição' },
  { intervalo: 6000,  tipo: 'Verificação',  item: 'Pastilha / Lona de freio' },
  { intervalo: 6000,  tipo: 'Verificação',  item: 'Fluido de freio' },
  { intervalo: 12000, tipo: 'Troca',        item: 'Filtro de ar' },
  { intervalo: 12000, tipo: 'Troca',        item: 'Vela de ignição' },
  { intervalo: 12000, tipo: 'Regulagem',    item: 'Folga das válvulas' },
  { intervalo: 24000, tipo: 'Troca',        item: 'Fluido de freio' },
  { intervalo: 24000, tipo: 'Troca',        item: 'Corrente e coroa' },
  { intervalo: 36000, tipo: 'Troca',        item: 'Pneus (avaliar desgaste)' },
];

async function openMotoDetalhe(id) {
  currentMotoId = id;
  const { data: v } = await db.from('veiculos').select('*').eq('id', id).single();
  if (!v) return;
  currentMotoData = v;
  document.getElementById('moto-detalhe-titulo').textContent = v.modelo + (v.placa ? ' · ' + v.placa : '');
  var km = localStorage.getItem('km_' + id) || '';
  document.getElementById('moto-km-atual').value = km;
  showSection('moto-detalhe');
  showMotoTab('manutencoes');
}

function showMotoTab(tab) {
  document.querySelectorAll('.moto-tab-content').forEach(function(el) { el.style.display = 'none'; });
  document.querySelectorAll('.moto-tab').forEach(function(el) { el.classList.remove('active'); });
  document.getElementById('moto-tab-' + tab).style.display = 'block';
  var btn = document.querySelector('.moto-tab[data-tab="' + tab + '"]');
  if (btn) btn.classList.add('active');
  if (tab === 'manutencoes') renderMotoRevisoes();
  if (tab === 'despesas')    renderMotoDespesas();
  if (tab === 'resumo')      renderMotoResumo();
}

function atualizarKm() {
  var raw = document.getElementById('moto-km-atual').value.replace(/\D/g, '');
  document.getElementById('moto-km-atual').value = raw;
  if (currentMotoId) localStorage.setItem('km_' + currentMotoId, raw);
  renderMotoRevisoes();
}

function renderMotoRevisoes() {
  var km = parseInt(document.getElementById('moto-km-atual').value) || 0;
  var el = document.getElementById('moto-revisoes-schedule');
  if (!km) {
    el.innerHTML = '<p style="color:var(--text-muted);margin:0.75rem 0 1rem">Informe a quilometragem atual da moto para ver o status das revisões.</p>';
  } else {
    var rows = CG160_SCHEDULE.map(function(s) {
      var nextDue = Math.ceil(km / s.intervalo) * s.intervalo;
      if (nextDue === 0) nextDue = s.intervalo;
      var diff = nextDue - km;
      var trClass = '', badge;
      if (diff <= 0) {
        trClass = 'row-alert';
        badge = '<span class="badge badge-red">&#128308; Fazer agora</span>';
      } else if (diff <= 500) {
        trClass = 'row-warn';
        badge = '<span class="badge badge-yellow">&#9888;&#65039; Faltam ' + diff.toLocaleString('pt-BR') + ' km</span>';
      } else {
        badge = '<span class="badge badge-green">&#9989; ' + diff.toLocaleString('pt-BR') + ' km</span>';
      }
      return '<tr class="' + trClass + '">' +
        '<td>A cada ' + s.intervalo.toLocaleString('pt-BR') + ' km</td>' +
        '<td>' + s.tipo + '</td>' +
        '<td>' + s.item + '</td>' +
        '<td>' + nextDue.toLocaleString('pt-BR') + ' km</td>' +
        '<td>' + badge + '</td>' +
        '</tr>';
    }).join('');
    el.innerHTML = '<h3 style="margin:0 0 0.75rem;font-size:1rem;font-weight:600">Tabela de Revisões &mdash; KM atual: <strong style="color:var(--accent)">' + km.toLocaleString('pt-BR') + ' km</strong></h3>' +
      '<div class="table-wrap"><table>' +
      '<thead><tr><th>Intervalo</th><th>Tipo</th><th>Item</th><th>Pr&oacute;xima em</th><th>Status</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }
  renderMotoRevisoesHistorico();
}

async function renderMotoRevisoesHistorico() {
  if (!currentMotoId) return;
  const { data } = await db.from('manutencoes').select('*').eq('veiculo_id', currentMotoId).order('data', { ascending: false });
  const m = data || [];
  document.getElementById('moto-revisoes-tbody').innerHTML = m.length
    ? m.map(function(x) {
        return '<tr>' +
          '<td>' + x.tipo + '</td>' +
          '<td>' + (x.descricao || '-') + '</td>' +
          '<td><span class="text-red">' + fmtBRL(x.custo) + '</span></td>' +
          '<td>' + fmtDate(x.data) + '</td>' +
          '<td>' + (x.prox_km ? x.prox_km + ' km' : '-') + '</td>' +
          '<td>' + fmtDate(x.prox_data) + '</td>' +
          '<td>' +
            '<button class="btn btn-sm btn-secondary" onclick="editManutencao(\'' + x.id + '\')">Editar</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'manutencao\',\'' + x.id + '\')">Excluir</button>' +
          '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="7">Nenhuma manuten&ccedil;&atilde;o registrada</td></tr>';
}

async function renderMotoManutencoes() {
  if (!currentMotoId) return;
  const { data } = await db.from('manutencoes').select('*').eq('veiculo_id', currentMotoId).order('created_at', { ascending: false });
  const m = data || [];
  document.getElementById('moto-manutencoes-tbody').innerHTML = m.length
    ? m.map(function(x) {
        return '<tr>' +
          '<td>' + x.tipo + '</td>' +
          '<td>' + (x.descricao || '-') + '</td>' +
          '<td><span class="text-red">' + fmtBRL(x.custo) + '</span></td>' +
          '<td>' + fmtDate(x.data) + '</td>' +
          '<td>' + (x.prox_km ? x.prox_km + ' km' : '-') + '</td>' +
          '<td>' + fmtDate(x.prox_data) + '</td>' +
          '<td>' +
            '<button class="btn btn-sm btn-secondary" onclick="editManutencao(\'' + x.id + '\')">Editar</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'manutencao\',\'' + x.id + '\')">Excluir</button>' +
          '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="7">Nenhuma manuten&ccedil;&atilde;o registrada</td></tr>';
}

async function renderMotoDespesas() {
  if (!currentMotoId) return;
  const { data } = await db.from('despesas').select('*').eq('veiculo_id', currentMotoId).order('created_at', { ascending: false });
  const d = data || [];
  document.getElementById('moto-despesas-tbody').innerHTML = d.length
    ? d.map(function(x) {
        return '<tr>' +
          '<td>' + x.tipo + '</td>' +
          '<td>' + (x.ano || '-') + '</td>' +
          '<td><span class="text-red">' + fmtBRL(x.valor) + '</span></td>' +
          '<td>' + fmtDate(x.vencimento) + '</td>' +
          '<td>' + (x.obs || '-') + '</td>' +
          '<td>' +
            '<button class="btn btn-sm btn-secondary" onclick="editDespesa(\'' + x.id + '\')">Editar</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'despesa\',\'' + x.id + '\')">Excluir</button>' +
          '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="6">Nenhuma despesa registrada</td></tr>';
}

async function renderMotoResumo() {
  if (!currentMotoId) return;
  const [{ data: manut }, { data: desp }, { data: alu }] = await Promise.all([
    db.from('manutencoes').select('custo').eq('veiculo_id', currentMotoId),
    db.from('despesas').select('valor').eq('veiculo_id', currentMotoId),
    db.from('alugueis').select('total,status').eq('veiculo_id', currentMotoId)
  ]);
  var totalManut   = (manut||[]).reduce(function(s,x){ return s + Number(x.custo||0); }, 0);
  var totalDesp    = (desp||[]).reduce(function(s,x){ return s + Number(x.valor||0); }, 0);
  var totalReceita = (alu||[]).filter(function(x){ return x.status !== 'cancelado'; })
                              .reduce(function(s,x){ return s + Number(x.total||0); }, 0);
  var compra       = currentMotoData ? Number(currentMotoData.valor_compra||0) : 0;
  var lucro        = totalReceita - totalManut - totalDesp - compra;
  document.getElementById('moto-resumo-content').innerHTML =
    '<div class="cards-grid" style="margin-top:1rem">' +
      '<div class="card card-green"><div class="card-icon">&#128176;</div><div class="card-info"><span class="card-label">Receita Total</span><span class="card-value">' + fmtBRL(totalReceita) + '</span></div></div>' +
      '<div class="card card-red"><div class="card-icon">&#128296;</div><div class="card-info"><span class="card-label">Manutenções</span><span class="card-value">' + fmtBRL(totalManut) + '</span></div></div>' +
      '<div class="card card-red"><div class="card-icon">&#128203;</div><div class="card-info"><span class="card-label">Despesas</span><span class="card-value">' + fmtBRL(totalDesp) + '</span></div></div>' +
      '<div class="card ' + (lucro >= 0 ? 'card-green' : 'card-red') + '"><div class="card-icon">&#128200;</div><div class="card-info"><span class="card-label">Lucro líquido</span><span class="card-value" style="color:' + (lucro >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmtBRL(lucro) + '</span></div></div>' +
    '</div>' +
    '<p style="font-size:0.78rem;color:var(--text-muted);margin-top:0.75rem">* Lucro = Receita &minus; Manutenções &minus; Despesas &minus; Valor de compra (' + fmtBRL(compra) + ')</p>';
}

function openNewManutencaoMoto() {
  document.getElementById('form-manutencao').reset();
  document.getElementById('manut-id').value = '';
  document.getElementById('modal-manut-title').textContent = 'Nova Manutenção';
  populateVeiculoSelects().then(function() {
    if (currentMotoId) document.getElementById('manut-moto').value = currentMotoId;
  });
  openModal('modal-manutencao');
}

function openNewDespesaMoto() {
  document.getElementById('form-despesa').reset();
  document.getElementById('despesa-id').value = '';
  document.getElementById('modal-despesa-title').textContent = 'Nova Despesa';
  populateVeiculoSelects().then(function() {
    if (currentMotoId) document.getElementById('despesa-moto').value = currentMotoId;
  });
  openModal('modal-despesa');
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
            '<button class="btn btn-sm btn-secondary" onclick="editManutencao(\'' + x.id + '\')">Editar</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'manutencao\',\'' + x.id + '\')">Excluir</button>' +
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
  if (document.getElementById('moto-detalhe').classList.contains('active')) {
    var activeTab = document.querySelector('.moto-tab.active');
    if (activeTab) showMotoTab(activeTab.dataset.tab);
  }
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
            '<button class="btn btn-sm btn-secondary" onclick="editDespesa(\'' + x.id + '\')">Editar</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'despesa\',\'' + x.id + '\')">Excluir</button>' +
          '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="7">Nenhuma despesa encontrada</td></tr>';
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
    result = await db.from('despesas').insert(d);
  }
  if (result.error) { alert('Erro ao salvar: ' + result.error.message); return; }
  closeModal('modal-despesa');
  if (document.getElementById('moto-detalhe').classList.contains('active')) {
    var activeTab = document.querySelector('.moto-tab.active');
    if (activeTab) showMotoTab(activeTab.dataset.tab);
  }
}

// --- RELATÓRIOS ---
function resetFiltroMes() {
  document.getElementById('filtro-mes').value = '';
  renderRelatorios();
}

async function renderRelatorios() {
  var filtroMes = document.getElementById('filtro-mes').value;
  const [{ data: veiculos }, { data: alugueis }, { data: manutencoes }, { data: despesas }] = await Promise.all([
    db.from('veiculos').select('*'),
    db.from('alugueis').select('*').neq('status', 'cancelado'),
    db.from('manutencoes').select('*'),
    db.from('despesas').select('*')
  ]);

  var v = veiculos || [];
  var a = alugueis || [], m = manutencoes || [], d = despesas || [];

  if (filtroMes) {
    a = a.filter(function(x) { return x.inicio && x.inicio.startsWith(filtroMes); });
    m = m.filter(function(x) { return x.data && x.data.startsWith(filtroMes); });
    d = d.filter(function(x) { return x.vencimento && x.vencimento.startsWith(filtroMes); });
  }

  var totalReceita = 0, totalCustos = 0, totalAlugueis = 0;

  var rows = v.map(function(vei) {
    var receita = a.filter(function(x) { return x.veiculo_id === vei.id; })
                  .reduce(function(s, x) { return s + Number(x.total || 0); }, 0);
    var custos  = m.filter(function(x) { return x.veiculo_id === vei.id; })
                  .reduce(function(s, x) { return s + Number(x.custo || 0); }, 0)
                + d.filter(function(x) { return x.veiculo_id === vei.id; })
                  .reduce(function(s, x) { return s + Number(x.valor || 0); }, 0);
    var qtd = a.filter(function(x) { return x.veiculo_id === vei.id; }).length;
    totalReceita  += receita;
    totalCustos   += custos;
    totalAlugueis += qtd;
    return { vei: vei, receita: receita, custos: custos, lucro: receita - custos, qtd: qtd };
  });

  var grid = document.getElementById('relatorio-motos-grid');
  grid.innerHTML = rows.length
    ? rows.map(function(r) {
        var lc = r.lucro >= 0 ? 'text-green' : 'text-red';
        return '<div class="relatorio-card">' +
          '<h4>' + veiculoLabel(r.vei) + '</h4>' +
          '<div class="rel-row"><span>Receita</span><span class="text-green">' + fmtBRL(r.receita) + '</span></div>' +
          '<div class="rel-row"><span>Custos</span><span class="text-red">' + fmtBRL(r.custos) + '</span></div>' +
          '<div class="rel-row"><span>Aluguéis</span><span>' + r.qtd + '</span></div>' +
          '<div class="rel-row"><span>Lucro/Prejuízo</span><span class="' + lc + '">' + fmtBRL(r.lucro) + '</span></div>' +
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
    var tableMap  = { cliente: 'clientes', veiculo: 'veiculos', aluguel: 'alugueis', manutencao: 'manutencoes', despesa: 'despesas' };
    var renderMap = {
      cliente:    function() { renderClientes(); populateClienteSelect(); },
      veiculo:    function() { renderVeiculos(); populateVeiculoSelects(); },
      aluguel:    renderAlugueis,
      manutencao: renderManutencoes,
      despesa:    renderDespesas
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
    '<div class="ref">Nº ' + contratoNum + ' &nbsp;|&nbsp; Fortaleza/CE, ' + hoje + '</div>' +

    '<div class="sec">1. Das Partes</div>' +
    '<table>' +
      '<tr><td class="lb">Locador (Proprietário)</td><td>Arisnaldo Sahdo Freire</td></tr>' +
      '<tr><td class="lb">CPF do Locador</td><td>071.235.863-36</td></tr>' +
      '<tr><td class="lb">Endereço do Locador</td><td>Rua Alameda das Borboletas, nº 69, Fortaleza - CE</td></tr>' +
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

    '<div class="sec">4. Das Obrigações do Locatário</div>' +
    '<div class="cl"><strong>4.1</strong> O Locatário se compromete a devolver o veículo nas mesmas condições em que o recebeu, salvo desgaste natural de uso.</div>' +
    '<div class="cl"><strong>4.2</strong> É obrigatório o uso de capacete e demais equipamentos de segurança previstos no Código de Trânsito Brasileiro.</div>' +
    '<div class="cl"><strong>4.3</strong> É vedado ao Locatário sublocar, ceder ou emprestar o veículo a terceiros sem autorização prévia e por escrito do Locador.</div>' +
    '<div class="cl"><strong>4.4</strong> O Locatário é responsável pelo abastecimento e pelo nível de óleo do veículo durante o período de locação.</div>' +
    '<div class="cl"><strong>4.5</strong> Todas as multas de trânsito, infrações e penalidades ocorridas durante o período de locação são de inteira responsabilidade do Locatário.</div>' +
    '<div class="cl"><strong>4.6</strong> Fica proibida a utilização do veículo para atividades ilícitas, transporte de cargas não autorizadas ou participação em competições de qualquer natureza.</div>' +
    '<div class="cl"><strong>4.7</strong> O Locatário se obriga a comunicar imediatamente o Locador em caso de acidente, roubo, furto ou qualquer ocorrência policial envolvendo o veículo.</div>' +

    '<div class="sec">5. Da Responsabilidade por Danos</div>' +
    '<div class="cl"><strong>5.1</strong> O Locatário responde por todos os danos causados ao veículo durante o período de locação, sejam por colisão, tombamento, vandalismo ou qualquer outro sinistro, exceto os decorrentes de desgaste natural.</div>' +
    '<div class="cl"><strong>5.2</strong> O valor da caução poderá ser retido total ou parcialmente para cobrir danos, multas ou débitos pendentes ao final do contrato.</div>' +

    '<div class="sec">6. Da Rescisão</div>' +
    '<div class="cl"><strong>6.1</strong> O presente contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 24 (vinte e quatro) horas.</div>' +
    '<div class="cl"><strong>6.2</strong> A devolução do veículo fora do prazo acordado implicará cobrança proporcional pelo período excedente, conforme a modalidade contratada.</div>' +
    '<div class="cl"><strong>6.3</strong> O descumprimento de qualquer cláusula deste contrato autoriza o Locador a reaver o veículo imediatamente, independentemente de notificação judicial.</div>' +

    '<div class="sec">7. Do Foro</div>' +
    '<div class="cl"><strong>7.1</strong> As partes elegem o foro da Comarca de Fortaleza, Estado do Ceará, para dirimir quaisquer controvérsias oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.</div>' +

    '<div class="cl" style="margin-top:16px;text-align:justify">E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma.</div>' +
    '<div class="cl" style="text-align:center;margin-top:8px"><strong>Fortaleza - CE, ' + hoje + '</strong></div>' +

    '<div class="asrow">' +
      '<div class="asbox"><div class="asline"></div><div class="asname"><strong>Arisnaldo Sahdo Freire</strong><br>Locador — CPF 071.235.863-36</div></div>' +
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
