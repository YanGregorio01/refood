// Tela 5.4 do Figma (Catálogo): sacolas disponíveis com busca, categoria,
// distância, preço, "Disponível agora" e ordenação, 12 por vez ("Carregar mais").
// Os filtros ficam na URL (?categoria=1&busca=pão...) para o link poder ser
// compartilhado e o botão Voltar do navegador trazer a mesma lista.
import { api } from "/js/api.js";
import { cardSacola, esc, localizacao, montarRodape, montarTopo, parametros, toast, vazio } from "/js/ui.js";

montarTopo("catalogo");
montarRodape();

const POR_PAGINA = 12;
const FILTROS_PADRAO = {
  categoria: "", busca: "", estabelecimento: "", raio_km: "", preco_max: "", disponivel_agora: false, ordem: "proximo",
};

const grade = document.getElementById("grade");
const titulo = document.getElementById("titulo-resultados");
const botaoMais = document.getElementById("carregar-mais");
const campoBusca = document.getElementById("busca");
const selects = {
  raio_km: document.getElementById("raio_km"),
  preco_max: document.getElementById("preco_max"),
  ordem: document.getElementById("ordem"),
};
const chipAgora = document.getElementById("chip-agora");

let filtros = { ...FILTROS_PADRAO };
let usuario; // { lat, lng } de quem busca, para calcular as distâncias
let pagina = 1;
let carregadas = 0; // quantas sacolas já estão na grade
let pedidoAtual = 0; // número da última busca; respostas de buscas antigas são ignoradas

// ----------------------------------------------------------------- filtros <-> URL <-> tela
function lerFiltrosDaUrl() {
  const p = parametros();
  const soNumero = (valor) => (/^\d+$/.test(valor || "") ? valor : ""); // evita mandar lixo para a API
  filtros = {
    ...FILTROS_PADRAO,
    categoria: soNumero(p.get("categoria")),
    estabelecimento: soNumero(p.get("estabelecimento")),
    busca: (p.get("busca") || "").slice(0, 60),
    raio_km: p.get("raio_km") || "",
    preco_max: p.get("preco_max") || "",
    disponivel_agora: p.get("disponivel_agora") === "true",
    ordem: p.get("ordem") || "proximo",
  };
}

/** Mostra os filtros nos campos. Valor que não existe no select volta para a primeira opção. */
function mostrarFiltrosNaTela() {
  campoBusca.value = filtros.busca;
  for (const [nome, select] of Object.entries(selects)) {
    select.value = filtros[nome];
    if (select.value !== filtros[nome]) select.selectedIndex = 0;
    filtros[nome] = select.value;
  }
  chipAgora.setAttribute("aria-pressed", String(filtros.disponivel_agora));
  document.querySelectorAll("[data-categoria]").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip.dataset.categoria === filtros.categoria));
  });
}

/** Guarda os filtros na URL sem recarregar a página (só os que fogem do padrão). */
function atualizarUrl() {
  const p = new URLSearchParams();
  for (const [nome, valor] of Object.entries(filtros)) {
    if (valor && valor !== FILTROS_PADRAO[nome]) p.set(nome, valor);
  }
  const busca = p.toString();
  history.replaceState(null, "", busca ? `?${busca}` : location.pathname);
}

// ----------------------------------------------------------------- busca na API
function textoTotal(total) {
  if (total === 0) return "Nenhuma sacola encontrada";
  return total === 1 ? "1 sacola encontrada" : `${total} sacolas encontradas`;
}

/** Busca as sacolas. Com maisUma = true, pede a próxima página e junta no fim da grade. */
async function carregar(maisUma = false) {
  const meuPedido = ++pedidoAtual;
  const proxima = maisUma ? pagina + 1 : 1;

  if (maisUma) {
    botaoMais.disabled = true;
    botaoMais.textContent = "Carregando...";
  } else {
    atualizarUrl();
    titulo.textContent = "Buscando sacolas...";
    grade.innerHTML = '<div class="esqueleto" style="height:330px"></div>'.repeat(6);
    botaoMais.hidden = true;
  }

  try {
    const resposta = await api("/sacolas", {
      params: {
        ...filtros,
        disponivel_agora: filtros.disponivel_agora || undefined, // só manda quando está ligado
        lat: usuario.lat,
        lng: usuario.lng,
        pagina: proxima,
        limite: POR_PAGINA,
      },
    });
    if (meuPedido !== pedidoAtual) return; // chegou depois de uma busca mais nova: descarta

    pagina = proxima;
    const cards = resposta.itens.map((s) => cardSacola(s)).join("");
    if (maisUma) {
      grade.insertAdjacentHTML("beforeend", cards);
      // Leva o foco para a primeira sacola nova (quem usa teclado continua de onde parou).
      grade.children[carregadas]?.querySelector(".sacola-nome")?.focus();
      carregadas += resposta.itens.length;
    } else {
      carregadas = resposta.itens.length;
      grade.innerHTML = carregadas
        ? cards
        : vazio("Nenhuma sacola encontrada", "Tente mudar os filtros ou buscar outro termo.",
          '<button class="btn btn-contorno" type="button" data-limpar>Limpar filtros</button>');
    }
    titulo.textContent = textoTotal(resposta.total);
    botaoMais.hidden = carregadas >= resposta.total;
  } catch (erro) {
    if (meuPedido !== pedidoAtual) return;
    if (maisUma) {
      toast(erro.message, "erro");
    } else {
      titulo.textContent = "Não foi possível carregar as sacolas";
      grade.innerHTML = `<div class="alerta alerta-erro" role="alert">${esc(erro.message)}
        <button class="btn btn-contorno btn-pequeno" type="button" data-tentar>Tentar de novo</button></div>`;
    }
  } finally {
    botaoMais.disabled = false;
    botaoMais.textContent = "Carregar mais sacolas";
  }
}

// ----------------------------------------------------------------- categorias e aviso da loja
async function carregarCategorias() {
  const area = document.getElementById("chips-categoria");
  try {
    const categorias = await api("/categorias");
    const opcoes = [{ id_categoria: "", nome: "Todas" }, ...categorias];
    area.innerHTML = opcoes.map((c) => `
      <button class="chip" type="button" data-categoria="${c.id_categoria}"
        aria-pressed="${String(c.id_categoria) === filtros.categoria}">${esc(c.nome)}</button>`).join("");
  } catch {
    area.innerHTML = '<span class="sutil">Não foi possível carregar as categorias.</span>';
  }
}

/** Com ?estabelecimento=ID, mostra de qual loja são as sacolas e um link para ver todas. */
async function mostrarAvisoDaLoja() {
  const aviso = document.getElementById("aviso-loja");
  aviso.hidden = !filtros.estabelecimento;
  if (!filtros.estabelecimento) return;

  const semLoja = new URLSearchParams(location.search);
  semLoja.delete("estabelecimento");
  document.getElementById("limpar-loja").href = `/catalogo.html${semLoja.toString() ? `?${semLoja}` : ""}`;
  try {
    const loja = await api(`/estabelecimentos/${filtros.estabelecimento}`);
    document.getElementById("aviso-loja-nome").textContent = loja.nome;
  } catch {
    document.getElementById("aviso-loja-nome").textContent = "uma loja";
  }
}

// ----------------------------------------------------------------- eventos
document.getElementById("chips-categoria").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-categoria]");
  if (!chip) return;
  filtros.categoria = chip.dataset.categoria;
  mostrarFiltrosNaTela();
  carregar();
});

for (const [nome, select] of Object.entries(selects)) {
  select.addEventListener("change", () => {
    filtros[nome] = select.value;
    carregar();
  });
}

chipAgora.addEventListener("click", () => {
  filtros.disponivel_agora = !filtros.disponivel_agora;
  mostrarFiltrosNaTela();
  carregar();
});

document.getElementById("form-busca").addEventListener("submit", (e) => {
  e.preventDefault();
  filtros.busca = campoBusca.value.trim();
  carregar();
});
// Apagou o texto da busca: volta a mostrar tudo.
campoBusca.addEventListener("input", () => {
  if (campoBusca.value === "" && filtros.busca) {
    filtros.busca = "";
    carregar();
  }
});

document.getElementById("limpar-loja").addEventListener("click", (e) => {
  e.preventDefault();
  filtros.estabelecimento = "";
  document.getElementById("aviso-loja").hidden = true;
  carregar();
});

botaoMais.addEventListener("click", () => carregar(true));

// Botões que aparecem dentro da grade: "Limpar filtros" (lista vazia) e "Tentar de novo" (erro).
grade.addEventListener("click", (e) => {
  if (e.target.closest("[data-limpar]")) {
    filtros = { ...FILTROS_PADRAO };
    mostrarFiltrosNaTela();
    document.getElementById("aviso-loja").hidden = true;
    carregar();
  }
  if (e.target.closest("[data-tentar]")) carregar();
});

// ----------------------------------------------------------------- início
async function iniciar() {
  lerFiltrosDaUrl();
  mostrarFiltrosNaTela();
  grade.innerHTML = '<div class="esqueleto" style="height:330px"></div>'.repeat(6);
  carregarCategorias();
  mostrarAvisoDaLoja();
  usuario = await localizacao();
  carregar();
}

iniciar();
