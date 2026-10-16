// =============================================================================
// Conversa com a API do Refood.
//
// Toda página importa daqui:
//   import { api, sessao, exigirLogin } from "/js/api.js";
//   const sacolas = await api("/sacolas", { params: { categoria: 1 } });
//
// O token do login fica no localStorage e vai sozinho em cada requisição.
// O contrato das rotas está em docs/API.md.
// =============================================================================

// Com o Live Server do VS Code (porta 5500) a API está em outro endereço.
const BASE = location.port === "5500" ? "http://127.0.0.1:8000/api" : "/api";
const CHAVE_TOKEN = "refood.token";
const CHAVE_CONTA = "refood.conta";

export class ErroApi extends Error {
  constructor(status, detalhe, campos) {
    super(detalhe);
    this.status = status;
    this.campos = campos || {};
  }
}

function lerArmazenado(chave) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

/** Dados de quem está logado: { token, conta } ou null. */
export function sessao() {
  const token = lerArmazenado(CHAVE_TOKEN);
  const conta = lerArmazenado(CHAVE_CONTA);
  if (!token || !conta) return null;
  try {
    return { token, conta: JSON.parse(conta) };
  } catch {
    return null;
  }
}

export function salvarSessao(token, conta) {
  try {
    if (token) localStorage.setItem(CHAVE_TOKEN, token);
    localStorage.setItem(CHAVE_CONTA, JSON.stringify(conta));
  } catch {
    /* navegador sem armazenamento: o login vale só nesta página */
  }
}

export function sair(destino = "/index.html") {
  try {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_CONTA);
  } catch {
    /* nada a fazer */
  }
  if (destino) location.href = destino;
}

function irParaLogin() {
  const voltar = encodeURIComponent(location.pathname + location.search);
  sair(`/login.html?voltar=${voltar}`);
}

/**
 * Chama a API e devolve o JSON da resposta.
 * opcoes: { metodo: "POST", corpo: {...}, params: {...} }
 * Em erro, lança ErroApi com .status, .message (texto para o usuário) e .campos.
 */
export async function api(caminho, { metodo = "GET", corpo, params } = {}) {
  const url = new URL(BASE + caminho, location.origin);
  for (const [chave, valor] of Object.entries(params || {})) {
    if (valor !== undefined && valor !== null && valor !== "") url.searchParams.set(chave, valor);
  }

  const cabecalhos = { Accept: "application/json" };
  if (corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
  const atual = sessao();
  if (atual) cabecalhos.Authorization = `Bearer ${atual.token}`;

  let resposta;
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(0, "Não foi possível falar com o servidor. Confira sua conexão e tente de novo.");
  }

  const dados = await resposta.json().catch(() => ({}));
  if (resposta.ok) return dados;

  const detalhe = typeof dados.detail === "string" ? dados.detail : "Algo deu errado. Tente de novo.";
  if (resposta.status === 401 && atual) {
    irParaLogin();
  } else if (resposta.status === 428) {
    location.href = "/completar-cadastro.html";
  }
  throw new ErroApi(resposta.status, detalhe, dados.campos);
}

/**
 * Garante que há alguém logado (e do tipo certo) antes de montar a página.
 * Uso: const conta = exigirLogin("COMUM");  // "COMUM", "ESTABELECIMENTO" ou "ONG"
 */
export function exigirLogin(...tipos) {
  const atual = sessao();
  if (!atual) {
    irParaLogin();
    throw new Error("login necessário");
  }
  if (tipos.length && !tipos.includes(atual.conta.tipo)) {
    location.href = atual.conta.pagina_inicial || "/index.html";
    throw new Error("tipo de conta errado");
  }
  return atual.conta;
}
