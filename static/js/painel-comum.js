// =============================================================================
// Peças usadas só pelas páginas do painel do comerciante (pasta /painel):
// dashboard, sacolas, pedidos, relatórios e doações.
//
// O que é de todo o site (formatação, menu lateral, toast...) continua no
// /js/ui.js. Aqui ficam: o "Bairro, Cidade" do menu, textos de horário,
// estados de carregando/erro, o modal de confirmação e o gráfico de barras.
// =============================================================================

import { api } from "/js/api.js";
import { data, dia, esc, hora, vazio } from "/js/ui.js";

// ----------------------------------------------------------------- loja
/** "Pinheiros, São Paulo": vai no menu lateral, embaixo do nome da loja. */
export async function localDaLoja() {
  try {
    const loja = await api("/painel/estabelecimento");
    return [loja.bairro, loja.cidade].filter(Boolean).join(", ");
  } catch {
    return ""; // sem o local o painel funciona do mesmo jeito
  }
}

// ----------------------------------------------------------------- datas e horários
/** "18h às 19h30" (o ui.js tem faixa(), que escreve "18h - 19h30"). */
export const faixaAs = (inicio, fim) => `${hora(inicio)} às ${hora(fim)}`;

/** "Hoje • 18h às 19h30" */
export const diaEFaixa = (inicio, fim) => `${dia(inicio)} • ${faixaAs(inicio, fim)}`;

/** "20/10" */
export function diaMes(iso) {
  const d = data(iso);
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Date vira "2026-10-16", no horário local (toISOString() usaria o fuso UTC). */
export function dataISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "19h30" se for hoje; senão "amanhã, 19h30", "ontem, 19h30" ou "15 out, 19h30". */
export function momento(iso) {
  const qual = dia(iso);
  return qual === "Hoje" ? hora(iso) : `${qual.toLowerCase()}, ${hora(iso)}`;
}

/** Primeira letra do nome, para o avatar redondo. */
export const inicial = (nome) => esc(String(nome || "?").trim().charAt(0).toUpperCase());

// ----------------------------------------------------------------- estados de tela
/** HTML de n blocos cinza piscando, enquanto os dados não chegam. */
export function esqueletos(quantos, altura = 72) {
  return `<div class="esqueleto" style="height:${altura}px"></div>`.repeat(quantos);
}

/** Troca o conteúdo da área por uma mensagem de erro com o botão "Tentar de novo". */
export function mostrarErro(area, erro, tentarDeNovo) {
  area.innerHTML = vazio(
    "Não foi possível carregar.",
    erro.message,
    '<button type="button" class="btn btn-contorno btn-pequeno">Tentar de novo</button>',
  );
  area.querySelector("button").addEventListener("click", tentarDeNovo);
}

/**
 * Desabilita o botão enquanto a requisição não volta (evita clique duplo).
 * Uso: await enquantoEspera(botao, () => api("/rota", { metodo: "POST" }));
 */
export async function enquantoEspera(botao, tarefa) {
  botao.disabled = true;
  try {
    return await tarefa();
  } finally {
    botao.disabled = false;
  }
}

// ----------------------------------------------------------------- modal de confirmação
/**
 * Pergunta antes de uma ação que não dá para desfazer. Devolve uma Promise
 * que vira true (confirmou) ou false (cancelou, apertou Esc ou clicou fora).
 *
 *   if (await confirmar({ titulo: "Remover?", texto: "...", botao: "Remover", perigo: true })) { ... }
 */
export function confirmar({ titulo, texto, botao = "Confirmar", perigo = false }) {
  return new Promise((resolve) => {
    const focoAnterior = document.activeElement;
    const fundo = document.createElement("div");
    fundo.className = "modal-fundo";
    fundo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo" aria-describedby="modal-texto">
        <h3 id="modal-titulo">${esc(titulo)}</h3>
        <p id="modal-texto" class="muted">${esc(texto)}</p>
        <div style="display:flex; gap:12px; justify-content:flex-end; flex-wrap:wrap">
          <button type="button" class="btn btn-contorno" data-resposta="nao">Cancelar</button>
          <button type="button" class="btn ${perigo ? "btn-perigo" : "btn-primario"}" data-resposta="sim">${esc(botao)}</button>
        </div>
      </div>`;
    const botoes = [...fundo.querySelectorAll("button")];

    function fechar(resposta) {
      fundo.remove();
      document.removeEventListener("keydown", teclado);
      focoAnterior?.focus();
      resolve(resposta);
    }
    function teclado(e) {
      if (e.key === "Escape") fechar(false);
      if (e.key === "Tab") {
        // mantém o foco dentro do modal, pulando entre os dois botões
        e.preventDefault();
        const atual = botoes.indexOf(document.activeElement);
        const proximo = (atual + (e.shiftKey ? -1 : 1) + botoes.length) % botoes.length;
        botoes[proximo].focus();
      }
    }

    fundo.addEventListener("click", (e) => {
      if (e.target === fundo) return fechar(false); // clicou fora da caixa
      const escolhido = e.target.closest("[data-resposta]");
      if (escolhido) fechar(escolhido.dataset.resposta === "sim");
    });
    document.addEventListener("keydown", teclado);
    document.body.append(fundo);
    botoes[0].focus(); // começa no "Cancelar", a opção segura
  });
}

// ----------------------------------------------------------------- gráficos (Chart.js)
/** Lê uma cor do refood.css, para o gráfico usar os mesmos tokens da página. */
export const cor = (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim();

/**
 * Gráfico de barras com o Chart.js (a página carrega a biblioteca pelo CDN).
 * opcoes: rotulos (eixo X), valores, cores (uma cor ou uma por barra),
 *         titulos (título da dica de cada barra), formatar (valor -> texto da dica),
 *         formatarEixo (valor -> texto do eixo Y).
 * Devolve o gráfico, para a página poder chamar .destroy() antes de redesenhar.
 */
export function graficoDeBarras(canvas, {
  rotulos, valores, cores, titulos = rotulos, formatar = String, formatarEixo = formatar,
}) {
  // Sem internet o CDN não carrega: avisa no lugar do gráfico em vez de quebrar a página.
  if (typeof Chart === "undefined") {
    canvas.insertAdjacentHTML("afterend", '<p class="sutil">Não foi possível carregar o gráfico.</p>');
    return null;
  }
  Chart.defaults.font.family = "Inter, 'Segoe UI', system-ui, sans-serif";
  Chart.defaults.color = cor("--texto-3");

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: rotulos,
      datasets: [{
        data: valores,
        backgroundColor: cores || cor("--verde"),
        borderRadius: 4,
        borderSkipped: "start", // arredonda só a ponta de cima da barra
        maxBarThickness: 28,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // a altura vem do CSS da caixa em volta do <canvas>
      plugins: {
        legend: { display: false }, // uma série só: o título do card já diz o que é
        tooltip: {
          displayColors: false,
          callbacks: {
            title: (itens) => titulos[itens[0].dataIndex],
            label: (item) => formatar(item.raw),
          },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: cor("--linha") },
          ticks: { maxTicksLimit: 4, precision: 0, callback: (v) => formatarEixo(v) },
        },
      },
    },
  });
}
