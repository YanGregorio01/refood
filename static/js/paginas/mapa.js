// Tela 5.3 do Figma (Mapa interativo): as lojas parceiras num mapa Leaflet,
// com busca, filtro de distância e de tipo, e o painel "Estabelecimento
// selecionado". O botão Mapa/Lista troca o mapa por cartões das lojas.
import { api } from "/js/api.js";
import {
  dia, distancia, esc, hora, icone, imagem, localizacao, montarRodape, montarTopo, numero, TIPOS_LOJA, toast, vazio,
} from "/js/ui.js";

montarTopo("mapa");
montarRodape();

const PINHEIROS = { lat: -23.5672, lng: -46.6937 };

// Desenho (SVG) que vai dentro do pino de cada tipo de loja.
const SVG = (caminhos) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${caminhos}</svg>`;
const DESENHO_TIPO = {
  MERCADO: SVG('<path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>'),
  PADARIA: SVG('<path d="M5 11a7 4.5 0 0 1 14 0v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7z"/><path d="M9.5 9v3M14.5 9v3"/>'),
  RESTAURANTE: SVG('<path d="M7 3v18M4 3v5a3 3 0 0 0 6 0V3"/><path d="M18 21V3c-2 0-4 3-4 7v4h4"/>'),
  HORTIFRUTI: SVG('<path d="M12 8C8 5.5 4 8.5 5 13.5s4 7.5 7 5.5c3 2 6-.5 7-5.5S16 5.5 12 8z"/><path d="M12 8c0-2.5 1-4 3.5-5"/>'),
  CAFE: SVG('<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8.5 3v3M12.5 3v3"/>'),
};

// Estado da página: o que está filtrado e o que está na tela.
const filtros = { busca: "", raio: null, tipo: "" };
let usuario = PINHEIROS; // de onde medimos as distâncias
let lojas = [];
let selecionadaId = null;
let pedidoAtual = 0; // número da última busca; respostas de buscas antigas são ignoradas

let mapa;
let camadaLojas;
let circuloRaio;
const marcadores = new Map(); // id da loja -> marcador do Leaflet

const painel = document.getElementById("loja-selecionada");
const lista = document.getElementById("lista-lojas");

// ----------------------------------------------------------------- ajudantes
const corDoTipo = (tipo) => `cor-${(tipo || "OUTRO").toLowerCase()}`;
const nomeDoTipo = (tipo) => TIPOS_LOJA[tipo] || TIPOS_LOJA.OUTRO;

/** "hoje", "amanhã" ou "em 18 out", para a frase da retirada recomendada. */
function quando(iso) {
  const d = dia(iso);
  return d === "Hoje" || d === "Amanhã" ? d.toLowerCase() : `em ${d}`;
}

function textoAvaliacoes(loja) {
  if (!loja.total_avaliacoes) return "Sem avaliações ainda";
  const plural = loja.total_avaliacoes === 1 ? "avaliação" : "avaliações";
  return `<span class="estrelas" aria-hidden="true">★</span> ${numero(loja.nota_media, 1)} (${loja.total_avaliacoes} ${plural})`;
}

const enderecoCompleto = (l) => [l.endereco, [l.bairro, l.cidade].filter(Boolean).join(", ")].filter(Boolean).join(" - ");
const etiquetaTipo = (l) => `<span class="badge badge-laranja-claro">${esc(nomeDoTipo(l.tipo))} • ${distancia(l.distancia_m)}</span>`;

// ----------------------------------------------------------------- mapa
function criarMapa() {
  mapa = L.map("mapa", { zoomControl: false }).setView([usuario.lat, usuario.lng], 15);
  L.control.zoom({ position: "bottomright", zoomInTitle: "Aproximar", zoomOutTitle: "Afastar" }).addTo(mapa);
  // Mapa do OpenStreetMap: grátis e sem chave (as cores ficam suaves pelo CSS .leaflet-tile-pane)
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(mapa);
  camadaLojas = L.layerGroup().addTo(mapa);
}

function marcarVoce() {
  const bolinha = L.divIcon({ className: "", html: '<span class="voce"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
  L.marker([usuario.lat, usuario.lng], { icon: bolinha, interactive: false, keyboard: false })
    .bindTooltip("Você está aqui", { permanent: true, direction: "top", offset: [0, -12] })
    .addTo(mapa);
}

function iconeDaLoja(loja, ativa) {
  const classes = ["pino", corDoTipo(loja.tipo)];
  if (!loja.sacolas_disponiveis) classes.push("pino-apagado");
  if (ativa) classes.push("pino-ativo");
  return L.divIcon({
    className: "",
    html: `<span class="${classes.join(" ")}">${DESENHO_TIPO[loja.tipo] || icone("sacola")}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function desenharPinos() {
  camadaLojas.clearLayers();
  marcadores.clear();
  for (const loja of lojas) {
    const sacolas = loja.sacolas_disponiveis
      ? `${loja.sacolas_disponiveis} sacola${loja.sacolas_disponiveis > 1 ? "s" : ""}`
      : "sem sacolas agora";
    const marcador = L.marker([loja.latitude, loja.longitude], {
      icon: iconeDaLoja(loja, loja.id_estabelecimento === selecionadaId),
      title: `${loja.nome}: ${sacolas}`, // vira o nome do pino para leitores de tela
    }).addTo(camadaLojas);
    marcador.on("click", () => selecionar(loja.id_estabelecimento, { rolar: true }));
    // O Leaflet deixa o pino focável pelo Tab; aqui o Enter passa a selecioná-lo.
    marcador.getElement()?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selecionar(loja.id_estabelecimento);
      }
    });
    marcadores.set(loja.id_estabelecimento, marcador);
  }
}

/** Desenha (ou tira) o círculo do raio escolhido em volta de quem busca. */
function desenharRaio() {
  if (circuloRaio) circuloRaio.remove();
  circuloRaio = null;
  if (filtros.raio) {
    circuloRaio = L.circle([usuario.lat, usuario.lng], { radius: filtros.raio * 1000, className: "mapa-raio", interactive: false })
      .addTo(mapa);
  }
}

/** Ajusta o zoom para mostrar o resultado da busca. */
function enquadrar() {
  if (circuloRaio) {
    mapa.fitBounds(circuloRaio.getBounds(), { padding: [24, 24] });
  } else if (lojas.length) {
    const pontos = lojas.map((l) => [l.latitude, l.longitude]);
    mapa.fitBounds(L.latLngBounds(pontos), { padding: [48, 48], maxZoom: 16 });
  } else {
    mapa.setView([usuario.lat, usuario.lng], 14);
  }
}

// ----------------------------------------------------------------- painel e lista
function desenharPainel(loja) {
  if (!loja) {
    painel.innerHTML = vazio("Nenhuma loja encontrada", "Tente buscar outro bairro ou aumentar a distância.");
    return;
  }
  const link = `/estabelecimento.html?id=${loja.id_estabelecimento}`;
  const n = loja.sacolas_disponiveis;
  const caixa = n
    ? `<div class="caixa-sacolas">
        <strong>${n} sacola${n > 1 ? "s" : ""} disponíve${n > 1 ? "is" : "l"} agora</strong>
        <span>Retirada recomendada ${quando(loja.proximo_inicio)} entre ${hora(loja.proximo_inicio)} e ${hora(loja.proximo_fim)}.</span>
      </div>`
    : `<div class="caixa-sacolas"><strong>Nenhuma sacola agora</strong><span>Esta loja ainda não publicou sacolas para hoje. Volte mais tarde.</span></div>`;

  painel.innerHTML = `
    <article class="loja-info">
      <img class="loja-info-foto" src="${imagem(loja.foto)}" alt="Foto de ${esc(loja.nome)}">
      <div class="loja-info-meta">${etiquetaTipo(loja)}<span>${textoAvaliacoes(loja)}</span></div>
      <h3>${esc(loja.nome)}</h3>
      <p class="muted">${esc(enderecoCompleto(loja))}</p>
      ${caixa}
      <a class="btn ${n ? "btn-primario" : "btn-contorno"} btn-bloco" href="${link}">${n ? "Ver sacolas" : "Ver loja"}</a>
    </article>`;
}

function desenharLista() {
  if (!lojas.length) {
    lista.innerHTML = vazio("Nenhuma loja encontrada", "Tente buscar outro bairro ou aumentar a distância.");
    return;
  }
  lista.innerHTML = lojas.map((loja) => {
    const n = loja.sacolas_disponiveis;
    const link = `/estabelecimento.html?id=${loja.id_estabelecimento}`;
    return `
      <article class="loja-card">
        <img src="${imagem(loja.foto)}" alt="" loading="lazy">
        <div class="loja-card-corpo">
          <div class="loja-info-meta">${etiquetaTipo(loja)}<span>${textoAvaliacoes(loja)}</span></div>
          <h3><a href="${link}">${esc(loja.nome)}</a></h3>
          <p class="sutil">${esc(enderecoCompleto(loja))}</p>
          <p class="loja-card-sacolas${n ? "" : " sem"}">${n ? `${n} sacola${n > 1 ? "s" : ""} disponíve${n > 1 ? "is" : "l"}` : "Sem sacolas agora"}</p>
          <div class="loja-card-acoes">
            <button class="btn btn-contorno btn-pequeno" type="button" data-ver-no-mapa="${loja.id_estabelecimento}">Ver no mapa</button>
            <a class="btn btn-primario btn-pequeno" href="${link}">Ver sacolas</a>
          </div>
        </div>
      </article>`;
  }).join("");
}

/** Marca uma loja como selecionada: pino destacado e dados no painel da esquerda. */
function selecionar(id, { rolar = false } = {}) {
  const anterior = lojas.find((l) => l.id_estabelecimento === selecionadaId);
  if (anterior && marcadores.has(anterior.id_estabelecimento)) {
    marcadores.get(anterior.id_estabelecimento).setIcon(iconeDaLoja(anterior, false)).setZIndexOffset(0);
  }

  selecionadaId = id;
  const loja = lojas.find((l) => l.id_estabelecimento === id);
  if (loja && marcadores.has(id)) {
    marcadores.get(id).setIcon(iconeDaLoja(loja, true)).setZIndexOffset(1000);
  }
  desenharPainel(loja);

  // No celular o painel fica embaixo do mapa: rola até ele para a pessoa ver a loja.
  if (rolar && matchMedia("(max-width: 860px)").matches) {
    document.getElementById("selecionado").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// ----------------------------------------------------------------- busca na API
async function carregar() {
  const meuPedido = ++pedidoAtual;
  lista.innerHTML = '<div class="esqueleto" style="height:300px"></div>'.repeat(4);

  try {
    const resultado = await api("/estabelecimentos", {
      params: { lat: usuario.lat, lng: usuario.lng, raio_km: filtros.raio, tipo: filtros.tipo, busca: filtros.busca },
    });
    if (meuPedido !== pedidoAtual) return; // chegou depois de uma busca mais nova: descarta

    lojas = resultado.filter((l) => l.latitude !== null && l.longitude !== null);
    desenharLista();
    if (mapa) {
      desenharPinos();
      desenharRaio();
      enquadrar();
    }

    // Mantém a loja que já estava escolhida; senão, a mais perto que tem sacolas.
    const manter = lojas.find((l) => l.id_estabelecimento === selecionadaId);
    const primeira = manter || lojas.find((l) => l.sacolas_disponiveis > 0) || lojas[0];
    selecionar(primeira ? primeira.id_estabelecimento : null);
  } catch (erro) {
    if (meuPedido !== pedidoAtual) return;
    toast(erro.message, "erro");
    const aviso = `<div class="alerta alerta-erro" role="alert">${esc(erro.message)}</div>
      <button class="btn btn-contorno" type="button" data-tentar>Tentar de novo</button>`;
    painel.innerHTML = aviso;
    lista.innerHTML = aviso;
  }
}

// ----------------------------------------------------------------- filtros
function montarChipsTipo() {
  const tipos = [["", "Todos"], ...Object.entries(TIPOS_LOJA)];
  document.getElementById("chips-tipo").innerHTML = tipos.map(([valor, texto]) => `
    <button class="chip" type="button" data-tipo="${valor}" aria-pressed="${valor === filtros.tipo}">
      ${valor ? `<span class="ponto ${corDoTipo(valor)}"></span>` : ""}${texto}
    </button>`).join("");
}

document.getElementById("chips-tipo").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-tipo]");
  if (!chip) return;
  filtros.tipo = chip.dataset.tipo;
  document.querySelectorAll("[data-tipo]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
  carregar();
});

// Os chips de raio ligam e desligam: clicar no que já está ativo volta para "qualquer distância".
document.querySelectorAll("[data-raio]").forEach((chip) => {
  chip.addEventListener("click", () => {
    const valor = Number(chip.dataset.raio);
    filtros.raio = filtros.raio === valor ? null : valor;
    document.querySelectorAll("[data-raio]").forEach((c) => {
      c.setAttribute("aria-pressed", String(Number(c.dataset.raio) === filtros.raio));
    });
    carregar();
  });
});

const campoBusca = document.getElementById("busca");
document.getElementById("form-busca").addEventListener("submit", (e) => {
  e.preventDefault();
  filtros.busca = campoBusca.value.trim();
  carregar();
});
// Apagou o texto da busca: volta a mostrar todas as lojas.
campoBusca.addEventListener("input", () => {
  if (campoBusca.value === "" && filtros.busca) {
    filtros.busca = "";
    carregar();
  }
});

// Botões criados dentro do painel e da lista ("Ver no mapa", "Tentar de novo").
document.addEventListener("click", (e) => {
  const verNoMapa = e.target.closest("[data-ver-no-mapa]");
  if (verNoMapa) {
    const id = Number(verNoMapa.dataset.verNoMapa);
    mostrarModo("mapa");
    selecionar(id);
    const loja = lojas.find((l) => l.id_estabelecimento === id);
    if (loja && mapa) mapa.setView([loja.latitude, loja.longitude], 16);
  }
  if (e.target.closest("[data-tentar]")) carregar();
});

// ----------------------------------------------------------------- Mapa / Lista
const abas = { mapa: document.getElementById("aba-mapa"), lista: document.getElementById("aba-lista") };

function mostrarModo(modo, focar = false) {
  for (const [nome, aba] of Object.entries(abas)) {
    const ativa = nome === modo;
    aba.setAttribute("aria-selected", String(ativa));
    aba.tabIndex = ativa ? 0 : -1;
    document.getElementById(aba.getAttribute("aria-controls")).hidden = !ativa;
  }
  if (focar) abas[modo].focus();
  // O Leaflet calcula o tamanho do mapa ao aparecer; escondido, ele fica com tamanho zero.
  if (modo === "mapa" && mapa) mapa.invalidateSize();
}

abas.mapa.addEventListener("click", () => mostrarModo("mapa"));
abas.lista.addEventListener("click", () => mostrarModo("lista"));
document.querySelector(".alternar-modo").addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    mostrarModo(abas.mapa.getAttribute("aria-selected") === "true" ? "lista" : "mapa", true);
  }
});

// ----------------------------------------------------------------- início
async function iniciar() {
  montarChipsTipo();
  if (window.L) {
    criarMapa();
  } else {
    // A biblioteca do mapa não carregou (sem internet?): a página segue só com a lista.
    document.getElementById("mapa").innerHTML =
      '<p class="alerta alerta-erro">Não foi possível carregar o mapa. Veja as lojas no modo Lista ou recarregue a página.</p>';
    mostrarModo("lista");
  }
  usuario = await localizacao();
  if (mapa) marcarVoce();
  carregar();
}

iniciar();
