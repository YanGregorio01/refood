// Dashboard do comerciante (tela 5.6 do Figma; no celular, tela 3.1).
// Números do dia, gráfico de vendas da semana e últimas reservas vêm de
// GET /api/painel/resumo. O card "Previsão de sobras · IA" (novo, fora do
// Figma) vem de GET /api/painel/previsao.
import { api, exigirLogin } from "/js/api.js";
import {
  STATUS_RESERVA, badge, dia, esc, hojePorExtenso, hora, kg, moeda, montarPainel, numero, vazio,
} from "/js/ui.js";
import {
  diaMes, esqueletos, graficoDeBarras, inicial, localDaLoja, momento, mostrarErro,
} from "/js/painel-comum.js";

const conta = exigirLogin("ESTABELECIMENTO");
montarPainel(conta, "dashboard", await localDaLoja());

const saudacao = document.getElementById("saudacao");
saudacao.textContent = `Olá, ${conta.organizacao || conta.nome}! 👋`;
document.getElementById("data-hoje").textContent = hojePorExtenso();

// ================================================================ resumo do dia
let grafico = null; // guardado para poder apagar antes de desenhar de novo

async function carregarResumo() {
  const lista = document.getElementById("ultimas-reservas");
  lista.innerHTML = esqueletos(3, 76);
  try {
    const r = await api("/painel/resumo");
    saudacao.textContent = `Olá, ${r.loja.nome}! 👋`;
    document.getElementById("k-ativas").textContent = numero(r.sacolas_ativas);
    document.getElementById("k-pendentes").textContent = numero(r.reservas_pendentes);
    document.getElementById("k-vendidas").textContent = numero(r.vendidas_hoje);
    document.getElementById("k-receita").textContent = moeda(r.receita_mes);
    document.getElementById("grafico-aviso").hidden = true;
    desenharGrafico(r.vendas_7_dias);
    mostrarUltimasReservas(r.ultimas_reservas);
  } catch (erro) {
    document.querySelectorAll(".kpi strong").forEach((el) => { el.textContent = "—"; });
    document.getElementById("grafico-aviso").hidden = false;
    mostrarErro(lista, erro, carregarResumo);
  }
}

function desenharGrafico(dias) {
  const canvas = document.getElementById("grafico-vendas");
  // Texto para leitores de tela, já que o desenho do <canvas> não é lido.
  canvas.setAttribute("aria-label",
    `Sacolas vendidas por dia: ${dias.map((d) => `${d.rotulo} ${d.quantidade}`).join(", ")}.`);
  grafico?.destroy();
  grafico = graficoDeBarras(canvas, {
    rotulos: dias.map((d) => d.rotulo),
    titulos: dias.map((d) => `${d.rotulo}, ${diaMes(d.dia)}`),
    valores: dias.map((d) => d.quantidade),
    formatar: (v) => `${numero(v)} ${v === 1 ? "sacola vendida" : "sacolas vendidas"}`,
    formatarEixo: (v) => numero(v),
  });
}

/** A linha pequena embaixo de cada reserva: "Retirada até 19h30", "Retirado às 18h15"... */
function situacao(r) {
  if (r.status === "RETIRADA" && r.data_retirada) {
    return dia(r.data_retirada) === "Hoje" ? `Retirado às ${hora(r.data_retirada)}` : `Retirado ${momento(r.data_retirada)}`;
  }
  if (r.status === "PENDENTE") {
    return r.data_limite_retirada ? `Retirada até ${momento(r.data_limite_retirada)}` : "Aguardando retirada";
  }
  if (r.status === "CANCELADA") return "Cancelada pelo cliente";
  if (r.status === "NAO_COMPARECEU") return "Não foi retirada no prazo";
  return "";
}

function mostrarUltimasReservas(reservas) {
  const lista = document.getElementById("ultimas-reservas");
  if (!reservas.length) {
    lista.innerHTML = vazio("Nenhuma reserva ainda.", "Quando um cliente reservar uma sacola, ela aparece aqui.");
    return;
  }
  lista.innerHTML = reservas.map((r) => `
    <div class="item reserva">
      <span class="avatar" aria-hidden="true">${inicial(r.cliente)}</span>
      <div class="item-corpo">
        <strong>${esc(r.cliente)}</strong>
        <span>${esc(r.sacola)}${r.quantidade > 1 ? ` ×${r.quantidade}` : ""}</span>
        <small>${esc(situacao(r))}</small>
      </div>
      ${badge(STATUS_RESERVA, r.status)}
    </div>`).join("");
}

// ================================================================ previsão de sobras (IA)
const areaPrevisao = document.getElementById("previsao");
let previsao = null; // última resposta da API, usada ao clicar em um dia

async function carregarPrevisao() {
  areaPrevisao.innerHTML = '<div class="esqueleto" style="height:150px"></div>';
  try {
    previsao = await api("/painel/previsao");
  } catch (erro) {
    mostrarErro(areaPrevisao, erro, carregarPrevisao);
    return;
  }

  // Pouco histórico: o modelo não arrisca um palpite, só mostra o aviso.
  if (!previsao.suficiente || !previsao.dias.length) {
    areaPrevisao.innerHTML = `<p class="alerta alerta-info">${esc(previsao.aviso)}</p>`;
    return;
  }

  areaPrevisao.innerHTML = `
    <div class="previsao-barras" role="group" aria-label="Sacolas que devem sobrar em cada dia">
      ${previsao.dias.map(barraDoDia).join("")}
    </div>
    <p class="letra-miuda"><span class="legenda-laranja" aria-hidden="true"></span>Dia com a maior sobra prevista. Clique em um dia para ver o detalhe por categoria.</p>
    <p class="alerta alerta-info">${esc(previsao.sugestao)}</p>
    <div class="previsao-detalhe" id="previsao-detalhe" aria-live="polite"></div>
    <p class="letra-miuda">${esc(previsao.aviso)}<br>${textoDoModelo(previsao.modelo)}</p>`;

  mostrarDetalhe(previsao.maior_sobra?.data || previsao.dias[0].data);
}

/** Uma barra clicável por dia. A altura é proporcional às sacolas previstas. */
function barraDoDia(d) {
  const maiorValor = Math.max(1, ...previsao.dias.map((x) => x.sacolas)); // escala de no mínimo 1 sacola
  const altura = Math.round((d.sacolas / maiorValor) * 100);
  const ehMaior = d.data === previsao.maior_sobra?.data;
  return `
    <button type="button" class="dia-prev${ehMaior ? " maior" : ""}" data-dia="${esc(d.data)}" aria-pressed="false"
      aria-label="${esc(d.dia_semana)}, ${diaMes(d.data)}: cerca de ${numero(d.sacolas, 1)} sacolas${ehMaior ? " (maior sobra)" : ""}">
      <span class="valor">${numero(d.sacolas, 1)}</span>
      <span class="trilho"><span class="barra" style="height:${altura}%"></span></span>
      <span class="nome">${esc(d.dia_semana.slice(0, 3))}</span>
      <span>${diaMes(d.data)}</span>
    </button>`;
}

/** "Modelo: regressão linear (scikit-learn) · R² 0,62 · erro médio 7,4 pontos · 1.016 sacolas analisadas" */
function textoDoModelo(m) {
  if (!m) return "";
  return `Modelo: ${esc(m.tipo.toLowerCase())} · R² ${numero(m.r2, 2)} · erro médio ${numero(m.erro_medio_pontos, 1)} pontos`
    + ` · ${numero(m.amostras)} sacolas analisadas`;
}

/** Tabela por categoria do dia escolhido. */
function mostrarDetalhe(dataDoDia) {
  const d = previsao.dias.find((x) => x.data === dataDoDia);
  if (!d) return;
  areaPrevisao.querySelectorAll(".dia-prev").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.dia === dataDoDia));
  });

  const nomeDoDia = d.dia_semana.charAt(0).toUpperCase() + d.dia_semana.slice(1);
  const linhas = d.por_categoria.map((c) => `
    <tr>
      <td>${esc(c.categoria)}</td>
      <td class="n">${numero(c.oferta_media, 1)}</td>
      <td class="n">${numero(c.taxa_sobra)}%</td>
      <td class="n">${numero(c.sacolas, 1)}</td>
      <td class="n">${kg(c.kg)}</td>
    </tr>`).join("");

  document.getElementById("previsao-detalhe").innerHTML = `
    <h4>${esc(nomeDoDia)}, ${diaMes(d.data)}: cerca de ${numero(d.sacolas, 1)} sacolas (${kg(d.kg)})</h4>
    ${d.por_categoria.length ? `
      <div class="rolagem">
        <table class="tabela">
          <thead><tr>
            <th scope="col">Categoria</th>
            <th scope="col" class="n">Oferta média</th>
            <th scope="col" class="n">Costuma sobrar</th>
            <th scope="col" class="n">Sacolas previstas</th>
            <th scope="col" class="n">Kg previstos</th>
          </tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>` : '<p class="sutil">Nenhuma categoria com histórico para este dia.</p>'}`;
}

// Um único "ouvinte" de clique para todas as barras (elas são recriadas a cada carga).
areaPrevisao.addEventListener("click", (e) => {
  const botao = e.target.closest(".dia-prev");
  if (botao) mostrarDetalhe(botao.dataset.dia);
});

carregarResumo();
carregarPrevisao();
