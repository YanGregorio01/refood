// Tela 6.12 do Figma: Histórico de recebimentos (no celular, tela 4.3).
// KPIs do mês escolhido (GET /api/ong/resumo?mes=), filtros (busca, período e
// status) e a lista de GET /api/ong/solicitacoes agrupada por mês.
// "Exportar relatório" gera no navegador um CSV com as linhas filtradas.
import { api, exigirLogin } from "/js/api.js";
import { badge, esc, imagem, kg, montarPainel, numero, STATUS_DOACAO, toast, vazio } from "/js/ui.js";
import {
  atualizarCidade, cidadeDaOng, comPausa, dataCompleta, mesPorExtenso, nomeDoMes, paraMes, plural,
} from "/js/ong-comum.js";

const conta = exigirLogin("ONG");
montarPainel(conta, "recebimentos", cidadeDaOng(conta));
atualizarCidade(conta);

const form = document.getElementById("filtros");
const campoMes = document.getElementById("mes");
const lista = document.getElementById("lista");
const botaoExportar = document.getElementById("exportar");

let linhas = [];       // o que está na tela agora (é o que vai para o CSV)
let ultimoResumo = 0;  // números das requisições mais recentes: respostas
let ultimaLista = 0;   // atrasadas de um filtro antigo são ignoradas

// ----------------------------------------------------------------- período
/** Opções do select: o mês atual e os 5 anteriores ("Outubro de 2026"…). */
function preencherMeses() {
  const hoje = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1); // mês -1 vira dezembro do ano anterior
    const valor = paraMes(d);
    // new Option(texto, valor, selecionadoPorPadrão, selecionadoAgora): o "padrão" é o que o Limpar restaura
    campoMes.append(new Option(mesPorExtenso(valor), valor, i === 0, i === 0));
  }
}

/** "2026-10" → "2026-09". */
function mesAnterior(aaaaMm) {
  const [ano, mes] = aaaaMm.split("-").map(Number);
  return paraMes(new Date(ano, mes - 2, 1));
}

// ----------------------------------------------------------------- KPIs
async function carregarResumo() {
  const mes = campoMes.value;
  const minha = ++ultimoResumo;
  const kpiKg = document.getElementById("kpi-kg");
  const variacao = document.getElementById("kpi-variacao");
  const doacoes = document.getElementById("kpi-doacoes");
  const parceiros = document.getElementById("kpi-parceiros");
  const refeicoes = document.getElementById("kpi-refeicoes");
  const impacto = document.getElementById("kpi-impacto");

  document.getElementById("kpi-kg-rotulo").textContent =
    mes === paraMes(new Date()) ? "Recebido este mês" : `Recebido em ${nomeDoMes(mes)}`;
  kpiKg.textContent = doacoes.textContent = refeicoes.textContent = "…";

  try {
    const r = await api("/ong/resumo", { params: { mes } });
    if (minha !== ultimoResumo) return;
    kpiKg.textContent = kg(r.recebido_kg);
    doacoes.textContent = numero(r.doacoes_concluidas);
    parceiros.textContent = `de ${plural(r.parceiros, "parceiro")}`;
    refeicoes.textContent = numero(r.refeicoes_estimadas);
    impacto.textContent = `impacto em ${nomeDoMes(mes)}`;

    // Sem mês anterior para comparar, a API manda null e a linha some.
    const v = r.variacao_percentual;
    variacao.hidden = v === null;
    if (v !== null) {
      const seta = v > 0 ? "↑" : v < 0 ? "↓" : "=";
      variacao.className = v < 0 ? "desce" : "sobe";
      variacao.textContent = `${seta} ${Math.abs(v)}% vs. ${nomeDoMes(mesAnterior(mes))}`;
    }
  } catch {
    if (minha !== ultimoResumo) return;
    kpiKg.textContent = doacoes.textContent = refeicoes.textContent = "—";
    variacao.hidden = true;
    parceiros.textContent = impacto.textContent = "Não foi possível carregar.";
  }
}

// ----------------------------------------------------------------- lista
/** No Figma a etiqueta é "Recebido"; os outros status usam os textos do ui.js. */
function etiqueta(status) {
  return status === "RECEBIDA" ? '<span class="badge">Recebido</span>' : badge(STATUS_DOACAO, status);
}

function itemRecebimento(p) {
  const foto = p.foto
    ? `<img class="recebimento-foto" src="${esc(imagem(p.foto))}" alt="" loading="lazy">`
    : `<span class="recebimento-foto" aria-hidden="true">${esc(p.estabelecimento.charAt(0))}</span>`;
  const quando = p.status === "RECEBIDA"
    ? dataCompleta(p.data_recebimento || p.data_retirada)
    : `Retirada: ${dataCompleta(p.data_retirada)}`;
  return `
    <article class="card recebimento">
      ${foto}
      <div class="recebimento-loja">
        <div class="recebimento-nome"><h3>${esc(p.estabelecimento)}</h3>${etiqueta(p.status)}</div>
        <span class="sutil">${quando}</span>
      </div>
      <dl class="recebimento-dados">
        <div><dt>Tipo</dt><dd>${esc(p.tipo_alimento)}</dd></div>
        <div><dt>Quantidade</dt><dd class="quilos">${kg(p.quantidade_kg)}</dd></div>
        <div><dt>Impacto</dt><dd class="impacto">${plural(p.refeicoes, "refeição", "refeições")}</dd></div>
      </dl>
    </article>`;
}

/** Separa os itens por mês ("2026-10") na ordem em que vieram. A API filtra o mês pela data de retirada. */
function agruparPorMes(itens) {
  const grupos = new Map();
  for (const item of itens) {
    const mes = item.data_retirada.slice(0, 7);
    if (!grupos.has(mes)) grupos.set(mes, []);
    grupos.get(mes).push(item);
  }
  return grupos;
}

function mostrarLista(filtros) {
  botaoExportar.disabled = linhas.length === 0;
  const soRecebidos = filtros.status === "RECEBIDA";

  if (!linhas.length) {
    const titulo = filtros.busca
      ? `Nada encontrado para "${filtros.busca}"`
      : soRecebidos ? "Nenhum recebimento neste período" : "Nenhuma solicitação neste período";
    lista.innerHTML = `<div class="card">${vazio(titulo, "Tente outro período ou limpe os filtros.")}</div>`;
    return;
  }

  let html = "";
  for (const [mes, itens] of agruparPorMes(linhas)) {
    const total = itens.reduce((soma, p) => soma + Number(p.quantidade_kg), 0);
    const quantos = soRecebidos
      ? plural(itens.length, "recebimento")
      : plural(itens.length, "solicitação", "solicitações");
    html += `
      <section class="grupo">
        <div class="grupo-topo"><h2>${esc(mesPorExtenso(mes))}</h2><span>${quantos} • ${kg(total)}</span></div>
        ${itens.map(itemRecebimento).join("")}
      </section>`;
  }
  lista.innerHTML = html;
}

async function carregarLista() {
  const filtros = Object.fromEntries(new FormData(form)); // { busca, mes, status }
  const minha = ++ultimaLista;
  botaoExportar.disabled = true;
  lista.setAttribute("aria-busy", "true");
  lista.innerHTML = '<div class="esqueleto" style="height:96px"></div>'.repeat(3);
  try {
    const itens = await api("/ong/solicitacoes", { params: filtros });
    if (minha !== ultimaLista) return;
    linhas = itens;
    mostrarLista(filtros);
  } catch (erro) {
    if (minha !== ultimaLista) return;
    linhas = [];
    lista.innerHTML = `
      <div class="alerta alerta-erro" role="alert">
        <div><p>${esc(erro.message)}</p>
        <button class="btn btn-contorno btn-pequeno" type="button" data-tentar style="margin-top:10px">Tentar de novo</button></div>
      </div>`;
  } finally {
    if (minha === ultimaLista) lista.removeAttribute("aria-busy");
  }
}

// ----------------------------------------------------------------- exportar CSV
/** Uma célula do CSV, protegida para abrir certo no Excel/Planilhas. */
function celula(valor) {
  let texto = String(valor ?? "");
  // Planilhas tratam células que começam com = + - @ como fórmula; o apóstrofo impede isso.
  if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
  // Com ponto e vírgula, aspas ou quebra de linha, a célula vai entre aspas (e as aspas de dentro dobram).
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** "2026-10-16T21:30:00" → "16/10/2026 21:30" (lendo direto as partes do texto ISO). */
const dataPlanilha = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}` : "");

function exportar() {
  const cabecalho = ["Estabelecimento", "Tipo de alimento", "Quantidade (kg)", "Refeições estimadas",
    "Status", "Retirada", "Recebimento"];
  const corpo = linhas.map((p) => [
    p.estabelecimento,
    p.tipo_alimento,
    numero(p.quantidade_kg, 1), // "12,4": vírgula decimal, como as planilhas em português esperam
    p.refeicoes,
    STATUS_DOACAO[p.status]?.texto || p.status,
    dataPlanilha(p.data_retirada),
    dataPlanilha(p.data_recebimento),
  ]);
  // Separador ";" porque a vírgula já é o decimal. O "﻿" (BOM) faz o Excel ler os acentos em UTF-8.
  const texto = "﻿" + [cabecalho, ...corpo].map((linha) => linha.map(celula).join(";")).join("\r\n");

  const arquivo = new Blob([texto], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = `refood-recebimentos-${campoMes.value}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // libera a memória depois que o download começou
  toast(`Relatório exportado com ${plural(linhas.length, "linha")}.`, "ok");
}

// ----------------------------------------------------------------- eventos
form.addEventListener("submit", (e) => {
  e.preventDefault();
  carregarLista();
});
form.addEventListener("change", (e) => {
  if (e.target.name === "busca") return; // a busca tem o próprio evento, logo abaixo
  if (e.target.name === "mes") carregarResumo(); // os KPIs só dependem do período
  carregarLista();
});
form.elements.busca.addEventListener("input", comPausa(carregarLista));

document.getElementById("limpar").addEventListener("click", () => {
  form.reset(); // volta ao mês atual e ao status "Recebido" (as opções marcadas como padrão)
  carregarResumo();
  carregarLista();
});
botaoExportar.addEventListener("click", exportar);
lista.addEventListener("click", (e) => {
  if (e.target.closest("[data-tentar]")) carregarLista();
});

preencherMeses();
carregarResumo();
carregarLista();
