// Tela 6.5 do Figma (Meus pedidos).
// Filtros com contagem (Todos, Reservados, Retirados, Expirados, Cancelados),
// o destaque "Próxima retirada" e a lista de reservas com as ações de cada
// uma: ver detalhes, avaliar (5 estrelas) e reservar novamente.
// Dados: GET /api/reservas?status=  ·  avaliar: POST /api/reservas/{id}/avaliar
import { api, exigirLogin } from "/js/api.js";
import {
  STATUS_RESERVA, badge, data, dia, esc, estrelas, hora, imagem, montarRodape, montarTopo, moeda,
  parametros, toast, vazio,
} from "/js/ui.js";
import { abrirModal, diaComAno, ehHoje, gerarQrCode, horarioRetirada, mostrarErro, plural } from "/js/cliente.js";

exigirLogin("COMUM");
montarTopo("");
montarRodape();

// Um botão de filtro para cada status de reserva, com a mensagem de lista vazia
const FILTROS = [
  { status: "", texto: "Todos", vazio: ["Você ainda não fez nenhuma reserva", "Explore o catálogo e garanta sua primeira sacola."] },
  { status: "PENDENTE", texto: "Reservados", vazio: ["Nenhuma reserva ativa", "Quando você garantir uma sacola, ela aparece aqui."] },
  { status: "RETIRADA", texto: "Retirados", vazio: ["Nenhuma sacola retirada ainda", "Depois de retirar, você pode avaliar o pedido por aqui."] },
  { status: "NAO_COMPARECEU", texto: "Expirados", vazio: ["Nenhum pedido expirado", "Ótimo! Você retirou tudo o que reservou."] },
  { status: "CANCELADA", texto: "Cancelados", vazio: ["Nenhum pedido cancelado", ""] },
];

const areaFiltros = document.getElementById("filtros");
const areaLista = document.getElementById("lista");
const areaProxima = document.getElementById("proxima");

// O filtro pode vir no endereço: pedidos.html?status=RETIRADA
let filtro = parametros().get("status") || "";
if (!FILTROS.some((f) => f.status === filtro)) filtro = "";

let pedidos = [];    // reservas mostradas agora (para achar a reserva ao clicar em "Avaliar")
let ultimaBusca = 0; // número da busca mais recente (ver carregarLista)

// ----------------------------------------------------------------- filtros
function criarFiltros() {
  areaFiltros.innerHTML = FILTROS.map((f) => `
    <button class="chip" type="button" data-status="${f.status}" aria-pressed="${f.status === filtro}">
      ${f.texto} <span class="contagem"></span>
    </button>`).join("");
}

/** A API manda só os status que existem: {"PENDENTE": 2, "RETIRADA": 7}. O que falta é 0. */
function atualizarContagem(contagem) {
  const total = Object.values(contagem).reduce((soma, n) => soma + n, 0);
  areaFiltros.querySelectorAll(".chip").forEach((chip) => {
    const n = chip.dataset.status ? contagem[chip.dataset.status] || 0 : total;
    chip.querySelector(".contagem").textContent = `(${n})`;
  });
}

areaFiltros.addEventListener("click", (evento) => {
  const chip = evento.target.closest(".chip");
  if (!chip || chip.dataset.status === filtro) return;
  filtro = chip.dataset.status;
  areaFiltros.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
  history.replaceState(null, "", filtro ? `?status=${filtro}` : location.pathname);
  carregarLista();
});

// ----------------------------------------------------------------- um pedido da lista
/** "Hoje • retirada entre 18h e 19h30", "22 set 2026 • retirado às 18h42"... */
function linhaDaData(r) {
  if (r.status === "PENDENTE") {
    return `${dia(r.inicio_retirada)} • retirada entre ${hora(r.inicio_retirada)} e ${hora(r.fim_retirada)}`;
  }
  if (r.status === "RETIRADA") {
    const quando = r.data_retirada || r.fim_retirada;
    return `${diaComAno(quando)} • retirado às ${hora(quando)}`;
  }
  if (r.status === "NAO_COMPARECEU") return `${diaComAno(r.fim_retirada)} • retirada não realizada`;
  return `${diaComAno(r.inicio_retirada)} • reserva cancelada`;
}

function acoesDoPedido(r) {
  const nome = `<span class="sr-only"> de ${esc(r.sacola)}</span>`; // contexto para leitores de tela
  const detalhes = `<a class="link-acao" href="/reserva.html?id=${r.id_reserva}">Ver detalhes${nome} <span aria-hidden="true">→</span></a>`;

  if (r.status === "RETIRADA" && !r.avaliada) {
    return `<button class="link-acao" type="button" data-avaliar="${r.id_reserva}">Avaliar pedido${nome} <span aria-hidden="true">→</span></button>${detalhes}`;
  }
  if (r.status === "RETIRADA") {
    return `<span class="avaliado" tabindex="-1">Avaliado ${estrelas(r.nota)}</span>${detalhes}`;
  }
  if (r.status === "NAO_COMPARECEU" || r.status === "CANCELADA") {
    return `<a class="link-acao secundario" href="/catalogo.html?estabelecimento=${r.id_estabelecimento}">Reservar novamente${nome}</a>${detalhes}`;
  }
  return detalhes;
}

function itemPedido(r) {
  const hoje = r.status === "PENDENTE" && ehHoje(r.inicio_retirada);
  return `
    <article class="pedido" data-id="${r.id_reserva}">
      <img class="pedido-foto" src="${imagem(r.foto)}" alt="" loading="lazy">
      <div class="pedido-info">
        <div class="pedido-titulo">
          <h3>${esc(r.sacola)}</h3>
          ${badge(STATUS_RESERVA, r.status)}
          ${hoje ? `<span class="badge badge-laranja">Hoje</span>` : ""}
        </div>
        <span class="pedido-loja">${esc(r.estabelecimento)}</span>
        <span class="sutil">${linhaDaData(r)}</span>
      </div>
      <div class="pedido-lado">
        <div>
          <strong class="pedido-valor">${moeda(r.valor_pago)}</strong>
          ${r.quantidade > 1 ? `<div class="sutil">${plural(r.quantidade, "sacola", "sacolas")}</div>` : ""}
        </div>
        <div class="pedido-acoes">${acoesDoPedido(r)}</div>
      </div>
    </article>`;
}

// ----------------------------------------------------------------- lista
async function carregarLista() {
  // Se a pessoa trocar de filtro antes da resposta chegar, a resposta antiga é ignorada
  const estaBusca = ++ultimaBusca;
  areaLista.setAttribute("aria-busy", "true");
  areaLista.innerHTML = `<div class="esqueleto" style="height: 126px"></div>`.repeat(3);
  try {
    const d = await api("/reservas", { params: { status: filtro } });
    if (estaBusca !== ultimaBusca) return;
    pedidos = d.itens;
    atualizarContagem(d.contagem);
    if (pedidos.length) {
      areaLista.innerHTML = pedidos.map(itemPedido).join("");
    } else {
      const [titulo, texto] = FILTROS.find((f) => f.status === filtro).vazio;
      areaLista.innerHTML = vazio(titulo, texto, `<a class="btn btn-primario" href="/catalogo.html">Ver catálogo</a>`);
    }
  } catch (erro) {
    if (estaBusca === ultimaBusca) mostrarErro(areaLista, erro.message);
  } finally {
    if (estaBusca === ultimaBusca) areaLista.setAttribute("aria-busy", "false");
  }
}

areaLista.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-avaliar]");
  if (!botao) return;
  const reserva = pedidos.find((p) => p.id_reserva === Number(botao.dataset.avaliar));
  if (reserva) abrirAvaliacao(reserva);
});

// ----------------------------------------------------------------- próxima retirada
async function carregarProxima() {
  try {
    // Busca só as reservas ativas, assim o destaque não depende do filtro escolhido
    const d = await api("/reservas", { params: { status: "PENDENTE" } });
    const proxima = [...d.itens].sort((a, b) => data(a.inicio_retirada) - data(b.inicio_retirada))[0];

    if (!proxima) {
      areaProxima.innerHTML = `
        <h2 id="t-proxima">Próxima retirada</h2>
        <p class="muted">Nenhuma retirada agendada. Que tal garantir uma sacola hoje?</p>
        <a class="btn btn-primario btn-bloco" href="/catalogo.html">Ver catálogo</a>`;
      return;
    }
    areaProxima.innerHTML = `
      <div class="card-titulo">
        <h2 id="t-proxima">Próxima retirada</h2>
        ${ehHoje(proxima.inicio_retirada) ? `<span class="badge badge-laranja-claro">Hoje</span>` : ""}
      </div>
      <div class="qr" id="qr-proxima" role="img" aria-label="QR Code da reserva ${esc(proxima.codigo_retirada)}"></div>
      <p class="codigo">#${esc(proxima.codigo_retirada)}</p>
      <strong class="proxima-nome">${esc(proxima.sacola)}</strong>
      <span class="pedido-loja">${esc(proxima.estabelecimento)}</span>
      <span class="sutil">${horarioRetirada(proxima.inicio_retirada, proxima.fim_retirada)}</span>
      <a class="btn btn-contorno btn-bloco" href="/reserva.html?id=${proxima.id_reserva}">Ver reserva completa</a>`;
    gerarQrCode(document.getElementById("qr-proxima"), proxima.codigo_retirada, 132);
  } catch (erro) {
    areaProxima.innerHTML = `<h2 id="t-proxima">Próxima retirada</h2><p class="muted">${esc(erro.message)}</p>`;
  }
}

// ----------------------------------------------------------------- avaliar
function abrirAvaliacao(r) {
  let nota = 0;
  const { modal, fechar } = abrirModal(`
    <div>
      <h2 id="modal-titulo">Avaliar pedido</h2>
      <p class="muted">${esc(r.sacola)} • ${esc(r.estabelecimento)}</p>
    </div>
    <form novalidate>
      <div class="campo">
        <span class="label" id="rotulo-nota">Sua nota</span>
        <div class="estrelas-escolha" role="group" aria-labelledby="rotulo-nota">
          ${[1, 2, 3, 4, 5].map((n) => `
            <button class="estrela" type="button" data-nota="${n}" aria-pressed="false"
                    aria-label="${n} ${n === 1 ? "estrela" : "estrelas"}">★</button>`).join("")}
        </div>
      </div>
      <div class="campo">
        <label for="comentario">Comentário (opcional)</label>
        <textarea class="entrada" id="comentario" maxlength="500"
                  placeholder="Conte como foi a sacola e a retirada"></textarea>
      </div>
      <div id="modal-erro"></div>
      <div class="modal-acoes">
        <button class="btn btn-contorno" type="button" data-fechar>Cancelar</button>
        <button class="btn btn-primario" type="submit" disabled>Enviar avaliação</button>
      </div>
    </form>`);

  const form = modal.querySelector("form");
  const enviar = form.querySelector("[type=submit]");
  const botoesEstrela = modal.querySelectorAll(".estrela");

  /** Acende as estrelas de 1 até `ate`. */
  function pintar(ate) {
    botoesEstrela.forEach((b) => b.classList.toggle("acesa", Number(b.dataset.nota) <= ate));
  }

  botoesEstrela.forEach((botao) => {
    botao.addEventListener("click", () => {
      nota = Number(botao.dataset.nota);
      botoesEstrela.forEach((b) => b.setAttribute("aria-pressed", String(b === botao)));
      pintar(nota);
      enviar.disabled = false;
    });
    // Ao passar o mouse, mostra a nota que seria escolhida
    botao.addEventListener("mouseenter", () => pintar(Number(botao.dataset.nota)));
    botao.addEventListener("mouseleave", () => pintar(nota));
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!nota) return;
    const botoes = modal.querySelectorAll("button");
    botoes.forEach((b) => { b.disabled = true; });
    enviar.textContent = "Enviando…";
    modal.setAttribute("aria-busy", "true");
    try {
      const comentario = form.querySelector("#comentario").value.trim();
      await api(`/reservas/${r.id_reserva}/avaliar`, {
        metodo: "POST",
        corpo: { nota, comentario: comentario || null },
      });
      r.avaliada = true;
      r.nota = nota;
      modal.removeAttribute("aria-busy");
      fechar();
      // Troca só este pedido na lista: agora ele mostra "Avaliado ★★★★★"
      const item = areaLista.querySelector(`[data-id="${r.id_reserva}"]`);
      item.outerHTML = itemPedido(r);
      areaLista.querySelector(`[data-id="${r.id_reserva}"] .avaliado`)?.focus();
      toast("Obrigado pela avaliação!", "ok");
    } catch (erro) {
      modal.removeAttribute("aria-busy");
      modal.querySelector("#modal-erro").innerHTML =
        `<div class="alerta alerta-erro" role="alert"><p>${esc(erro.message)}</p></div>`;
      botoes.forEach((b) => { b.disabled = false; });
      enviar.textContent = "Enviar avaliação";
    }
  });
}

// ----------------------------------------------------------------- início
criarFiltros();
carregarLista();
carregarProxima();
