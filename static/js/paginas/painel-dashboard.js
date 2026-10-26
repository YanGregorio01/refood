// Dashboard do comerciante (tela 5.6 do Figma; no celular, tela 3.1).
// Números do dia, gráfico de vendas da semana e últimas reservas vêm de
// GET /api/painel/resumo.
import { api, exigirLogin } from "/js/api.js";
import {
  STATUS_RESERVA, badge, dia, esc, hojePorExtenso, hora, moeda, montarPainel, numero, vazio,
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

carregarResumo();
