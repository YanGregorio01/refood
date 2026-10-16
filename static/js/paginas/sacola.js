// Tela 6.2 do Figma (Detalhe da sacola): foto, loja parceira, preço com
// desconto, conteúdo, horário e local de retirada e o botão "Reservar agora".
// O botão muda conforme quem está vendo: visitante vai para o login, consumidor
// vai para o checkout e comerciante/ONG recebe um aviso. Precisa de ?id= na URL.
import { api, sessao } from "/js/api.js";
import {
  dia, distancia, esc, etiquetaSacola, hora, imagem, kg, localizacao, moeda, montarRodape, montarTopo, numero, parametros, vazio,
} from "/js/ui.js";

montarTopo("catalogo");
montarRodape();

const SVG = (caminhos) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${caminhos}</svg>`;
const ICONE_CAIXA = SVG('<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>');
const ICONE_RELOGIO = SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
const ICONE_LOCAL = SVG('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>');

const detalhe = document.getElementById("detalhe");

// ----------------------------------------------------------------- partes da página
/** Esgotou (sem estoque) ou saiu do ar por outro motivo (horário passou, loja removeu). */
const esgotou = (s) => s.quantidade <= 0 || s.status === "RESERVADO";

function etiquetaDaFoto(s) {
  if (s.disponivel) return etiquetaSacola(s);
  return `<span class="badge badge-cinza">${esgotou(s) ? "Esgotada" : "Indisponível"}</span>`;
}

/** O botão de reservar muda conforme a sacola e quem está logado. */
function areaReservar(s) {
  const checkout = `/checkout.html?id=${s.id_alimento}`;
  const outrasDaLoja = `/catalogo.html?estabelecimento=${s.id_estabelecimento}`;

  if (!s.disponivel) {
    return `
      <p class="alerta alerta-info">${esgotou(s) ? "Esta sacola esgotou." : "Esta sacola não está mais disponível."}</p>
      <button class="btn btn-primario btn-bloco" type="button" disabled>${esgotou(s) ? "Esgotada" : "Indisponível"}</button>
      <a class="btn btn-contorno btn-bloco" href="${outrasDaLoja}">Ver outras sacolas de ${esc(s.estabelecimento)}</a>`;
  }

  const atual = sessao();
  if (!atual) {
    return `
      <a class="btn btn-primario btn-bloco" href="/login.html?voltar=${encodeURIComponent(checkout)}">Reservar agora</a>
      <p class="sutil">Você entra na sua conta (ou cria uma) e volta direto para a reserva.</p>`;
  }
  if (atual.conta.tipo !== "COMUM") {
    return `
      <p class="alerta alerta-info">Reservas são feitas com uma conta de consumidor.</p>
      <button class="btn btn-primario btn-bloco" type="button" disabled>Reservar agora</button>`;
  }
  return `<a class="btn btn-primario btn-bloco" href="${checkout}">Reservar agora</a>`;
}

function mostrarSacola(s) {
  document.title = `${s.nome} | Refood`;
  document.getElementById("trilha-nome").textContent = s.nome;

  const lojaLink = `/estabelecimento.html?id=${s.id_estabelecimento}`;
  const nota = s.total_avaliacoes ? `<span class="estrelas" aria-hidden="true">★</span> ${numero(s.nota_media, 1)}` : "";
  const local = [s.endereco, distancia(s.distancia_m)].filter(Boolean).join(" • ");

  detalhe.innerHTML = `
    <div class="detalhe-foto${s.disponivel ? "" : " esgotada"}">
      <img src="${imagem(s.foto)}" alt="Foto ilustrativa da sacola ${esc(s.nome)}">
      ${etiquetaDaFoto(s)}
    </div>

    <section class="card detalhe-info" aria-labelledby="nome-sacola">
      <div class="parceiro">
        <img src="${imagem(s.foto_estabelecimento)}" alt="">
        <div>
          <span class="rotulo">Estabelecimento parceiro</span>
          <a href="${lojaLink}">${esc(s.estabelecimento)} →</a>
        </div>
        <span class="parceiro-nota">${nota}</span>
      </div>

      <div>
        <h1 id="nome-sacola">${esc(s.nome)}</h1>
        ${s.descricao ? `<p class="descricao">${esc(s.descricao)}</p>` : ""}
      </div>

      <div class="precos">
        <span class="preco-grande">${moeda(s.preco)}</span>
        <span class="preco-de"><span class="sr-only">Preço original: </span>${moeda(s.preco_original)}</span>
        <span class="badge">${s.desconto}% OFF</span>
      </div>

      <ul class="infos">
        <li>
          <span class="info-icone">${ICONE_CAIXA}</span>
          <div><small>Conteúdo estimado</small><strong>${esc(s.categoria)} • aproximadamente ${kg(s.peso_estimado_kg)}</strong></div>
        </li>
        <li>
          <span class="info-icone">${ICONE_RELOGIO}</span>
          <div><small>Horário de retirada</small><strong>${dia(s.inicio_retirada)}, entre ${hora(s.inicio_retirada)} e ${hora(s.fim_retirada)}</strong></div>
        </li>
        <li>
          <span class="info-icone">${ICONE_LOCAL}</span>
          <div><small>Local de retirada</small><strong>${esc(local)}</strong></div>
        </li>
      </ul>

      <div class="reservar">${areaReservar(s)}</div>
    </section>`;
}

function mostrarProblema(titulo, texto, acao) {
  document.title = `${titulo} | Refood`;
  document.getElementById("trilha-nome").textContent = titulo;
  detalhe.outerHTML = vazio(titulo, texto, acao);
}

// ----------------------------------------------------------------- início
async function iniciar() {
  const id = parametros().get("id") || "";
  const linkCatalogo = '<a class="btn btn-primario" href="/catalogo.html">Ver outras sacolas</a>';
  if (!/^\d+$/.test(id)) {
    mostrarProblema("Sacola não encontrada", "O link parece estar incompleto.", linkCatalogo);
    return;
  }

  try {
    const usuario = await localizacao();
    const sacola = await api(`/sacolas/${id}`, { params: { lat: usuario.lat, lng: usuario.lng } });
    mostrarSacola(sacola);
  } catch (erro) {
    if (erro.status === 404) {
      mostrarProblema("Sacola não encontrada", "Ela pode ter saído do catálogo.", linkCatalogo);
    } else {
      mostrarProblema("Não foi possível carregar a sacola", erro.message,
        '<button class="btn btn-primario" type="button" id="tentar-de-novo">Tentar de novo</button>');
      document.getElementById("tentar-de-novo").addEventListener("click", () => location.reload());
    }
  }
}

iniciar();
