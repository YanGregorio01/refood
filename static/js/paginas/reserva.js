// Tela 6.4 do Figma (Reserva confirmada).
// Mostra uma reserva (reserva.html?id=ID_DA_RESERVA) com o QR Code e o código
// de retirada, os detalhes e as ações: meus pedidos, como chegar e cancelar.
// Vindo do checkout (&nova=1), o título comemora a reserva nova.
// Dados: GET /api/reservas/{id}; cancelar: POST /api/reservas/{id}/cancelar
import { api, exigirLogin } from "/js/api.js";
import {
  STATUS_RESERVA, badge, data, esc, hora, icone, montarRodape, montarTopo, moeda, parametros, toast,
} from "/js/ui.js";
import {
  FORMAS_PAGAMENTO, abrirModal, diaNaFrase, enderecoCompleto, gerarQrCode, horarioRetirada,
  iconeCliente, linkComoChegar, mostrarErro, plural,
} from "/js/cliente.js";

exigirLogin("COMUM");
montarTopo("");
montarRodape();

const idReserva = parametros().get("id");
const nova = parametros().get("nova") === "1";
const areaDetalhes = document.getElementById("detalhes");
const areaCodigo = document.getElementById("codigo");

/**
 * GET /api/reservas/{id} não marca como expiradas as reservas vencidas (só a
 * lista de pedidos faz isso). Se o prazo de retirada já passou, a tela trata a
 * reserva como expirada.
 */
function statusNaTela(r) {
  if (r.status === "PENDENTE" && data(r.data_limite_retirada) <= new Date()) return "NAO_COMPARECEU";
  return r.status;
}

/** Frase embaixo do título, conforme a situação da reserva. */
function textoDoTopo(r, status) {
  if (status === "PENDENTE" && nova) {
    return "Sua sacola está garantida. Apresente o código no estabelecimento durante a retirada.";
  }
  if (status === "PENDENTE") return "Apresente o código no estabelecimento durante o horário de retirada.";
  if (status === "RETIRADA") {
    const quando = r.data_retirada || r.fim_retirada;
    return `Você retirou esta sacola ${diaNaFrase(quando)} às ${hora(quando)}. Obrigado por salvar comida!`;
  }
  if (status === "CANCELADA") return "Esta reserva foi cancelada e a sacola voltou para o catálogo.";
  return "O horário de retirada terminou e a sacola não foi retirada.";
}

// ----------------------------------------------------------------- mostrar na tela
function mostrar(r) {
  const status = statusNaTela(r);
  const pendente = status === "PENDENTE";
  document.title = `Reserva ${r.codigo_retirada} | Refood`;

  areaDetalhes.innerHTML = `
    <span class="selo-icone">${pendente ? iconeCliente("check") : icone("sacola")}</span>
    <div class="detalhes-topo">
      <h1 id="titulo" tabindex="-1">${pendente && nova ? "Reserva confirmada!" : "Sua reserva"}</h1>
      <p class="muted">${textoDoTopo(r, status)}</p>
    </div>
    <dl class="linhas">
      <div><dt>Sacola</dt><dd>${esc(r.sacola)}</dd></div>
      <div><dt>Quantidade</dt><dd>${plural(r.quantidade, "sacola", "sacolas")}</dd></div>
      <div><dt>Estabelecimento</dt><dd><a href="/estabelecimento.html?id=${r.id_estabelecimento}">${esc(r.estabelecimento)}</a></dd></div>
      <div><dt>Total pago</dt><dd>${moeda(r.valor_pago)}</dd></div>
      <div><dt>Forma de pagamento</dt><dd>${esc(FORMAS_PAGAMENTO[r.forma_pagamento] || r.forma_pagamento)}</dd></div>
      <div><dt>Retirada</dt><dd>${horarioRetirada(r.inicio_retirada, r.fim_retirada)}</dd></div>
    </dl>
    ${pendente ? `
      <p class="aviso-retirada">${iconeCliente("relogio")}
        Retirada ${diaNaFrase(r.inicio_retirada)}, entre ${hora(r.inicio_retirada)} e ${hora(r.fim_retirada)}.</p>` : ""}`;

  // Reserva ativa mostra "Ativo"; as outras, o texto do status ("Retirado", "Cancelado"...)
  const etiqueta = pendente ? `<span class="badge">Ativo</span>` : badge(STATUS_RESERVA, status);
  areaCodigo.innerHTML = `
    <div class="card-titulo">
      <h2 id="t-codigo">Código para retirada</h2>
      ${etiqueta}
    </div>
    <div class="qr ${pendente ? "" : "qr-inativo"}" id="qr" role="img"
         aria-label="QR Code da reserva ${esc(r.codigo_retirada)}"></div>
    <p class="codigo-grande"><span class="rotulo">Reserva</span><strong>#${esc(r.codigo_retirada)}</strong></p>
    <p class="codigo-ajuda">${pendente
      ? "Mostre este código à equipe do estabelecimento."
      : "Este código não vale mais para retirada."}</p>
    <div class="codigo-loja">
      <strong>${iconeCliente("loja")}${esc(r.estabelecimento)}</strong>
      <span class="sutil">${esc(enderecoCompleto(r))}</span>
    </div>
    <div class="acoes">
      <a class="btn btn-primario btn-bloco" href="${linkComoChegar(r.latitude, r.longitude)}" target="_blank" rel="noopener">
        Como chegar <span class="sr-only">(abre o mapa em outra aba)</span>
      </a>
      <a class="btn btn-contorno btn-bloco" href="/pedidos.html">Acessar meus pedidos</a>
      ${pendente ? `<button class="btn btn-perigo btn-bloco" type="button" id="cancelar">Cancelar reserva</button>` : ""}
    </div>`;

  gerarQrCode(document.getElementById("qr"), r.codigo_retirada);
  document.getElementById("cancelar")?.addEventListener("click", () => perguntarCancelamento(r));
}

// ----------------------------------------------------------------- cancelar
function perguntarCancelamento(r) {
  const { modal, fechar } = abrirModal(`
    <h2 id="modal-titulo">Cancelar reserva?</h2>
    <p class="muted">A sacola "${esc(r.sacola)}" volta para o catálogo e outra pessoa poderá reservá-la.
      Não dá para desfazer.</p>
    <div id="modal-erro"></div>
    <div class="modal-acoes">
      <button class="btn btn-contorno" type="button" data-fechar>Manter reserva</button>
      <button class="btn btn-perigo" type="button" data-confirmar>Sim, cancelar</button>
    </div>`);

  const confirmar = modal.querySelector("[data-confirmar]");
  const botoes = modal.querySelectorAll("button");

  confirmar.addEventListener("click", async () => {
    botoes.forEach((b) => { b.disabled = true; });
    confirmar.textContent = "Cancelando…";
    modal.setAttribute("aria-busy", "true");
    try {
      const atualizada = await api(`/reservas/${r.id_reserva}/cancelar`, { metodo: "POST" });
      modal.removeAttribute("aria-busy");
      fechar();
      mostrar(atualizada);
      document.getElementById("titulo").focus(); // leitores de tela anunciam a nova situação
      toast("Reserva cancelada.", "ok");
    } catch (erro) {
      modal.removeAttribute("aria-busy");
      modal.querySelector("#modal-erro").innerHTML =
        `<div class="alerta alerta-erro" role="alert"><p>${esc(erro.message)}</p></div>`;
      botoes.forEach((b) => { b.disabled = false; });
      confirmar.textContent = "Sim, cancelar";
    }
  });
}

// ----------------------------------------------------------------- carregar
async function carregar() {
  const erro = document.getElementById("erro");
  const linkPedidos = `<a class="btn btn-contorno btn-pequeno" href="/pedidos.html">Ver meus pedidos</a>`;
  if (!idReserva) {
    document.getElementById("reserva").hidden = true;
    mostrarErro(erro, "Nenhuma reserva foi informada.", linkPedidos);
    return;
  }
  try {
    mostrar(await api(`/reservas/${encodeURIComponent(idReserva)}`));
  } catch (e) {
    document.getElementById("reserva").hidden = true;
    mostrarErro(erro, e.message, e.status === 404 ? linkPedidos : "");
  }
}

carregar();
