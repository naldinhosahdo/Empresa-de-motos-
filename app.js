// GereMoto - Gestao de Aluguel de Motos

// --- DATA ---
function getMotos()      { return JSON.parse(localStorage.getItem('gm_motos')      || '[]'); }
function getAlugueis()   { return JSON.parse(localStorage.getItem('gm_alugueis')   || '[]'); }
function getManutencoes(){ return JSON.parse(localStorage.getItem('gm_manutencoes')|| '[]'); }

function saveMotos(d)      { localStorage.setItem('gm_motos',      JSON.stringify(d)); }
function saveAlugueis(d)   { localStorage.setItem('gm_alugueis',   JSON.stringify(d)); }
function saveManutencoes(d){ localStorage.setItem('gm_manutencoes',JSON.stringify(d)); }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// --- FORMATTERS ---
function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d) {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return day + '/' + m + '/' + y;
}
function motoLabel(m) { return m.modelo + (m.placa ? ' · ' + m.placa : ''); }

function statusBadge(status, type) {
  const maps = {
    moto:    { disponivel: ['green','Disponível'], alugada: ['blue','Alugada'], manutencao: ['yellow','Manutenção'] },
    aluguel: { ativo: ['blue','Ativo'], finalizado: ['green','Finalizado'], cancelado: ['red','Cancelado'] }
  };
  const [color, label] = (maps[type] && maps[type][status]) ? maps[type][status] : ['gray', status];
  return '<span class="badge badge-' + color + '">' + label + '</span>';
}

// --- NAVIGATION ---
function showSection(name) {
  document.querySelectorAll('.section').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(a){ a.classList.remove('active'); });
  document.getElementById(name).classList.add('active');
  var link = document.querySelector('[data-section="' + name + '"]');
  if (link) link.classList.add('active');
  document.getElementById('navLinks').classList.remove('open');

  if (name === 'dashboard')   renderDashboard();
  if (name === 'motos')       renderMotos();
  if (name === 'alugueis')    { populateMotoSelects(); renderAlugueis(); }
  if (name === 'manutencoes') { populateMotoSelects(); renderManutencoes(); }
  if (name === 'relatorios')  renderRelatorios();
}

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
function renderDashboard() {
  var motos = getMotos();
  var alugueis = getAlugueis();
  var manutencoes = getManutencoes();

  var receita = alugueis
    .filter(function(a){ return a.status !== 'cancelado'; })
    .reduce(function(s, a){ return s + Number(a.total || 0); }, 0);
  var custos = manutencoes.reduce(function(s, m){ return s + Number(m.custo || 0); }, 0);
  var lucro = receita - custos;

  document.getElementById('dash-total-motos').textContent = motos.length;
  document.getElementById('dash-receita').textContent = fmtBRL(receita);
  document.getElementById('dash-custos').textContent = fmtBRL(custos);
  var lucroEl = document.getElementById('dash-lucro');
  lucroEl.textContent = fmtBRL(lucro);
  lucroEl.style.color = lucro >= 0 ? 'var(--green)' : 'var(--red)';

  var tbody1 = document.getElementById('dash-alugueis-tbody');
  var lastAlugueis = alugueis.slice().reverse().slice(0, 5);
  tbody1.innerHTML = lastAlugueis.length
    ? lastAlugueis.map(function(a) {
        var moto = motos.find(function(m){ return m.id === a.motoId; });
        return '<tr><td>' + (moto ? motoLabel(moto) : '-') + '</td><td>' + a.cliente + '</td><td>' + fmtBRL(a.total) + '</td><td>' + statusBadge(a.status,'aluguel') + '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="4">Nenhum aluguel registrado</td></tr>';

  var tbody2 = document.getElementById('dash-manut-tbody');
  var lastManut = manutencoes.slice().reverse().slice(0, 5);
  tbody2.innerHTML = lastManut.length
    ? lastManut.map(function(m) {
        var moto = motos.find(function(x){ return x.id === m.motoId; });
        return '<tr><td>' + (moto ? motoLabel(moto) : '-') + '</td><td>' + m.tipo + '</td><td>' + fmtBRL(m.custo) + '</td><td>' + fmtDate(m.data) + '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="4">Nenhuma manutenção registrada</td></tr>';
}

// --- MOTOS ---
function renderMotos() {
  var motos = getMotos();
  var tbody = document.getElementById('motos-tbody');
  tbody.innerHTML = motos.length
    ? motos.map(function(m) {
        return '<tr>' +
          '<td><strong>' + m.modelo + '</strong></td>' +
          '<td>' + (m.placa || '-') + '</td>' +
          '<td>' + (m.ano || '-') + '</td>' +
          '<td>' + (m.cor || '-') + '</td>' +
          '<td>' + (m.valorCompra ? fmtBRL(m.valorCompra) : '-') + '</td>' +
          '<td>' + statusBadge(m.status, 'moto') + '</td>' +
          '<td>' +
            '<button class="btn btn-sm btn-secondary" onclick="editMoto(\'' + m.id + '\')">Editar</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'moto\',\'' + m.id + '\')" style="margin-top:2px">Excluir</button>' +
          '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="7">Nenhuma moto cadastrada</td></tr>';
}

function openNewMoto() {
  document.getElementById('form-moto').reset();
  document.getElementById('moto-id').value = '';
  document.getElementById('modal-moto-title').textContent = 'Nova Moto';
  openModal('modal-moto');
}

function editMoto(id) {
  var m = getMotos().find(function(x){ return x.id === id; });
  if (!m) return;
  document.getElementById('moto-id').value = m.id;
  document.getElementById('moto-modelo').value = m.modelo || '';
  document.getElementById('moto-placa').value = m.placa || '';
  document.getElementById('moto-ano').value = m.ano || '';
  document.getElementById('moto-cor').value = m.cor || '';
  document.getElementById('moto-valor-compra').value = m.valorCompra || '';
  document.getElementById('moto-status').value = m.status || 'disponivel';
  document.getElementById('moto-obs').value = m.obs || '';
  document.getElementById('modal-moto-title').textContent = 'Editar Moto';
  openModal('modal-moto');
}

function submitMoto(e) {
  e.preventDefault();
  var id = document.getElementById('moto-id').value || uid();
  var motos = getMotos();
  var moto = {
    id: id,
    modelo: document.getElementById('moto-modelo').value.trim(),
    placa: document.getElementById('moto-placa').value.trim().toUpperCase(),
    ano: document.getElementById('moto-ano').value,
    cor: document.getElementById('moto-cor').value.trim(),
    valorCompra: document.getElementById('moto-valor-compra').value,
    status: document.getElementById('moto-status').value,
    obs: document.getElementById('moto-obs').value.trim()
  };
  var idx = motos.findIndex(function(m){ return m.id === id; });
  if (idx >= 0) motos[idx] = moto; else motos.push(moto);
  saveMotos(motos);
  closeModal('modal-moto');
  renderMotos();
  populateMotoSelects();
}

// --- SELECTS ---
function populateMotoSelects() {
  var motos = getMotos();
  var opts = motos.map(function(m){ return '<option value="' + m.id + '">' + motoLabel(m) + '</option>'; }).join('');
  var noOpt = '<option value="">Nenhuma moto cadastrada</option>';
  ['aluguel-moto','manut-moto'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = motos.length ? opts : noOpt;
  });
  var filterOpts = '<option value="">Todas</option>' + opts;
  ['filtro-moto-aluguel','filtro-moto-manut'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = filterOpts;
  });
}

// --- ALUGUEIS ---
function calcTotal() {
  var inicio = document.getElementById('aluguel-inicio').value;
  var fim    = document.getElementById('aluguel-fim').value;
  var dia    = parseFloat(document.getElementById('aluguel-valor-dia').value) || 0;
  if (inicio && fim && dia) {
    var dias = Math.max(1, Math.ceil((new Date(fim) - new Date(inicio)) / 86400000));
    document.getElementById('aluguel-total').value = (dias * dia).toFixed(2);
  }
}

function renderAlugueis() {
  var motos = getMotos();
  var alugueis = getAlugueis();
  var fm = document.getElementById('filtro-moto-aluguel');
  var fs = document.getElementById('filtro-status-aluguel');
  if (fm && fm.value) alugueis = alugueis.filter(function(a){ return a.motoId === fm.value; });
  if (fs && fs.value) alugueis = alugueis.filter(function(a){ return a.status === fs.value; });

  var tbody = document.getElementById('alugueis-tbody');
  tbody.innerHTML = alugueis.length
    ? alugueis.slice().reverse().map(function(a) {
        var moto = motos.find(function(m){ return m.id === a.motoId; });
        return '<tr>' +
          '<td>' + (moto ? motoLabel(moto) : '-') + '</td>' +
          '<td>' + a.cliente + '</td>' +
          '<td>' + (a.contato || '-') + '</td>' +
          '<td>' + fmtDate(a.inicio) + '</td>' +
          '<td>' + fmtDate(a.fim) + '</td>' +
          '<td>' + fmtBRL(a.valorDia) + '</td>' +
          '<td><strong>' + fmtBRL(a.total) + '</strong></td>' +
          '<td>' + statusBadge(a.status,'aluguel') + '</td>' +
          '<td>' +
            '<button class="btn btn-sm btn-secondary" onclick="editAluguel(\'' + a.id + '\')">Editar</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'aluguel\',\'' + a.id + '\')">Excluir</button>' +
          '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="9">Nenhum aluguel encontrado</td></tr>';
}

function openNewAluguel() {
  document.getElementById('form-aluguel').reset();
  document.getElementById('aluguel-id').value = '';
  document.getElementById('modal-aluguel-title').textContent = 'Novo Aluguel';
  populateMotoSelects();
  openModal('modal-aluguel');
}

function editAluguel(id) {
  var a = getAlugueis().find(function(x){ return x.id === id; });
  if (!a) return;
  populateMotoSelects();
  document.getElementById('aluguel-id').value = a.id;
  document.getElementById('aluguel-moto').value = a.motoId || '';
  document.getElementById('aluguel-cliente').value = a.cliente || '';
  document.getElementById('aluguel-contato').value = a.contato || '';
  document.getElementById('aluguel-inicio').value = a.inicio || '';
  document.getElementById('aluguel-fim').value = a.fim || '';
  document.getElementById('aluguel-valor-dia').value = a.valorDia || '';
  document.getElementById('aluguel-total').value = a.total || '';
  document.getElementById('aluguel-status').value = a.status || 'ativo';
  document.getElementById('aluguel-obs').value = a.obs || '';
  document.getElementById('modal-aluguel-title').textContent = 'Editar Aluguel';
  openModal('modal-aluguel');
}

function submitAluguel(e) {
  e.preventDefault();
  var id = document.getElementById('aluguel-id').value || uid();
  var alugueis = getAlugueis();
  var aluguel = {
    id: id,
    motoId:   document.getElementById('aluguel-moto').value,
    cliente:  document.getElementById('aluguel-cliente').value.trim(),
    contato:  document.getElementById('aluguel-contato').value.trim(),
    inicio:   document.getElementById('aluguel-inicio').value,
    fim:      document.getElementById('aluguel-fim').value,
    valorDia: document.getElementById('aluguel-valor-dia').value,
    total:    document.getElementById('aluguel-total').value,
    status:   document.getElementById('aluguel-status').value,
    obs:      document.getElementById('aluguel-obs').value.trim()
  };
  var idx = alugueis.findIndex(function(a){ return a.id === id; });
  if (idx >= 0) alugueis[idx] = aluguel; else alugueis.push(aluguel);
  saveAlugueis(alugueis);
  closeModal('modal-aluguel');
  renderAlugueis();
}

// --- MANUTENCOES ---
function renderManutencoes() {
  var motos = getMotos();
  var manutencoes = getManutencoes();
  var fm = document.getElementById('filtro-moto-manut');
  if (fm && fm.value) manutencoes = manutencoes.filter(function(m){ return m.motoId === fm.value; });

  var tbody = document.getElementById('manutencoes-tbody');
  tbody.innerHTML = manutencoes.length
    ? manutencoes.slice().reverse().map(function(m) {
        var moto = motos.find(function(x){ return x.id === m.motoId; });
        return '<tr>' +
          '<td>' + (moto ? motoLabel(moto) : '-') + '</td>' +
          '<td>' + m.tipo + '</td>' +
          '<td>' + (m.desc || '-') + '</td>' +
          '<td><span class="text-red">' + fmtBRL(m.custo) + '</span></td>' +
          '<td>' + fmtDate(m.data) + '</td>' +
          '<td>' + (m.oficina || '-') + '</td>' +
          '<td>' +
            '<button class="btn btn-sm btn-secondary" onclick="editManutencao(\'' + m.id + '\')">Editar</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'manutencao\',\'' + m.id + '\')">Excluir</button>' +
          '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="7">Nenhuma manutenção encontrada</td></tr>';
}

function openNewManutencao() {
  document.getElementById('form-manutencao').reset();
  document.getElementById('manut-id').value = '';
  document.getElementById('modal-manut-title').textContent = 'Nova Manutenção';
  populateMotoSelects();
  openModal('modal-manutencao');
}

function editManutencao(id) {
  var m = getManutencoes().find(function(x){ return x.id === id; });
  if (!m) return;
  populateMotoSelects();
  document.getElementById('manut-id').value = m.id;
  document.getElementById('manut-moto').value = m.motoId || '';
  document.getElementById('manut-tipo').value = m.tipo || '';
  document.getElementById('manut-data').value = m.data || '';
  document.getElementById('manut-custo').value = m.custo || '';
  document.getElementById('manut-oficina').value = m.oficina || '';
  document.getElementById('manut-prox-km').value = m.proxKm || '';
  document.getElementById('manut-desc').value = m.desc || '';
  document.getElementById('modal-manut-title').textContent = 'Editar Manutenção';
  openModal('modal-manutencao');
}

function submitManutencao(e) {
  e.preventDefault();
  var id = document.getElementById('manut-id').value || uid();
  var manutencoes = getManutencoes();
  var m = {
    id: id,
    motoId:  document.getElementById('manut-moto').value,
    tipo:    document.getElementById('manut-tipo').value,
    data:    document.getElementById('manut-data').value,
    custo:   document.getElementById('manut-custo').value,
    oficina: document.getElementById('manut-oficina').value.trim(),
    proxKm:  document.getElementById('manut-prox-km').value,
    desc:    document.getElementById('manut-desc').value.trim()
  };
  var idx = manutencoes.findIndex(function(x){ return x.id === id; });
  if (idx >= 0) manutencoes[idx] = m; else manutencoes.push(m);
  saveManutencoes(manutencoes);
  closeModal('modal-manutencao');
  renderManutencoes();
}

// --- RELATORIOS ---
function resetFiltroMes() {
  document.getElementById('filtro-mes').value = '';
  renderRelatorios();
}

function renderRelatorios() {
  var motos = getMotos();
  var filtroMes = document.getElementById('filtro-mes').value;

  var alugueis = getAlugueis().filter(function(a){ return a.status !== 'cancelado'; });
  var manutencoes = getManutencoes();

  if (filtroMes) {
    alugueis     = alugueis.filter(function(a){ return a.inicio && a.inicio.startsWith(filtroMes); });
    manutencoes  = manutencoes.filter(function(m){ return m.data && m.data.startsWith(filtroMes); });
  }

  var totalReceita = 0, totalCustos = 0, totalAlugueis = 0;

  var rows = motos.map(function(moto) {
    var receita = alugueis
      .filter(function(a){ return a.motoId === moto.id; })
      .reduce(function(s, a){ return s + Number(a.total || 0); }, 0);
    var custos = manutencoes
      .filter(function(m){ return m.motoId === moto.id; })
      .reduce(function(s, m){ return s + Number(m.custo || 0); }, 0);
    var qtd = alugueis.filter(function(a){ return a.motoId === moto.id; }).length;
    totalReceita  += receita;
    totalCustos   += custos;
    totalAlugueis += qtd;
    return { moto: moto, receita: receita, custos: custos, lucro: receita - custos, qtd: qtd };
  });

  var grid = document.getElementById('relatorio-motos-grid');
  grid.innerHTML = rows.length
    ? rows.map(function(r) {
        var lucroColor = r.lucro >= 0 ? 'text-green' : 'text-red';
        return '<div class="relatorio-card">' +
          '<h4>' + motoLabel(r.moto) + '</h4>' +
          '<div class="rel-row"><span>Receita</span><span class="text-green">' + fmtBRL(r.receita) + '</span></div>' +
          '<div class="rel-row"><span>Manutenções</span><span class="text-red">' + fmtBRL(r.custos) + '</span></div>' +
          '<div class="rel-row"><span>Aluguéis</span><span>' + r.qtd + '</span></div>' +
          '<div class="rel-row"><span>Lucro/Prejuízo</span><span class="' + lucroColor + '">' + fmtBRL(r.lucro) + '</span></div>' +
          '</div>';
      }).join('')
    : '<p style="color:var(--text2)">Nenhuma moto cadastrada.</p>';

  var tbody = document.getElementById('relatorio-tbody');
  tbody.innerHTML = rows.length
    ? rows.map(function(r) {
        var lucroColor = r.lucro >= 0 ? 'text-green' : 'text-red';
        return '<tr>' +
          '<td>' + motoLabel(r.moto) + '</td>' +
          '<td class="text-green">' + fmtBRL(r.receita) + '</td>' +
          '<td class="text-red">'   + fmtBRL(r.custos)  + '</td>' +
          '<td class="' + lucroColor + '"><strong>' + fmtBRL(r.lucro) + '</strong></td>' +
          '<td>' + r.qtd + '</td></tr>';
      }).join('')
    : '<tr class="empty-row"><td colspan="5">Nenhum dado encontrado</td></tr>';

  var lucroTotal = totalReceita - totalCustos;
  var tfoot = document.getElementById('relatorio-tfoot');
  tfoot.innerHTML =
    '<td><strong>TOTAL</strong></td>' +
    '<td class="text-green"><strong>' + fmtBRL(totalReceita) + '</strong></td>' +
    '<td class="text-red"><strong>'   + fmtBRL(totalCustos)  + '</strong></td>' +
    '<td class="' + (lucroTotal >= 0 ? 'text-green' : 'text-red') + '"><strong>' + fmtBRL(lucroTotal) + '</strong></td>' +
    '<td><strong>' + totalAlugueis + '</strong></td>';
}

// --- DELETE ---
function confirmDelete(type, id) {
  var btn = document.getElementById('confirm-delete-btn');
  btn.onclick = function() {
    if (type === 'moto') {
      saveMotos(getMotos().filter(function(m){ return m.id !== id; }));
      renderMotos();
      populateMotoSelects();
    } else if (type === 'aluguel') {
      saveAlugueis(getAlugueis().filter(function(a){ return a.id !== id; }));
      renderAlugueis();
    } else if (type === 'manutencao') {
      saveManutencoes(getManutencoes().filter(function(m){ return m.id !== id; }));
      renderManutencoes();
    }
    closeModal('modal-confirm');
  };
  openModal('modal-confirm');
}

// --- INIT ---
renderDashboard();
