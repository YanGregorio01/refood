// =============================================================================
// Peças de interface reaproveitadas pelas páginas: formatação de valores,
// cabeçalho, rodapé, menu lateral do painel, card de sacola e avisos.
// =============================================================================

import { sair, sessao } from "/js/api.js";

// ----------------------------------------------------------------- formatação
const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtNumero = (casas) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Protege texto vindo da API antes de colocar em innerHTML (evita XSS). */
export function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
export const moeda = (v) => fmtMoeda.format(Number(v || 0));
export const numero = (v, casas = 0) => fmtNumero(casas).format(Number(v || 0));
export const kg = (v) => `${fmtNumero(1).format(Number(v || 0))} kg`;

export function distancia(metros) {
  if (metros === null || metros === undefined) return "";
  return metros < 1000 ? `${Math.round(metros / 10) * 10} m` : `${fmtNumero(1).format(metros / 1000)} km`;
}

/** "2026-10-16T18:30:00" vira Date (horário local, sem conversão de fuso). */
export function data(iso) {
  if (!iso) return null;
  const [d, t = "00:00:00"] = String(iso).split("T");
  const [ano, mes, dia] = d.split("-").map(Number);
  const [h, m, s] = t.split(":").map(Number);
  return new Date(ano, mes - 1, dia, h || 0, m || 0, Math.floor(s || 0));
}

/** 18:00 vira "18h"; 19:30 vira "19h30". */
export function hora(iso) {
  const d = data(iso);
  if (!d) return "";
  const m = d.getMinutes();
  return `${d.getHours()}h${m ? String(m).padStart(2, "0") : ""}`;
}

export const faixa = (inicio, fim) => `${hora(inicio)} - ${hora(fim)}`;

function mesmoDia(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Hoje", "Amanhã", "Ontem" ou "16 out". */
export function dia(iso) {
  const d = data(iso);
  if (!d) return "";
  const hoje = new Date();
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, amanha)) return "Amanhã";
  if (mesmoDia(d, ontem)) return "Ontem";
  return `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== hoje.getFullYear() ? ` ${d.getFullYear()}` : ""}`;
}

export const diaHora = (iso) => `${dia(iso)} • ${hora(iso)}`;

/** "há 3 dias", "há 2 horas"... */
export function relativo(iso) {
  const d = data(iso);
  if (!d) return "";
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const dias = Math.floor(s / 86400);
  if (dias < 7) return `há ${dias} dia${dias > 1 ? "s" : ""}`;
  if (dias < 30) return `há ${Math.floor(dias / 7)} semana${dias >= 14 ? "s" : ""}`;
  return dia(iso);
}

export function estrelas(nota) {
  const n = Math.round(Number(nota || 0));
  return `<span class="estrelas" aria-label="${n} de 5 estrelas">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>`;
}

/** Caminhos de imagem da API são relativos ("img/..."): aqui viram absolutos. */
export const imagem = (caminho) => (!caminho ? "/img/hero.jpg" : /^(https?:)?\//.test(caminho) ? caminho : `/${caminho}`);

export const parametros = () => new URLSearchParams(location.search);

// ----------------------------------------------------------------- textos de status
export const STATUS_RESERVA = {
  PENDENTE: { texto: "Reservado", classe: "badge-laranja-claro" },
  RETIRADA: { texto: "Retirado", classe: "" },
  CANCELADA: { texto: "Cancelado", classe: "badge-cinza" },
  NAO_COMPARECEU: { texto: "Expirado", classe: "badge-coral-claro" },
};
export const STATUS_SACOLA = {
  RASCUNHO: { texto: "Rascunho", classe: "badge-cinza" },
  DISPONIVEL: { texto: "Ativa", classe: "" },
  RESERVADO: { texto: "Esgotada", classe: "badge-laranja-claro" },
  INDISPONIVEL: { texto: "Removida", classe: "badge-cinza" },
  VENCIDO: { texto: "Encerrada", classe: "badge-cinza" },
};
export const STATUS_DOACAO = {
  PENDENTE: { texto: "Aguardando", classe: "badge-laranja-claro" },
  CONFIRMADA: { texto: "Confirmada", classe: "" },
  RECUSADA: { texto: "Recusada", classe: "badge-coral-claro" },
  RECEBIDA: { texto: "Recebida", classe: "badge-verde" },
  CANCELADA: { texto: "Cancelada", classe: "badge-cinza" },
};
export const TIPOS_LOJA = {
  PADARIA: "Padaria", MERCADO: "Mercado", RESTAURANTE: "Restaurante",
  HORTIFRUTI: "Hortifruti", CAFE: "Café", OUTRO: "Outro",
};
export function badge(mapa, status) {
  const s = mapa[status] || { texto: status, classe: "badge-cinza" };
  return `<span class="badge ${s.classe}">${esc(s.texto)}</span>`;
}

// ----------------------------------------------------------------- avisos
export function toast(mensagem, tipo = "") {
  let area = document.querySelector(".toast-area");
  if (!area) {
    area = document.createElement("div");
    area.className = "toast-area";
    area.setAttribute("role", "status");
    area.setAttribute("aria-live", "polite");
    document.body.append(area);
  }
  const t = document.createElement("div");
  t.className = `toast ${tipo}`;
  t.textContent = mensagem;
  area.append(t);
  setTimeout(() => t.remove(), 4200);
}

/** Mostra os erros de um 422 ao lado de cada campo (inputs com name igual ao campo da API). */
export function mostrarErrosDoFormulario(form, erro) {
  form.querySelectorAll(".campo.erro").forEach((c) => {
    c.classList.remove("erro");
    c.querySelector(".msg-erro")?.remove();
  });
  for (const [nome, msg] of Object.entries(erro.campos || {})) {
    const entrada = form.querySelector(`[name="${nome}"]`);
    const campo = entrada?.closest(".campo");
    if (!campo) continue;
    campo.classList.add("erro");
    const p = document.createElement("p");
    p.className = "msg-erro";
    p.textContent = msg;
    campo.append(p);
  }
}

export function vazio(titulo, texto = "", acao = "") {
  return `<div class="vazio"><h3>${esc(titulo)}</h3>${texto ? `<p>${esc(texto)}</p>` : ""}${acao}</div>`;
}

// ----------------------------------------------------------------- localização
const PADRAO = { lat: -23.5672, lng: -46.6937 }; // Largo da Batata, Pinheiros

/** Pede a localização ao navegador (uma vez por sessão). Sem permissão, usa Pinheiros. */
export function localizacao() {
  try {
    const salvo = sessionStorage.getItem("refood.local");
    if (salvo) return Promise.resolve(JSON.parse(salvo));
  } catch { /* segue */ }
  return new Promise((resolve) => {
    const guardar = (p) => {
      try { sessionStorage.setItem("refood.local", JSON.stringify(p)); } catch { /* segue */ }
      resolve(p);
    };
    if (!navigator.geolocation) return guardar(PADRAO);
    navigator.geolocation.getCurrentPosition(
      (pos) => guardar({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => guardar(PADRAO),
      { timeout: 4000, maximumAge: 600000 },
    );
  });
}

// ----------------------------------------------------------------- ícones
const ICONES = {
  folha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c0-8 5-13 14-13-.4 9-5.4 13.5-12 13.5"/><path d="M5 19.5c3-4.4 6-7 10-9"/></svg>',
  painel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  sacola: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
  pedidos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8l1 2h2v15H5V6h2l1-2z"/><path d="M9 12h6M9 16h4"/></svg>',
  grafico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V4M4 20h16"/><path d="M8 16l4-5 3 3 5-7"/></svg>',
  coracao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  mapa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
  enviar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4 18-7z"/></svg>',
  caixa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
  config: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 1.3 14H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6 1.6 1.6 0 0 0 8 1.1V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 14 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 19.4 7"/></svg>',
  relogio: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};
export const icone = (nome) => ICONES[nome] || "";

const MARCA = (texto = "Refood", href = "/index.html") =>
  `<a class="marca" href="${href}"><span class="marca-icone">${ICONES.folha}</span>${texto}</a>`;

// ----------------------------------------------------------------- cabeçalho e rodapé do site
/**
 * Monta o cabeçalho no elemento <header id="topo"></header>.
 * ativo: "inicio" | "mapa" | "catalogo" | "sobre" (o link que fica destacado)
 */
export function montarTopo(ativo = "") {
  const el = document.getElementById("topo");
  if (!el) return;
  el.className = "topo";
  const links = [
    ["inicio", "Início", "/index.html"],
    ["mapa", "Mapa", "/mapa.html"],
    ["catalogo", "Catálogo", "/catalogo.html"],
    ["sobre", "Sobre", "/index.html#como-funciona"],
  ];
  const atual = sessao();
  let acoes;
  if (!atual) {
    acoes = `<a class="btn btn-contorno btn-pequeno" href="/login.html">Entrar / Cadastrar</a>`;
  } else {
    const c = atual.conta;
    const destino = c.tipo === "COMUM" ? "/perfil.html" : c.pagina_inicial;
    const rotulo = c.tipo === "COMUM" ? "Área do Cliente" : c.tipo === "ONG" ? "Painel da ONG" : "Meu painel";
    const extras = c.tipo === "COMUM"
      ? `<a href="/inicio.html">Início do cliente</a><a href="/pedidos.html">Meus pedidos</a><a href="/perfil.html">Meu perfil</a>`
      : `<a href="${c.pagina_inicial}">${rotulo}</a>`;
    acoes = `
      <a class="btn btn-contorno btn-pequeno" href="${destino}">${rotulo}</a>
      <div class="menu-conta">
        <button class="avatar" type="button" aria-haspopup="true" aria-expanded="false" title="${esc(c.nome)}">${esc(c.nome.charAt(0))}</button>
        <div class="menu-conta-lista" hidden>${extras}<button type="button" data-sair>Sair</button></div>
      </div>`;
  }
  el.innerHTML = `
    <div class="container">
      ${MARCA()}
      <nav class="nav" aria-label="Principal">
        ${links.map(([id, texto, href]) => `<a href="${href}"${id === ativo ? ' aria-current="page"' : ""}>${texto}</a>`).join("")}
      </nav>
      <div class="topo-acoes">${acoes}
        <button class="btn-icone menu-mobile" type="button" aria-label="Abrir menu">${ICONES.menu}</button>
      </div>
    </div>`;

  el.querySelector(".menu-mobile")?.addEventListener("click", () => el.querySelector(".nav").classList.toggle("aberto"));
  const botao = el.querySelector(".menu-conta .avatar");
  const lista = el.querySelector(".menu-conta-lista");
  botao?.addEventListener("click", () => {
    lista.hidden = !lista.hidden;
    botao.setAttribute("aria-expanded", String(!lista.hidden));
  });
  document.addEventListener("click", (e) => {
    if (lista && !e.target.closest(".menu-conta")) lista.hidden = true;
  });
  el.querySelector("[data-sair]")?.addEventListener("click", () => sair());
}

/** Monta o rodapé no elemento <footer id="rodape"></footer>. */
export function montarRodape() {
  const el = document.getElementById("rodape");
  if (!el) return;
  el.className = "rodape";
  el.innerHTML = `
    <div class="container">
      <div class="rodape-grade">
        <div>${MARCA()}<p style="margin-top:16px">Conectando pontas para um consumo mais inteligente, responsável e gerando menos impacto ambiental no Brasil.</p></div>
        <div><h4>Links úteis</h4><a href="/index.html#como-funciona">Sobre nós</a><a href="/index.html#como-funciona">Perguntas frequentes</a><a href="/index.html">Política de privacidade</a><a href="/index.html">Contato</a></div>
        <div><h4>Compromisso global</h4><p>Atuamos diretamente nos Objetivos de Desenvolvimento Sustentável da ONU para 2030.</p>
          <div class="ods"><span><b>ODS 2</b> Fome Zero</span><span><b>ODS 12</b> Consumo Resp.</span></div></div>
      </div>
      <p class="rodape-fim">© 2026 Refood. Projeto Integrador da PUC-Campinas. Feito com amor para combater o desperdício.</p>
    </div>`;
}

// ----------------------------------------------------------------- painel (comerciante e ONG)
const MENU_PAINEL = {
  ESTABELECIMENTO: [
    ["dashboard", "Dashboard", "/painel/dashboard.html", "painel"],
    ["sacolas", "Sacolas", "/painel/sacolas.html", "sacola"],
    ["pedidos", "Pedidos", "/painel/pedidos.html", "pedidos"],
    ["doacoes", "Doações", "/painel/doacoes.html", "coracao"],
    ["relatorios", "Relatórios", "/painel/relatorios.html", "grafico"],
  ],
  ONG: [
    ["mapa", "Mapa de doações", "/ong/mapa.html", "mapa"],
    ["solicitacoes", "Solicitações", "/ong/solicitacoes.html", "enviar"],
    ["recebimentos", "Recebimentos", "/ong/recebimentos.html", "caixa"],
  ],
};

/**
 * Monta o menu lateral verde no elemento <aside id="lateral"></aside>.
 * conta: a conta logada; ativo: id do item do menu; subtitulo: cidade/bairro.
 */
export function montarPainel(conta, ativo, subtitulo = "") {
  const el = document.getElementById("lateral");
  if (!el) return;
  el.className = "lateral";
  const itens = MENU_PAINEL[conta.tipo] || [];
  const nome = conta.organizacao || conta.nome;
  el.innerHTML = `
    ${MARCA("Refood Parcerias", conta.pagina_inicial)}
    <nav aria-label="Painel">
      ${itens.map(([id, texto, href, ic]) => `<a href="${href}"${id === ativo ? ' aria-current="page"' : ""}>${ICONES[ic]}${texto}</a>`).join("")}
    </nav>
    <div class="lateral-conta">
      <div class="quem"><span class="avatar">${esc(nome.charAt(0))}</span><div><strong>${esc(nome)}</strong><small>${esc(subtitulo)}</small></div></div>
      <a href="/completar-cadastro.html?editar=1">Configurações</a>
      <button type="button" data-sair>Sair</button>
    </div>`;
  el.querySelector("[data-sair]").addEventListener("click", () => sair());

  // botão de abrir o menu em telas pequenas: <button class="btn-icone painel-menu-btn" data-abrir-menu>
  document.querySelectorAll("[data-abrir-menu]").forEach((b) => {
    b.innerHTML = ICONES.menu;
    b.setAttribute("aria-label", "Abrir menu");
    b.addEventListener("click", () => el.classList.toggle("aberta"));
  });
}

/** Data por extenso para o canto do painel: "Hoje, 16 de outubro". */
export function hojePorExtenso() {
  const d = new Date();
  const mes = d.toLocaleDateString("pt-BR", { month: "long" });
  return `Hoje, ${d.getDate()} de ${mes}`;
}

// ----------------------------------------------------------------- card de sacola
/** Etiquetas do card: "ÚLTIMAS 2", "EXPIRA HOJE", "NOVO" ou "3 DISPONÍVEIS". */
export function etiquetaSacola(s) {
  if (s.quantidade <= 2) return `<span class="badge badge-coral">Últimas ${s.quantidade}</span>`;
  const novo = Date.now() - (data(s.data_cadastro)?.getTime() || 0) < 86400000;
  if (dia(s.fim_retirada) === "Hoje" && !novo) return `<span class="badge badge-laranja">Expira hoje</span>`;
  if (novo) return `<span class="badge badge-verde">Novo</span>`;
  return `<span class="badge badge-laranja">${s.quantidade} disponíveis</span>`;
}

/** HTML de um card de sacola (catálogo, início do cliente, página da loja). */
export function cardSacola(s, { textoBotao = "Reservar" } = {}) {
  const link = `/sacola.html?id=${s.id_alimento}`;
  return `
    <article class="sacola">
      <a class="sacola-foto" href="${link}" tabindex="-1">
        <img src="${imagem(s.foto)}" alt="" loading="lazy">
        ${etiquetaSacola(s)}
      </a>
      <div class="sacola-corpo">
        <div class="sacola-loja"><span>${esc(s.estabelecimento)}</span><span>${distancia(s.distancia_m)}</span></div>
        <a class="sacola-nome" href="${link}">${esc(s.nome)}</a>
        <div class="sacola-horario">${ICONES.relogio} ${dia(s.inicio_retirada) === "Hoje" ? "Retirada" : dia(s.inicio_retirada) + ","} ${faixa(s.inicio_retirada, s.fim_retirada)}</div>
        <div class="sacola-rodape">
          <div><div class="preco-de">${moeda(s.preco_original)}</div><div class="preco">${moeda(s.preco)}</div></div>
          <a class="btn btn-primario btn-pequeno" href="${link}">${textoBotao}</a>
        </div>
      </div>
    </article>`;
}
