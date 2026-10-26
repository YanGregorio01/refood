// Doações do comerciante (tela nova, sem desenho no Figma; fluxo em docs/API.md).
// (a) A loja publica uma oferta (POST /api/painel/doacoes/ofertas) e vê as suas
//     ofertas (GET .../ofertas), podendo encerrar uma delas.
// (b) A loja responde aos pedidos das ONGs (GET .../solicitacoes):
//     confirmar, recusar ou marcar como entregue.
import { api, exigirLogin } from "/js/api.js";
import {
  STATUS_DOACAO, STATUS_OFERTA, badge, diaHora, esc, kg, montarPainel, mostrarErrosDoFormulario, numero, toast, vazio,
} from "/js/ui.js";
import {
  confirmar, dataISO, enquantoEspera, esqueletos, localDaLoja, momento, mostrarErro,
} from "/js/painel-comum.js";

const conta = exigirLogin("ESTABELECIMENTO");
montarPainel(conta, "doacoes", await localDaLoja());

// ================================================================ (a) nova oferta
const form = document.getElementById("form-oferta");
const erroOferta = document.getElementById("erro-oferta");

/** Padrão do "Disponível até": hoje às 21h (se já passou das 21h, amanhã às 21h). */
function preencherPadrao() {
  form.reset();
  const limite = new Date();
  if (limite.getHours() >= 21) limite.setDate(limite.getDate() + 1);
  form.elements.disponivel_ate.value = `${dataISO(limite)}T21:00`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const valor = (nome) => form.elements[nome].value.trim();
  const limite = valor("disponivel_ate"); // o campo dá "2026-10-16T21:00"; a API usa "2026-10-16T21:00:00"
  const corpo = {
    tipo_alimento: valor("tipo_alimento"),
    quantidade_kg: Number(valor("quantidade_kg")),
    disponivel_ate: limite.length === 16 ? `${limite}:00` : limite,
    observacoes: valor("observacoes") || null,
  };
  const botao = form.querySelector('button[type="submit"]');
  mostrarErrosDoFormulario(form, { campos: {} }); // limpa erros antigos
  erroOferta.hidden = true;
  try {
    await enquantoEspera(botao, () => api("/painel/doacoes/ofertas", { metodo: "POST", corpo }));
    toast("Oferta publicada! As ONGs já podem ver no mapa de doações.", "ok");
    preencherPadrao();
    carregarOfertas();
  } catch (erro) {
    mostrarErrosDoFormulario(form, erro);
    erroOferta.textContent = erro.message;
    erroOferta.hidden = false;
  }
});

// ================================================================ (a) suas ofertas
const listaOfertas = document.getElementById("lista-ofertas");
let ofertas = [];

async function carregarOfertas() {
  listaOfertas.innerHTML = esqueletos(2, 84);
  try {
    ofertas = await api("/painel/doacoes/ofertas");
  } catch (erro) {
    mostrarErro(listaOfertas, erro, carregarOfertas);
    return;
  }
  if (!ofertas.length) {
    listaOfertas.innerHTML = vazio("Nenhuma oferta por enquanto.", "Publique o que sobrou no formulário acima.");
    return;
  }
  listaOfertas.innerHTML = ofertas.map(itemDaOferta).join("");
}

function itemDaOferta(o) {
  const pendentes = Number(o.pedidos_pendentes);
  const prazo = o.status === "ATIVA"
    ? `${kg(o.quantidade_kg)} ainda disponíveis · até ${momento(o.disponivel_ate)}`
    : `Ficou no mapa até ${momento(o.disponivel_ate)}`;
  return `
    <article class="item oferta">
      <div class="item-corpo">
        <div class="linha-titulo"><strong>${esc(o.tipo_alimento)}</strong>${badge(STATUS_OFERTA, o.status)}</div>
        <span class="muted">${prazo}</span>
        <span class="sutil">${kg(o.kg_pedidos)} já pedidos pelas ONGs</span>
        ${pendentes ? `<span><span class="badge badge-laranja-claro">${pendentes} ${pendentes === 1 ? "pedido aguardando" : "pedidos aguardando"}</span></span>` : ""}
        ${o.observacoes ? `<p class="obs">${esc(o.observacoes)}</p>` : ""}
      </div>
      ${o.status === "ATIVA" ? `
        <button type="button" class="btn btn-contorno btn-pequeno" data-encerrar="${o.id_oferta}">
          Encerrar<span class="sr-only"> oferta de ${esc(o.tipo_alimento)}</span>
        </button>` : ""}
    </article>`;
}

listaOfertas.addEventListener("click", async (e) => {
  const botao = e.target.closest("[data-encerrar]");
  if (!botao) return;
  const oferta = ofertas.find((o) => o.id_oferta === Number(botao.dataset.encerrar));
  const ok = await confirmar({
    titulo: "Encerrar oferta?",
    texto: `A oferta de ${oferta.tipo_alimento} sai do mapa de doações e as ONGs não conseguem mais pedir. `
      + "Os pedidos já feitos continuam aqui para você responder.",
    botao: "Encerrar oferta",
    perigo: true,
  });
  if (!ok) return;
  try {
    const resposta = await enquantoEspera(botao,
      () => api(`/painel/doacoes/ofertas/${oferta.id_oferta}/encerrar`, { metodo: "POST" }));
    toast(resposta.mensagem, "ok");
    recarregarTudo();
  } catch (erro) {
    toast(erro.message, "erro");
  }
});

// ================================================================ (b) pedidos das ONGs
const listaPedidos = document.getElementById("lista-solicitacoes");
let pedidos = [];

async function carregarSolicitacoes() {
  listaPedidos.innerHTML = esqueletos(2, 120);
  try {
    pedidos = await api("/painel/doacoes/solicitacoes");
  } catch (erro) {
    mostrarErro(listaPedidos, erro, carregarSolicitacoes);
    return;
  }
  if (!pedidos.length) {
    listaPedidos.innerHTML = vazio("Nenhum pedido de ONG por enquanto.",
      "Quando uma ONG pedir parte de uma oferta sua, o pedido aparece aqui.");
    return;
  }
  listaPedidos.innerHTML = pedidos.map(itemDoPedido).join("");
}

/** Botões de cada pedido, conforme o status (PENDENTE e CONFIRMADA têm ação; os outros, não). */
function acoesDoPedido(p) {
  const id = p.id_doacao;
  const quem = `<span class="sr-only"> o pedido de ${esc(p.ong)}</span>`;
  const recusar = `<button type="button" class="btn btn-perigo btn-pequeno" data-acao="recusar" data-id="${id}">Recusar${quem}</button>`;
  if (p.status === "PENDENTE") {
    return `<button type="button" class="btn btn-primario btn-pequeno" data-acao="confirmar" data-id="${id}">Confirmar${quem}</button>${recusar}`;
  }
  if (p.status === "CONFIRMADA") {
    return `<button type="button" class="btn btn-primario btn-pequeno" data-acao="entregar" data-id="${id}">Marcar como entregue${quem}</button>${recusar}`;
  }
  return "";
}

function itemDoPedido(p) {
  const telefone = p.telefone
    ? ` · <a href="tel:${esc(p.telefone.replace(/\D/g, ""))}">${esc(p.telefone)}</a>` : "";
  const acoes = acoesDoPedido(p);
  return `
    <article class="item pedido-ong">
      <div class="item-corpo">
        <div class="linha-titulo"><strong>${esc(p.ong)}</strong>${badge(STATUS_DOACAO, p.status)}</div>
        <span class="muted">Responsável: ${esc(p.responsavel || "não informado")}${telefone}</span>
        <span>${esc(p.tipo_alimento)} · ${kg(p.quantidade_kg)} · ≈ ${numero(p.refeicoes)} refeições</span>
        <span class="sutil">Retirada: ${diaHora(p.data_retirada)}</span>
        ${p.observacoes ? `<p class="obs">“${esc(p.observacoes)}”</p>` : ""}
      </div>
      ${acoes ? `<div class="item-acoes">${acoes}</div>` : ""}
    </article>`;
}

// Mensagem de sucesso de cada ação
const SUCESSO = {
  confirmar: "Pedido confirmado. A ONG já pode buscar no horário combinado.",
  recusar: "Pedido recusado. Os quilos voltaram para a sua oferta.",
  entregar: "Doação marcada como entregue. Obrigado por doar!",
};

listaPedidos.addEventListener("click", async (e) => {
  const botao = e.target.closest("[data-acao]");
  if (!botao) return;
  const { acao } = botao.dataset;
  const pedido = pedidos.find((p) => p.id_doacao === Number(botao.dataset.id));

  // Recusar não tem volta: pergunta antes.
  if (acao === "recusar") {
    const ok = await confirmar({
      titulo: "Recusar pedido?",
      texto: `O pedido de ${kg(pedido.quantidade_kg)} de ${pedido.ong} será recusado e os quilos voltam para a sua oferta.`,
      botao: "Recusar pedido",
      perigo: true,
    });
    if (!ok) return;
  }

  // Desabilita os botões do pedido enquanto a API responde
  const botoesDoPedido = botao.closest(".item").querySelectorAll("button");
  botoesDoPedido.forEach((b) => { b.disabled = true; });
  try {
    await api(`/painel/doacoes/solicitacoes/${pedido.id_doacao}/${acao}`, { metodo: "POST" });
    toast(SUCESSO[acao], "ok");
    recarregarTudo(); // os kg da oferta também mudam
  } catch (erro) {
    toast(erro.message, "erro");
    botoesDoPedido.forEach((b) => { b.disabled = false; });
  }
});

// ================================================================ início
function recarregarTudo() {
  carregarOfertas();
  carregarSolicitacoes();
}

preencherPadrao();
recarregarTudo();
