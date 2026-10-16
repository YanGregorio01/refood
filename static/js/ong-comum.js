// =============================================================================
// Peças usadas só pelas páginas da ONG (telas 6.10, 6.11 e 6.12 do Figma):
// cálculo de refeições, nomes de meses, datas por extenso e a cidade da ONG
// no rodapé do menu lateral.
// =============================================================================

import { api } from "/js/api.js";
import { data, dia, hora } from "/js/ui.js";

// ----------------------------------------------------------------- números
/**
 * Refeições que dá para preparar com tantos quilos (uma refeição ≈ 400 g).
 * Conta em "pedaços de 10 g" (inteiros) porque 1.2 / 0.4 dá 2,9999… no
 * JavaScript, e o arredondamento para baixo viraria 2 em vez de 3.
 */
export function refeicoes(kg) {
  const dezenasDeGramas = Math.round(Number(kg || 0) * 100);
  return Math.floor(dezenasDeGramas / 40);
}

/** plural(1, "parceiro") → "1 parceiro"; plural(3, "parceiro") → "3 parceiros". */
export function plural(n, singular, formaPlural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : formaPlural}`;
}

// ----------------------------------------------------------------- datas
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const doisDigitos = (n) => String(n).padStart(2, "0");

/** Date → "2026-10" (o formato do parâmetro `mes` da API). */
export const paraMes = (d) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}`;

/** "2026-10" → "outubro". */
export function nomeDoMes(aaaaMm) {
  const mes = Number(String(aaaaMm).split("-")[1]);
  return MESES[mes - 1] || "";
}

/** "2026-10" → "Outubro de 2026". */
export function mesPorExtenso(aaaaMm) {
  const nome = nomeDoMes(aaaaMm);
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${String(aaaaMm).split("-")[0]}`;
}

/** "2026-09-28T15:47:00" → "28 set 2026 • 15h47" (histórico, sempre com o ano). */
export function dataCompleta(iso) {
  const d = data(iso);
  if (!d) return "";
  return `${d.getDate()} ${MESES_CURTOS[d.getMonth()]} ${d.getFullYear()} • ${hora(iso)}`;
}

/**
 * Até quando uma oferta de doação fica aberta, para completar a frase
 * "12 kg disponíveis …": "hoje" ou "até amanhã, 19h" / "até 20 out, 19h".
 */
export function prazoDaOferta(iso) {
  const quando = dia(iso);
  if (quando === "Hoje") return "hoje";
  return `até ${quando.toLowerCase()}, ${hora(iso)}`;
}

// ----------------------------------------------------------------- pausa na digitação
/**
 * Devolve uma versão de `funcao` que só roda depois que a pessoa para de
 * digitar por `ms` milissegundos. Evita uma requisição a cada letra da busca.
 */
export function comPausa(funcao, ms = 350) {
  let espera;
  return (...args) => {
    clearTimeout(espera);
    espera = setTimeout(() => funcao(...args), ms);
  };
}

// ----------------------------------------------------------------- cidade no menu lateral
// A conta do login não traz a cidade da ONG; ela vem do perfil (ou da lista de
// ofertas). Guardamos na sessão para o menu já abrir com "São Paulo, SP".
const chaveCidade = (conta) => `refood.ong.cidade.${conta.id_usuario}`;

/** Cidade guardada da ONG ("São Paulo, SP") ou "" se ainda não sabemos. */
export function cidadeDaOng(conta) {
  try {
    return sessionStorage.getItem(chaveCidade(conta)) || "";
  } catch {
    return "";
  }
}

/**
 * Escreve a cidade no menu lateral montado por montarPainel().
 * ong: os dados da ONG, se a página já os tem; sem eles, busca GET /ong/perfil
 * (só quando a cidade ainda não está guardada).
 */
export async function atualizarCidade(conta, ong = null) {
  if (!ong && cidadeDaOng(conta)) return;
  try {
    const dados = ong || (await api("/ong/perfil"));
    const texto = [dados.cidade, dados.uf].filter(Boolean).join(", ");
    try { sessionStorage.setItem(chaveCidade(conta), texto); } catch { /* segue sem guardar */ }
    const subtitulo = document.querySelector("#lateral .quem small");
    if (subtitulo) subtitulo.textContent = texto;
  } catch {
    /* sem a cidade, o menu continua funcionando */
  }
}
