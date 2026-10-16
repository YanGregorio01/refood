// Tela 5.5 do Figma (Home do consumidor; no celular, tela 2.1).
// Saudação, três sacolas perto de você com cronômetro, o impacto da pessoa
// (kg salvos e nível) e as lojas onde ela já comprou.
// Dados: GET /api/consumidor/inicio?lat=&lng=
import { api, exigirLogin } from "/js/api.js";
import {
  data, distancia, esc, icone, imagem, kg, localizacao, montarRodape, montarTopo, moeda, numero, vazio,
} from "/js/ui.js";
import { barraProgresso, iconeCliente, mostrarErro, plural } from "/js/cliente.js";

const conta = exigirLogin("COMUM");
montarTopo("");
montarRodape();

const areaPerto = document.getElementById("perto");
const areaImpacto = document.getElementById("impacto");
const areaLojas = document.getElementById("lojas");

// ----------------------------------------------------------------- saudação
function saudacao() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}
document.getElementById("saudacao").textContent = `${saudacao()}, ${conta.nome.split(" ")[0]}! 👋`;

// ----------------------------------------------------------------- cronômetro
/** 6139 segundos viram "01:42:19"; com mais de um dia, "1d 03:21:35". */
function relogio(segundos) {
  const dias = Math.floor(segundos / 86400);
  const h = Math.floor((segundos % 86400) / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const hms = [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  return dias > 0 ? `${dias}d ${hms}` : hms;
}

/** Atualiza todos os cronômetros da página (chamada a cada segundo). */
function atualizarCronometros() {
  document.querySelectorAll("[data-fim]").forEach((el) => {
    const restante = Math.floor((data(el.dataset.fim) - Date.now()) / 1000);
    if (restante > 0) {
      el.querySelector(".tempo").textContent = relogio(restante);
    } else {
      el.textContent = "Encerrada";
      el.removeAttribute("data-fim"); // sem data-fim, o cronômetro para de ser atualizado
      el.closest(".sacola")?.classList.add("encerrada");
    }
  });
}

// ----------------------------------------------------------------- HTML das partes
function cardPerto(s) {
  const link = `/sacola.html?id=${s.id_alimento}`;
  return `
    <article class="sacola">
      <div class="sacola-foto">
        <img src="${imagem(s.foto)}" alt="" loading="lazy">
        <span class="badge badge-coral cronometro" data-fim="${esc(s.fim_retirada)}">
          <span aria-hidden="true">⏱</span><span class="sr-only">Retirada termina em</span>
          <span class="tempo">--:--:--</span>
        </span>
      </div>
      <div class="sacola-corpo">
        <div class="sacola-loja"><span>${esc(s.estabelecimento)}</span><span>${distancia(s.distancia_m)}</span></div>
        <a class="sacola-nome" href="${link}">${esc(s.nome)}</a>
        <div class="sacola-rodape">
          <div class="precos">
            <span class="preco">${moeda(s.preco)}</span>
            <span class="preco-de"><span class="sr-only">Preço original:</span> ${moeda(s.preco_original)}</span>
          </div>
          <a class="btn btn-primario btn-pequeno" href="${link}" aria-label="Garantir ${esc(s.nome)}">Garantir</a>
        </div>
      </div>
    </article>`;
}

function htmlImpacto(impacto) {
  const nivel = impacto.nivel;
  const salvou = impacto.kg_salvos > 0;
  const titulo = salvou
    ? `Você já salvou ${kg(impacto.kg_salvos)} de alimentos! 🌱`
    : "Sua primeira sacola retirada já conta aqui! 🌱";
  const texto = salvou
    ? `Isso equivale a cerca de <strong>${plural(impacto.refeicoes, "refeição completa", "refeições completas")}</strong> aproveitadas e menos CO₂ na atmosfera.`
    : "Cada sacola que você retira é comida boa que deixa de ir para o lixo.";
  return `
    <h2><span class="impacto-icone">${icone("folha")}</span>Seu impacto</h2>
    <p class="impacto-titulo">${titulo}</p>
    <p class="impacto-texto">${texto}</p>
    <div class="nivel">
      <div class="nivel-linha">
        <span>Nível ${numero(nivel.numero)}: ${esc(nivel.nome)}</span>
        <strong>${numero(nivel.progresso)}%</strong>
      </div>
      ${barraProgresso(nivel.progresso, `Progresso no nível ${nivel.nome}`)}
    </div>`;
}

function itemLoja(loja) {
  const n = loja.sacolas_disponiveis;
  const etiqueta = n > 0
    ? `<span class="badge">${plural(n, "sacola disponível agora", "sacolas disponíveis agora")}</span>`
    : `<span class="badge badge-cinza">Sem sacolas agora</span>`;
  return `
    <a class="item" href="/estabelecimento.html?id=${loja.id_estabelecimento}">
      <img class="item-foto" src="${imagem(loja.foto)}" alt="" loading="lazy">
      <div class="item-corpo">
        <div class="loja-topo"><strong>${esc(loja.nome)}</strong>${etiqueta}</div>
        <span class="muted">${esc(loja.descricao || "")}</span>
      </div>
      <span class="loja-seta">${iconeCliente("seta")}</span>
    </a>`;
}

// ----------------------------------------------------------------- carregar
/**
 * localizacao() espera a resposta do navegador. Se a pessoa ignorar o pedido
 * de permissão, seguimos sem lat/lng depois de 5 s (a API usa Pinheiros).
 */
function localComLimite(ms = 5000) {
  const limite = new Promise((resolve) => setTimeout(() => resolve(null), ms));
  return Promise.race([localizacao(), limite]);
}

async function carregar() {
  try {
    const local = await localComLimite();
    const d = await api("/consumidor/inicio", { params: local || {} });

    if (d.perto.length) {
      areaPerto.innerHTML = d.perto.map(cardPerto).join("");
      atualizarCronometros();
      setInterval(atualizarCronometros, 1000);
    } else {
      areaPerto.classList.remove("perto"); // o aviso de vazio ocupa a largura toda
      areaPerto.innerHTML = vazio(
        "Nenhuma sacola perto de você agora",
        "Novas ofertas aparecem ao longo do dia. Dê uma olhada no catálogo completo.",
        `<a class="btn btn-primario" href="/catalogo.html">Ver catálogo</a>`,
      );
    }

    areaImpacto.className = "impacto";
    areaImpacto.innerHTML = htmlImpacto(d.impacto);

    areaLojas.innerHTML = d.lojas_frequentes.length
      ? d.lojas_frequentes.map(itemLoja).join("")
      : vazio("Você ainda não retirou nenhuma sacola", "As lojas onde você comprar vão aparecer aqui.");
  } catch (erro) {
    document.getElementById("conteudo").hidden = true;
    mostrarErro(document.getElementById("erro"), erro.message);
  }
}

carregar();
