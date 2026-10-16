// Tela 6.10 do Figma: Mapa de doações (no celular, tela 4.1).
// Mostra as ofertas de doação abertas (GET /api/ong/ofertas) em cards à esquerda
// e em pinos num mapa Leaflet à direita. Clicar num pino seleciona o card e
// abre um balão; clicar num card destaca o pino. "Solicitar doação" leva para
// solicitar.html?oferta=ID.
import { api, exigirLogin } from "/js/api.js";
import { distancia, esc, icone, imagem, kg, montarPainel, numero, TIPOS_LOJA, vazio } from "/js/ui.js";
import { atualizarCidade, cidadeDaOng, comPausa, plural, prazoDaOferta } from "/js/ong-comum.js";

const conta = exigirLogin("ONG");
montarPainel(conta, "mapa", cidadeDaOng(conta));

const form = document.getElementById("filtros");
const lista = document.getElementById("lista");
const contagem = document.getElementById("contagem");

// Ícone de loja dos pinos (o ui.js não tem um parecido).
const ICONE_LOJA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/></svg>';

let ofertas = [];       // itens da última resposta da API
let mapa = null;        // mapa do Leaflet (fica null se a biblioteca não carregar)
let camadaPinos = null; // grupo com os pinos das ofertas, limpo a cada busca
let pinos = {};         // id_oferta → marcador, para achar o pino de um card
let pinoDaOng = null;
let ultimaBusca = 0;    // número da requisição mais recente (ver carregar())

// ----------------------------------------------------------------- mapa
function criarMapa() {
  if (typeof L === "undefined") {
    // o script do Leaflet vem da internet (unpkg); sem ele, a lista ainda funciona
    document.getElementById("mapa").innerHTML =
      '<p class="mapa-aviso">Não foi possível carregar o mapa. A lista de doações continua funcionando.</p>';
    return;
  }
  mapa = L.map("mapa").setView([-23.5672, -46.6937], 14);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(mapa);
  camadaPinos = L.layerGroup().addTo(mapa);
}

/** Ícone de pino feito com HTML; a cor vem das classes .pino no <style> da página. */
function iconeDoPino(classe, svg) {
  return L.divIcon({
    className: "", // tira o quadrado branco que o Leaflet põe por padrão
    html: `<span class="pino ${classe}">${svg}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });
}

/** Conteúdo do balão: "Mercado Sabor da Terra / 12,0 kg • disponível hoje". */
function balao(o) {
  return `
    <a class="balao" href="/ong/solicitar.html?oferta=${o.id_oferta}">
      <strong>${esc(o.estabelecimento)}</strong>
      <span>${kg(o.quantidade_kg)} • disponível ${prazoDaOferta(o.disponivel_ate)}</span>
    </a>`;
}

function desenharPinos(ong) {
  if (!mapa) return;
  camadaPinos.clearLayers();
  pinos = {};

  for (const o of ofertas) {
    const marcador = L.marker([o.latitude, o.longitude], {
      icon: iconeDoPino("", ICONE_LOJA),
      title: o.estabelecimento, // o Leaflet põe como title (o texto não vai para innerHTML)
    });
    marcador.bindPopup(balao(o));
    marcador.on("click", () => selecionar(o.id_oferta, "mapa"));
    marcador.addTo(camadaPinos);
    pinos[o.id_oferta] = marcador;
  }

  // O pino da ONG é criado uma vez só e não sai do mapa nas novas buscas.
  if (!pinoDaOng) {
    pinoDaOng = L.marker([ong.latitude, ong.longitude], {
      icon: iconeDoPino("pino-ong", icone("coracao")),
      title: "Sua ONG",
      keyboard: false,
    }).bindTooltip("Sua ONG", { permanent: true, direction: "top", offset: [0, -22] }).addTo(mapa);
  }

  // Enquadra a ONG e todas as ofertas.
  const pontos = ofertas.map((o) => [o.latitude, o.longitude]);
  pontos.push([ong.latitude, ong.longitude]);
  if (pontos.length > 1) mapa.fitBounds(pontos, { padding: [48, 48], maxZoom: 16 });
  else mapa.setView(pontos[0], 15);
}

// ----------------------------------------------------------------- seleção
/**
 * Marca uma oferta como selecionada: card com borda coral e pino coral.
 * origem "mapa": rola a lista até o card. origem "lista": abre o balão do pino.
 */
function selecionar(id, origem) {
  lista.querySelectorAll(".oferta").forEach((card) => {
    card.classList.toggle("selecionada", Number(card.dataset.id) === id);
  });
  for (const [idDoPino, marcador] of Object.entries(pinos)) {
    const ativo = Number(idDoPino) === id;
    // troca só a classe (em vez de setIcon) para não perder o foco do teclado no pino
    marcador.getElement()?.querySelector(".pino")?.classList.toggle("selecionado", ativo);
    marcador.setZIndexOffset(ativo ? 1000 : 0);
  }

  if (origem === "mapa") {
    const semAnimacao = matchMedia("(prefers-reduced-motion: reduce)").matches;
    lista.querySelector(`.oferta[data-id="${id}"]`)?.scrollIntoView({ behavior: semAnimacao ? "auto" : "smooth", block: "nearest" });
  } else {
    pinos[id]?.openPopup();
  }
}

// ----------------------------------------------------------------- lista
function cardOferta(o) {
  const tipo = TIPOS_LOJA[o.tipo_estabelecimento] || "Loja";
  const nota = o.nota_media
    ? `<span class="oferta-nota"><b aria-hidden="true">★</b> ${numero(o.nota_media, 1)}<span class="sr-only"> de 5 estrelas</span></span>`
    : "";
  return `
    <article class="card oferta" data-id="${o.id_oferta}">
      <img class="oferta-foto" src="${esc(imagem(o.foto))}" alt="" loading="lazy">
      <div class="oferta-topo">
        <span class="badge">${esc(tipo)} <span class="minusculo">• ${distancia(o.distancia_m)}</span></span>
        ${nota}
      </div>
      <div>
        <h3>${esc(o.estabelecimento)}</h3>
        <p class="oferta-endereco">${esc(o.endereco)}${o.bairro ? ` • ${esc(o.bairro)}` : ""}</p>
      </div>
      <div class="oferta-qtd">
        ${icone("caixa")}
        <div>
          <strong>${kg(o.quantidade_kg)} disponíveis ${prazoDaOferta(o.disponivel_ate)}</strong>
          <small>${esc(o.tipo_alimento)} • ≈ ${plural(o.refeicoes, "refeição", "refeições")}</small>
        </div>
      </div>
      ${o.observacoes ? `<p class="oferta-obs">${esc(o.observacoes)}</p>` : ""}
      <a class="btn btn-primario btn-bloco" href="/ong/solicitar.html?oferta=${o.id_oferta}"
         aria-label="Solicitar doação: ${esc(o.estabelecimento)}">Solicitar doação</a>
    </article>`;
}

function mostrarOfertas(filtros) {
  if (!ofertas.length) {
    contagem.textContent = "";
    const temFiltro = filtros.busca || filtros.tipo || filtros.raio_km;
    lista.innerHTML = temFiltro
      ? vazio("Nenhuma doação com esses filtros", "Tente outra busca ou aumente a distância.",
        '<button class="btn btn-contorno" type="button" data-limpar>Limpar filtros</button>')
      : vazio("Nenhuma doação aberta agora", "As lojas costumam publicar no fim da tarde.");
    return;
  }
  // Uma loja pode ter mais de uma oferta: contamos lojas diferentes.
  const parceiros = new Set(ofertas.map((o) => o.id_estabelecimento)).size;
  contagem.textContent = plural(parceiros, "parceiro encontrado", "parceiros encontrados");
  lista.innerHTML = ofertas.map(cardOferta).join("");
}

function mostrarCarregando() {
  contagem.textContent = "Buscando doações…";
  lista.setAttribute("aria-busy", "true");
  lista.innerHTML = '<div class="esqueleto" style="height:400px"></div>'.repeat(2);
}

async function carregar() {
  const filtros = Object.fromEntries(new FormData(form)); // { busca, tipo, raio_km }
  const minhaBusca = ++ultimaBusca;
  mostrarCarregando();
  try {
    const dados = await api("/ong/ofertas", { params: filtros });
    // Se a pessoa mexeu no filtro enquanto esperava, esta resposta já está velha.
    if (minhaBusca !== ultimaBusca) return;
    ofertas = dados.itens;
    mostrarOfertas(filtros);
    desenharPinos(dados.ong);
    atualizarCidade(conta, dados.ong);
  } catch (erro) {
    if (minhaBusca !== ultimaBusca) return;
    contagem.textContent = "";
    lista.innerHTML = `
      <div class="alerta alerta-erro" role="alert">
        <div><p>${esc(erro.message)}</p>
        <button class="btn btn-contorno btn-pequeno" type="button" data-tentar style="margin-top:10px">Tentar de novo</button></div>
      </div>`;
  } finally {
    if (minhaBusca === ultimaBusca) lista.removeAttribute("aria-busy");
  }
}

// ----------------------------------------------------------------- eventos
form.addEventListener("submit", (e) => {
  e.preventDefault();
  carregar();
});
// Os selects buscam na hora; a busca por texto espera a pessoa parar de digitar.
form.addEventListener("change", (e) => {
  if (e.target.name !== "busca") carregar();
});
form.elements.busca.addEventListener("input", comPausa(carregar));

lista.addEventListener("click", (e) => {
  if (e.target.closest("[data-tentar]")) return carregar();
  if (e.target.closest("[data-limpar]")) {
    form.reset();
    return carregar();
  }
  if (e.target.closest("a")) return; // o botão "Solicitar doação" segue o link normalmente
  const card = e.target.closest(".oferta");
  if (card) selecionar(Number(card.dataset.id), "lista");
});

criarMapa();
carregar();
