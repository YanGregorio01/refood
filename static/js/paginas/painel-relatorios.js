// Relatórios da loja (tela 6.9 do Figma; no celular, tela 3.4).
// Indicadores, receita por dia, vendas por categoria e avaliações recentes de
// GET /api/painel/relatorios?dias=7|30|90. "Exportar relatório" gera um CSV
// no próprio navegador, sem pedir nada novo à API.
import { api, exigirLogin } from "/js/api.js";
import {
  data, esc, estrelas, kg, moeda, montarPainel, numero, relativo, vazio,
} from "/js/ui.js";
import {
  cor, dataISO, diaMes, esqueletos, graficoDeBarras, inicial, localDaLoja, mostrarErro,
} from "/js/painel-comum.js";

const conta = exigirLogin("ESTABELECIMENTO");
montarPainel(conta, "relatorios", await localDaLoja());

const botaoExportar = document.getElementById("b-exportar");
let dias = 30;        // período escolhido
let dados = null;     // última resposta da API (o CSV sai daqui)
let grafico = null;

// ================================================================ carregar
async function carregar() {
  botaoExportar.disabled = true;
  document.getElementById("subtitulo").textContent =
    `Resultados da ${conta.organizacao || "sua loja"} nos últimos ${dias} dias.`;
  document.getElementById("k-receita-rotulo").textContent = `Receita nos últimos ${dias} dias`;
  document.getElementById("badge-periodo").textContent = `Últimos ${dias} dias`;
  document.querySelectorAll(".kpi strong").forEach((el) => { el.textContent = "…"; });
  document.getElementById("categorias").innerHTML = esqueletos(2, 40);
  document.getElementById("avaliacoes").innerHTML = esqueletos(3, 110);

  try {
    dados = await api("/painel/relatorios", { params: { dias } });
  } catch (erro) {
    dados = null;
    desenharGrafico([]); // apaga o gráfico do período anterior
    document.querySelectorAll(".kpi strong").forEach((el) => { el.textContent = "—"; });
    document.querySelectorAll(".kpi small").forEach((el) => { el.textContent = ""; });
    document.getElementById("categorias").innerHTML = "";
    mostrarErro(document.getElementById("avaliacoes"), erro, carregar);
    return;
  }

  mostrarIndicadores(dados);
  desenharGrafico(dados.receita_diaria);
  mostrarCategorias(dados.vendas_por_categoria);
  mostrarAvaliacoes(dados.avaliacoes_recentes);
  botaoExportar.disabled = false;
}

// ================================================================ indicadores (KPIs)
function mostrarIndicadores(d) {
  document.getElementById("k-receita").textContent = moeda(d.receita);

  // "↑ 18,4% vs. período anterior" em verde ou "↓ 3,2% ..." em coral; some se não houver base de comparação
  const variacao = document.getElementById("k-variacao");
  variacao.hidden = d.variacao_receita === null;
  if (d.variacao_receita !== null) {
    const subiu = d.variacao_receita >= 0;
    variacao.className = subiu ? "sobe" : "desce";
    variacao.textContent = `${subiu ? "↑" : "↓"} ${numero(Math.abs(d.variacao_receita), 1)}% vs. período anterior`;
  }

  document.getElementById("k-kg").textContent = kg(d.kg_salvos);
  document.getElementById("k-refeicoes").textContent = `equivale a ${numero(d.refeicoes)} refeições`;

  document.getElementById("k-vendidas").textContent = numero(d.sacolas_vendidas);
  document.getElementById("k-aproveitamento").textContent =
    d.aproveitamento === null ? "" : `${numero(d.aproveitamento)}% de aproveitamento`;

  document.getElementById("k-nota").textContent = d.nota_media === null ? "—" : `${numero(d.nota_media, 1)} ★`;
  document.getElementById("k-avaliacoes").textContent = d.total_avaliacoes
    ? `${numero(d.total_avaliacoes)} ${d.total_avaliacoes === 1 ? "avaliação" : "avaliações"}`
    : "Ainda sem avaliações";
}

// ================================================================ gráfico "Receita diária"
const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function desenharGrafico(receitaDiaria) {
  const canvas = document.getElementById("grafico-receita");
  grafico?.destroy();
  grafico = null;
  if (!receitaDiaria.length) return;
  const ultimo = receitaDiaria.length - 1; // o último dia da lista é hoje

  // Resumo em texto para leitores de tela (o desenho do <canvas> não é lido)
  const melhor = receitaDiaria.reduce((a, b) => (b.valor > a.valor ? b : a), receitaDiaria[0]);
  canvas.setAttribute("aria-label", `Receita por dia nos últimos ${dias} dias. Total de ${moeda(dados.receita)}; `
    + `melhor dia ${diaMes(melhor.dia)}, com ${moeda(melhor.valor)}.`);

  grafico = graficoDeBarras(canvas, {
    rotulos: receitaDiaria.map((d) => diaMes(d.dia)),
    titulos: receitaDiaria.map((d, i) => (i === ultimo
      ? "Hoje (dia em andamento)"
      : `${DIAS_DA_SEMANA[data(d.dia).getDay()]}, ${diaMes(d.dia)}`)),
    valores: receitaDiaria.map((d) => d.valor),
    cores: receitaDiaria.map((d, i) => (i === ultimo ? cor("--verde-claro") : cor("--verde"))),
    formatar: moeda,
    formatarEixo: (v) => `R$ ${numero(v)}`,
  });
}

// ================================================================ vendas por categoria
function mostrarCategorias(categorias) {
  const area = document.getElementById("categorias");
  if (!categorias.length) {
    area.innerHTML = vazio("Nenhuma venda no período.");
    return;
  }
  area.innerHTML = categorias.map((c) => `
    <div class="categoria">
      <div class="categoria-linha"><span>${esc(c.categoria)}</span><strong>${numero(c.percentual)}%</strong></div>
      <div class="trilho" aria-hidden="true"><div class="preenchido" style="width:${Number(c.percentual) || 0}%"></div></div>
      <small>${numero(c.quantidade)} ${Number(c.quantidade) === 1 ? "sacola vendida" : "sacolas vendidas"}</small>
    </div>`).join("");
}

// ================================================================ avaliações recentes
function mostrarAvaliacoes(avaliacoes) {
  const area = document.getElementById("avaliacoes");
  if (!avaliacoes.length) {
    area.innerHTML = vazio("Ainda não há avaliações com comentário.");
    return;
  }
  area.innerHTML = avaliacoes.map((a) => `
    <article class="avaliacao">
      <div class="avaliacao-topo">
        <span class="avatar" aria-hidden="true">${inicial(a.cliente)}</span>
        <div><strong>${esc(a.cliente)}</strong><small>${relativo(a.data_avaliacao)}</small></div>
        ${estrelas(a.nota)}
      </div>
      <p>${esc(a.comentario)}</p>
    </article>`).join("");
}

// ================================================================ exportar CSV
/** 3154.6 vira "3154,60": vírgula decimal, que o Excel em português entende. */
const decimal = (valor, casas) => Number(valor).toFixed(casas).replace(".", ",");
/** "2026-09-17" vira "17/09/2026". */
const dataBR = (iso) => iso.split("-").reverse().join("/");
/** Põe aspas no texto que tiver ";" ou aspas, para não quebrar as colunas. */
function celula(valor) {
  const texto = String(valor ?? "");
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function exportarCSV() {
  const d = dados;
  const primeiro = d.receita_diaria[0]?.dia;
  const ultimo = d.receita_diaria[d.receita_diaria.length - 1]?.dia;
  const linhas = [
    ["Relatório Refood", conta.organizacao || ""],
    ["Período", `últimos ${d.dias} dias (${primeiro ? dataBR(primeiro) : ""} a ${ultimo ? dataBR(ultimo) : ""})`],
    [],
    ["Indicador", "Valor"],
    ["Receita (R$)", decimal(d.receita, 2)],
    ["Variação da receita vs. período anterior (%)", d.variacao_receita === null ? "" : decimal(d.variacao_receita, 1)],
    ["Sacolas vendidas", d.sacolas_vendidas],
    ["Aproveitamento (%)", d.aproveitamento ?? ""],
    ["Alimentos não desperdiçados (kg)", decimal(d.kg_salvos, 1)],
    ["Doados a ONGs (kg)", decimal(d.kg_doados, 1)],
    ["Refeições equivalentes", d.refeicoes],
    ["Nota média", d.nota_media === null ? "" : decimal(d.nota_media, 1)],
    ["Avaliações", d.total_avaliacoes],
    [],
    ["Dia", "Receita (R$)"],
    ...d.receita_diaria.map((x) => [dataBR(x.dia), decimal(x.valor, 2)]),
    [],
    ["Categoria", "Sacolas vendidas", "Participação (%)"],
    ...d.vendas_por_categoria.map((c) => [c.categoria, c.quantidade, c.percentual]),
  ];
  const texto = linhas.map((linha) => linha.map(celula).join(";")).join("\r\n");

  // "﻿" no começo avisa ao Excel que o arquivo é UTF-8 (sem isso os acentos quebram).
  const arquivo = new Blob([`﻿${texto}`], { type: "text/csv;charset=utf-8" });
  const endereco = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = endereco;
  link.download = `relatorio-refood-${d.dias}-dias-${dataISO(new Date())}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(endereco), 1000); // libera a memória depois que o download começou
}

botaoExportar.addEventListener("click", () => {
  if (dados) exportarCSV();
});

// ================================================================ período
document.querySelectorAll("[data-dias]").forEach((chip) => {
  chip.addEventListener("click", () => {
    dias = Number(chip.dataset.dias);
    document.querySelectorAll("[data-dias]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    carregar();
  });
});

carregar();
