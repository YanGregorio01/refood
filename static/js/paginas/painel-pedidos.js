// Gestão de pedidos (tela 6.8 do Figma; no celular, tela 3.3).
// Lista as reservas da loja (GET /api/painel/reservas) com filtros de período
// e status, e confirma a retirada pelo código que o cliente mostra
// (POST /api/painel/reservas/confirmar-retirada), pela lista ou digitando.
import { api, exigirLogin } from "/js/api.js";
import { STATUS_RESERVA, badge, data, esc, moeda, montarPainel, numero, toast, vazio } from "/js/ui.js";
import {
  diaEFaixa, enquantoEspera, esqueletos, inicial, localDaLoja, momento, mostrarErro,
} from "/js/painel-comum.js";

const conta = exigirLogin("ESTABELECIMENTO");
montarPainel(conta, "pedidos", await localDaLoja());

const lista = document.getElementById("lista-pedidos");
const botaoMais = document.getElementById("mais-pedidos");
const POR_PAGINA = 20;

// Título da lista para cada filtro de status
const TITULOS = {
  "": "Reservas ativas",
  PENDENTE: "Aguardando retirada",
  RETIRADA: "Retiradas",
  NAO_COMPARECEU: "Expiradas",
  CANCELADA: "Canceladas",
};

let filtros = { periodo: "hoje", status: "" };
let reservas = [];
let mostrando = POR_PAGINA;

// ================================================================ lista
async function carregarReservas() {
  lista.innerHTML = esqueletos(3, 84);
  botaoMais.hidden = true;
  document.getElementById("t-lista").textContent = TITULOS[filtros.status];
  document.getElementById("contagem").textContent = "";
  try {
    const resposta = await api("/painel/reservas", { params: filtros });
    // Os contadores do topo valem para a loja toda, sem depender dos filtros.
    document.getElementById("c-aguardando").textContent = numero(resposta.aguardando);
    document.getElementById("c-retirados").textContent = numero(resposta.retirados_hoje);
    document.getElementById("c-valor").textContent = moeda(resposta.valor_em_reservas);
    reservas = resposta.itens;
    mostrando = POR_PAGINA;
    mostrarReservas();
  } catch (erro) {
    document.querySelectorAll(".contador strong").forEach((el) => { el.textContent = "—"; });
    mostrarErro(lista, erro, carregarReservas);
  }
}

function mostrarReservas() {
  const total = reservas.length;
  document.getElementById("contagem").textContent = `${total} ${total === 1 ? "reserva" : "reservas"}`;
  if (!total) {
    lista.innerHTML = vazio("Nenhuma reserva por aqui.", "Troque o período ou o status para ver outras reservas.");
    return;
  }
  lista.innerHTML = reservas.slice(0, mostrando).map(itemDaReserva).join("");
  botaoMais.hidden = total <= mostrando;
}

function itemDaReserva(r) {
  const agora = new Date();
  // Dentro do horário de retirada o botão fica cheio (verde), como no Figma.
  const noHorario = data(r.inicio_retirada) <= agora && agora <= data(r.fim_retirada);
  const retirado = r.status === "RETIRADA" && r.data_retirada ? ` • retirado ${momento(r.data_retirada)}` : "";
  return `
    <article class="item pedido">
      <span class="avatar" aria-hidden="true">${inicial(r.cliente)}</span>
      <div class="item-corpo">
        <strong>${esc(r.cliente)}</strong>
        <span class="muted">${esc(r.sacola)}${r.quantidade > 1 ? ` ×${r.quantidade}` : ""}</span>
        <span class="sutil">${diaEFaixa(r.inicio_retirada, r.fim_retirada)} • #${esc(r.codigo_retirada)}${retirado}</span>
      </div>
      ${badge(STATUS_RESERVA, r.status)}
      ${r.status === "PENDENTE" ? `
        <button type="button" class="btn ${noHorario ? "btn-primario" : "btn-contorno"}" data-codigo="${esc(r.codigo_retirada)}">
          Confirmar retirada<span class="sr-only"> de ${esc(r.cliente)}</span>
        </button>` : ""}
    </article>`;
}

botaoMais.addEventListener("click", () => {
  mostrando += POR_PAGINA;
  mostrarReservas();
});

/** Usada pelos dois jeitos de confirmar: o botão da lista e o código digitado. */
function confirmarRetirada(codigo) {
  return api("/painel/reservas/confirmar-retirada", { metodo: "POST", corpo: { codigo } });
}

// Botão "Confirmar retirada" de cada linha da lista
lista.addEventListener("click", async (e) => {
  const botao = e.target.closest("[data-codigo]");
  if (!botao) return;
  try {
    const resposta = await enquantoEspera(botao, () => confirmarRetirada(botao.dataset.codigo));
    toast(resposta.mensagem, "ok");
    carregarReservas();
  } catch (erro) {
    toast(erro.message, "erro");
  }
});

// ================================================================ filtros
/** Marca o chip escolhido do grupo (aria-pressed="true") e desmarca os outros. */
function marcarChip(seletor, escolhido) {
  document.querySelectorAll(seletor).forEach((chip) => chip.setAttribute("aria-pressed", String(chip === escolhido)));
}

document.querySelectorAll("[data-periodo]").forEach((chip) => {
  chip.addEventListener("click", () => {
    filtros.periodo = chip.dataset.periodo;
    marcarChip("[data-periodo]", chip);
    carregarReservas();
  });
});

document.querySelectorAll("[data-status]").forEach((chip) => {
  chip.addEventListener("click", () => {
    filtros.status = chip.dataset.status;
    marcarChip("[data-status]", chip);
    carregarReservas();
  });
});

// "Histórico de pedidos" = últimos 30 dias, todos os status
document.getElementById("b-historico").addEventListener("click", () => {
  filtros = { periodo: "mes", status: "" };
  marcarChip("[data-periodo]", document.querySelector('[data-periodo="mes"]'));
  marcarChip("[data-status]", document.querySelector('[data-status=""]'));
  carregarReservas();
});

// ================================================================ código digitado
const formCodigo = document.getElementById("form-codigo");
const resultado = document.getElementById("resultado-codigo");

formCodigo.addEventListener("submit", async (e) => {
  e.preventDefault();
  const codigo = formCodigo.elements.codigo.value.trim(); // a API aceita "24098", "RF-24098" ou "#RF-24098"
  const botao = formCodigo.querySelector('button[type="submit"]');
  resultado.innerHTML = "";
  try {
    const resposta = await enquantoEspera(botao, () => confirmarRetirada(codigo));
    resultado.innerHTML = `<p class="alerta alerta-ok">${esc(resposta.mensagem)}</p>`;
    formCodigo.reset();
    carregarReservas();
  } catch (erro) {
    resultado.innerHTML = `<p class="alerta alerta-erro">${esc(erro.message)}</p>`;
  }
});

carregarReservas();
