// Item "Solicitações" do menu da ONG (no Figma, 6.10 a 6.12, esse item abria o
// formulário; aqui é a lista dos pedidos feitos). GET /api/ong/solicitacoes:
// em cima os pedidos "Em andamento" (PENDENTE e CONFIRMADA), com o botão de
// cancelar; embaixo os recusados e cancelados dos últimos 30 dias.
// Com ?nova=ID (vindo de solicitar.html), destaca o pedido recém-criado.
import { api, exigirLogin } from "/js/api.js";
import {
  badge, data, diaHora, esc, imagem, kg, montarPainel, parametros, relativo, STATUS_DOACAO, toast, vazio,
} from "/js/ui.js";
import { atualizarCidade, cidadeDaOng, plural } from "/js/ong-comum.js";

const conta = exigirLogin("ONG");
montarPainel(conta, "solicitacoes", cidadeDaOng(conta));
atualizarCidade(conta);

const areaAndamento = document.getElementById("andamento");
const areaEncerrados = document.getElementById("encerrados");
const contagem = document.getElementById("n-andamento");

const EM_ANDAMENTO = ["PENDENTE", "CONFIRMADA"];
const EXPLICACAO = {
  PENDENTE: "A loja ainda vai confirmar.",
  CONFIRMADA: "Pode buscar no horário combinado.",
  RECUSADA: "A loja não pôde atender este pedido.",
  CANCELADA: "Pedido cancelado pela sua ONG.",
};
const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

let pedidos = [];                                   // última resposta da API
const idNovo = Number(parametros().get("nova")) || 0; // pedido recém-criado (vem de solicitar.html)
let avisarNovo = idNovo > 0;                        // o aviso e a rolagem acontecem só na 1ª carga

// ----------------------------------------------------------------- cards
/** Link do Google Maps para o endereço da loja (a API não manda a cidade da loja; usamos a da ONG). */
function linkComoChegar(p) {
  const endereco = [p.endereco, p.bairro, cidadeDaOng(conta)].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
}

function cardAndamento(p) {
  const telefone = p.telefone
    ? `<a href="tel:${p.telefone.replace(/[^\d+]/g, "")}">${esc(p.telefone)}</a>`
    : "—";
  const novo = p.id_doacao === idNovo ? '<span class="badge badge-verde">Novo</span>' : "";
  return `
    <article class="card pedido${p.id_doacao === idNovo ? " destaque" : ""}" id="pedido-${p.id_doacao}">
      <img class="pedido-foto" src="${esc(imagem(p.foto))}" alt="" loading="lazy">
      <div class="pedido-corpo">
        <div>
          <div class="pedido-topo"><h3>${esc(p.estabelecimento)}</h3>${badge(STATUS_DOACAO, p.status)}${novo}</div>
          <p class="pedido-status">${EXPLICACAO[p.status]} <span class="sutil">Pedido feito ${relativo(p.data_solicitacao)}.</span></p>
        </div>
        <dl class="pedido-dados">
          <div><dt>Alimento</dt><dd>${esc(p.tipo_alimento)}</dd></div>
          <div><dt>Quantidade</dt><dd>${kg(p.quantidade_kg)} • ≈ ${plural(p.refeicoes, "refeição", "refeições")}</dd></div>
          <div><dt>Retirada</dt><dd>${diaHora(p.data_retirada)}</dd></div>
          <div><dt>Telefone da loja</dt><dd>${telefone}</dd></div>
        </dl>
        <p class="pedido-endereco">
          ${esc(p.endereco)}${p.bairro ? ` • ${esc(p.bairro)}` : ""} —
          <a href="${esc(linkComoChegar(p))}" target="_blank" rel="noopener">Como chegar<span class="sr-only"> (abre em nova aba)</span></a>
        </p>
        ${p.observacoes ? `<p class="pedido-obs"><strong>Sua observação:</strong> ${esc(p.observacoes)}</p>` : ""}
      </div>
      <div class="pedido-acoes">
        <button class="btn btn-perigo btn-pequeno" type="button" data-cancelar="${p.id_doacao}"
                aria-label="Cancelar pedido: ${esc(p.estabelecimento)}">Cancelar pedido</button>
      </div>
    </article>`;
}

function itemEncerrado(p) {
  return `
    <div class="item">
      <img class="item-foto" src="${esc(imagem(p.foto))}" alt="" loading="lazy">
      <div class="item-corpo">
        <strong>${esc(p.estabelecimento)}</strong>
        <span class="sutil">${esc(p.tipo_alimento)} • ${kg(p.quantidade_kg)} • retirada ${diaHora(p.data_retirada).toLowerCase()}</span>
        <span class="sutil">${EXPLICACAO[p.status]}</span>
      </div>
      ${badge(STATUS_DOACAO, p.status)}
    </div>`;
}

// ----------------------------------------------------------------- carregar
function mostrar() {
  // Em andamento: a retirada mais próxima primeiro (a API manda da mais nova para a mais antiga).
  const andamento = pedidos
    .filter((p) => EM_ANDAMENTO.includes(p.status))
    .sort((a, b) => a.data_retirada.localeCompare(b.data_retirada));
  const desde = Date.now() - TRINTA_DIAS;
  const encerrados = pedidos.filter((p) =>
    (p.status === "RECUSADA" || p.status === "CANCELADA") && data(p.data_solicitacao).getTime() >= desde);

  contagem.textContent = andamento.length ? plural(andamento.length, "pedido") : "";
  areaAndamento.innerHTML = andamento.length
    ? andamento.map(cardAndamento).join("")
    : `<div class="card">${vazio("Nenhum pedido em andamento",
      "Escolha uma doação no mapa e agende a retirada com a loja.",
      '<a class="btn btn-primario" href="/ong/mapa.html">Ver doações no mapa</a>')}</div>`;

  areaEncerrados.innerHTML = encerrados.length
    ? encerrados.map(itemEncerrado).join("")
    : '<p class="sutil">Nenhum pedido recusado ou cancelado nos últimos 30 dias.</p>';
}

/** Na primeira carga vinda do formulário: avisa, rola até o pedido novo e limpa o ?nova da URL. */
function destacarNovo() {
  if (!avisarNovo) return;
  avisarNovo = false;
  toast("Solicitação enviada! A loja vai confirmar pelo painel do Refood.", "ok");
  document.getElementById(`pedido-${idNovo}`)?.scrollIntoView({ block: "center" });
  history.replaceState(null, "", location.pathname); // recarregar a página não repete o aviso
}

async function carregar() {
  try {
    pedidos = await api("/ong/solicitacoes");
    mostrar();
    destacarNovo();
  } catch (erro) {
    contagem.textContent = "";
    areaEncerrados.innerHTML = "";
    areaAndamento.innerHTML = `
      <div class="alerta alerta-erro" role="alert">
        <div><p>${esc(erro.message)}</p>
        <button class="btn btn-contorno btn-pequeno" type="button" data-tentar style="margin-top:10px">Tentar de novo</button></div>
      </div>`;
  }
}

// ----------------------------------------------------------------- modal de cancelamento
const modal = document.getElementById("modal-cancelar");
const modalTexto = document.getElementById("modal-texto");
const modalErro = document.getElementById("modal-erro");
const botaoConfirmar = document.getElementById("confirmar-cancelamento");
const botaoVoltar = modal.querySelector("[data-fechar]");
let pedidoACancelar = null;
let botaoQueAbriu = null; // o foco volta para ele quando o modal fecha

function abrirModal(pedido, botao) {
  pedidoACancelar = pedido;
  botaoQueAbriu = botao;
  modalTexto.textContent = `Pedido de ${kg(pedido.quantidade_kg)} de ${pedido.tipo_alimento.toLowerCase()} em ` +
    `${pedido.estabelecimento}. Esses quilos voltam a ficar disponíveis para outras ONGs.`;
  modalErro.innerHTML = "";
  modal.hidden = false;
  botaoVoltar.focus(); // começa no botão que não faz nada de irreversível
}

function fecharModal() {
  if (botaoConfirmar.disabled) return; // não fecha no meio da requisição
  modal.hidden = true;
  pedidoACancelar = null;
  botaoQueAbriu?.focus();
}

/** Trava os botões do modal enquanto a requisição de cancelamento está no ar. */
function ocupado(sim) {
  botaoConfirmar.disabled = sim;
  botaoVoltar.disabled = sim;
  botaoConfirmar.textContent = sim ? "Cancelando…" : "Cancelar pedido";
}

botaoConfirmar.addEventListener("click", async () => {
  ocupado(true);
  try {
    await api(`/ong/solicitacoes/${pedidoACancelar.id_doacao}/cancelar`, { metodo: "POST" });
    toast("Pedido cancelado.", "ok");
    botaoQueAbriu = document.getElementById("t-andamento"); // o card do botão vai sumir da lista
    ocupado(false);
    fecharModal();
    carregar();
  } catch (erro) {
    modalErro.innerHTML = `<p class="alerta alerta-erro">${esc(erro.message)}</p>`;
    ocupado(false);
  }
});

botaoVoltar.addEventListener("click", fecharModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) fecharModal(); // clique no fundo escuro, fora da caixa
});
document.addEventListener("keydown", (e) => {
  if (modal.hidden) return;
  if (e.key === "Escape") fecharModal();
  // Tab não sai do modal: do último botão volta para o primeiro (e vice-versa).
  if (e.key === "Tab") {
    const botoes = [...modal.querySelectorAll("button:not(:disabled)")];
    const primeiro = botoes[0];
    const ultimo = botoes[botoes.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }
});

// ----------------------------------------------------------------- eventos da lista
areaAndamento.addEventListener("click", (e) => {
  if (e.target.closest("[data-tentar]")) {
    areaAndamento.innerHTML = '<div class="esqueleto" style="height:180px"></div>';
    return carregar();
  }
  const botao = e.target.closest("[data-cancelar]");
  if (!botao) return;
  const pedido = pedidos.find((p) => p.id_doacao === Number(botao.dataset.cancelar));
  if (pedido) abrirModal(pedido, botao);
});

carregar();
