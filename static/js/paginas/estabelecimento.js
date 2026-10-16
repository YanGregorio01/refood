// Tela 5.7 do Figma (Página do estabelecimento): capa, dados da loja
// (aberta ou fechada agora), sacolas disponíveis, avaliações e o mapa com o
// endereço. Precisa de ?id= na URL (o id_estabelecimento).
import { api } from "/js/api.js";
import {
  cardSacola, data, esc, estrelas, hora, imagem, localizacao, montarRodape, montarTopo, numero, parametros, relativo, TIPOS_LOJA, vazio,
} from "/js/ui.js";

montarTopo("mapa");
montarRodape();

const ICONE_LOCAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const ICONE_RELOGIO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

// ----------------------------------------------------------------- horário de funcionamento
/** Compara a hora atual com "06:30" e "20:00" (o data() do ui.js transforma esses horários em hoje). */
function abertaAgora(abre, fecha) {
  const agora = new Date();
  const a = data(abre);
  const f = data(fecha);
  // Loja que fecha depois da meia-noite (ex.: das 18h às 2h) passa pela virada do dia.
  return a <= f ? agora >= a && agora < f : agora >= a || agora < f;
}

function textoHorario(loja) {
  if (!loja.horario_abertura || !loja.horario_fechamento) return `${ICONE_RELOGIO} Horário não informado`;
  const aberta = abertaAgora(loja.horario_abertura, loja.horario_fechamento);
  return `${ICONE_RELOGIO} Aberto hoje • ${hora(loja.horario_abertura)}–${hora(loja.horario_fechamento)}
    <span class="badge${aberta ? "" : " badge-cinza"}">${aberta ? "Aberto agora" : "Fechado agora"}</span>`;
}

// ----------------------------------------------------------------- partes da página
function mostrarCabecalho(loja) {
  document.title = `${loja.nome} | Refood`;
  document.getElementById("capa").innerHTML = `<img src="${imagem(loja.foto)}" alt="Foto de ${esc(loja.nome)}">`;

  const logo = document.getElementById("logo-loja");
  logo.textContent = loja.nome.charAt(0);
  logo.classList.add(`cor-${(loja.tipo || "OUTRO").toLowerCase()}`);

  document.getElementById("loja-nome").textContent = loja.nome;
  document.getElementById("loja-tipo").textContent =
    [TIPOS_LOJA[loja.tipo] || TIPOS_LOJA.OUTRO, loja.descricao].filter(Boolean).join(" • ");
  const cidade = [loja.bairro, loja.cidade].filter(Boolean).join(", ");
  document.getElementById("loja-endereco").innerHTML = `${ICONE_LOCAL} ${esc(loja.endereco)}${cidade ? ` • ${esc(cidade)}` : ""}`;
  document.getElementById("loja-horario").innerHTML = textoHorario(loja);

  const nota = document.getElementById("loja-nota");
  nota.innerHTML = loja.total_avaliacoes
    ? `<span class="estrelas" aria-hidden="true">★</span> ${numero(loja.nota_media, 1)} · ${loja.total_avaliacoes} ${loja.total_avaliacoes === 1 ? "avaliação" : "avaliações"}`
    : "Sem avaliações ainda";
}

function mostrarSacolas(loja) {
  const area = document.getElementById("sacolas");
  area.innerHTML = loja.sacolas.length
    ? loja.sacolas.map((s) => cardSacola(s)).join("")
    : vazio("Nenhuma sacola agora.", "Volte mais tarde.", '<a class="btn btn-contorno" href="/mapa.html">Ver outras lojas no mapa</a>');
}

function mostrarAvaliacoes(loja) {
  const total = loja.total_avaliacoes;
  document.getElementById("total-avaliacoes").textContent = total ? `${total} ${total === 1 ? "avaliação" : "avaliações"}` : "";
  const lista = document.getElementById("avaliacoes");
  if (!loja.avaliacoes.length) {
    lista.innerHTML = '<li class="muted">Ainda não há comentários sobre esta loja.</li>';
    return;
  }
  lista.innerHTML = loja.avaliacoes.map((a) => {
    const cliente = a.cliente || "Cliente";
    return `
    <li class="avaliacao">
      <div class="avaliacao-topo">
        <span class="avatar" aria-hidden="true">${esc(cliente.charAt(0))}</span>
        <div><strong>${esc(cliente)}</strong><small>${relativo(a.data_avaliacao)}</small></div>
        ${estrelas(a.nota)}
      </div>
      <p>${esc(a.comentario)}</p>
    </li>`;
  }).join("");
}

function mostrarLocal(loja) {
  const destino = `${loja.latitude},${loja.longitude}`;
  const telefone = loja.telefone
    ? `<span>Telefone: <a href="tel:${esc(loja.telefone.replace(/[^\d+]/g, ""))}">${esc(loja.telefone)}</a></span>` : "";
  document.getElementById("local-texto").innerHTML = `
    <span>${esc(loja.endereco)}${loja.bairro ? ` • ${esc(loja.bairro)}` : ""}</span>
    ${telefone}
    <div class="local-links">
      <a href="https://www.google.com/maps/dir/?api=1&destination=${destino}" target="_blank" rel="noopener">Como chegar</a>
      <a href="/mapa.html">Ver outras lojas no mapa</a>
    </div>`;

  if (!window.L) {
    document.getElementById("mapa-loja").innerHTML = '<p class="alerta alerta-erro">Não foi possível carregar o mapa.</p>';
    return;
  }
  const ponto = [loja.latitude, loja.longitude];
  // Mapa pequeno e "parado": a rodinha do mouse rola a página, não o mapa.
  const mapa = L.map("mapa-loja", { scrollWheelZoom: false }).setView(ponto, 16);
  // Mapa do OpenStreetMap: grátis e sem chave (as cores ficam suaves pelo CSS .leaflet-tile-pane)
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(mapa);
  const pino = L.divIcon({ className: "", html: '<span class="pino-loja"></span>', iconSize: [26, 26], iconAnchor: [13, 13] });
  L.marker(ponto, { icon: pino, title: loja.nome, keyboard: false }).addTo(mapa);
}

/** Troca a página inteira por uma mensagem (loja não existe ou a API falhou). */
function mostrarProblema(titulo, texto, acao) {
  document.title = `${titulo} | Refood`;
  document.getElementById("pagina-loja").innerHTML = `<div class="container">${vazio(titulo, texto, acao)}</div>`;
}

// ----------------------------------------------------------------- início
async function iniciar() {
  const id = parametros().get("id") || "";
  if (!/^\d+$/.test(id)) {
    mostrarProblema("Loja não encontrada", "O link parece estar incompleto.",
      '<a class="btn btn-primario" href="/catalogo.html">Ver o catálogo de sacolas</a>');
    return;
  }

  try {
    const usuario = await localizacao();
    const loja = await api(`/estabelecimentos/${id}`, { params: { lat: usuario.lat, lng: usuario.lng } });
    mostrarCabecalho(loja);
    mostrarSacolas(loja);
    mostrarAvaliacoes(loja);
    mostrarLocal(loja);
  } catch (erro) {
    if (erro.status === 404) {
      mostrarProblema("Loja não encontrada", "Esta loja não existe ou saiu do Refood.",
        '<a class="btn btn-primario" href="/catalogo.html">Ver o catálogo de sacolas</a>');
    } else {
      mostrarProblema("Não foi possível carregar a loja", erro.message,
        '<button class="btn btn-primario" type="button" id="tentar-de-novo">Tentar de novo</button>');
      document.getElementById("tentar-de-novo").addEventListener("click", () => location.reload());
    }
  }
}

iniciar();
