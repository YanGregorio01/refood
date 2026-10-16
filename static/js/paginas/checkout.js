// Tela 6.3 do Figma (Finalizar reserva).
// Mostra a sacola escolhida (checkout.html?id=ID_DA_SACOLA), a quantidade, a
// forma de pagamento (simulada) e o resumo. "Confirmar reserva" chama
// POST /api/reservas e leva para reserva.html (tela 6.4).
import { api, exigirLogin } from "/js/api.js";
import { esc, imagem, kg, montarRodape, montarTopo, moeda, parametros } from "/js/ui.js";
import { horarioRetirada, mostrarErro, plural } from "/js/cliente.js";

exigirLogin("COMUM");
montarTopo("catalogo");
montarRodape();

const LIMITE_POR_RESERVA = 5; // regra da API: de 1 a 5 sacolas por reserva

const form = document.getElementById("checkout");
const seletor = document.getElementById("quantidade");
const botao = document.getElementById("confirmar");
const aviso = document.getElementById("aviso");
const idSacola = parametros().get("id");
let sacola = null;

const LINK_CATALOGO = `<a class="btn btn-contorno btn-pequeno" href="/catalogo.html">Ver o catálogo</a>`;

// ----------------------------------------------------------------- mostrar na tela
function mostrarPedido(s) {
  document.getElementById("pedido").innerHTML = `
    <div class="pedido">
      <img class="pedido-foto" src="${imagem(s.foto)}" alt="">
      <div class="pedido-info">
        <span class="pedido-loja">${esc(s.estabelecimento)}</span>
        <strong class="pedido-nome">${esc(s.nome)}</strong>
        <span>${horarioRetirada(s.inicio_retirada, s.fim_retirada)}</span>
        <span class="sutil">${esc(s.endereco)} • ${esc(s.bairro)}</span>
      </div>
      <strong class="pedido-preco">${moeda(s.preco)}</strong>
    </div>`;

  // Quantidade: de 1 até o que resta da sacola, no máximo 5
  const maximo = Math.min(LIMITE_POR_RESERVA, s.quantidade);
  seletor.innerHTML = "";
  for (let n = 1; n <= maximo; n++) {
    seletor.add(new Option(String(n), String(n)));
  }
  document.getElementById("ajuda-quantidade").textContent = s.quantidade > LIMITE_POR_RESERVA
    ? `Até ${LIMITE_POR_RESERVA} sacolas por reserva.`
    : `Restam ${plural(s.quantidade, "sacola", "sacolas")}.`;
}

function atualizarResumo() {
  const qtd = Number(seletor.value) || 1;
  const total = sacola.preco * qtd;
  const economia = (sacola.preco_original - sacola.preco) * qtd;

  document.getElementById("n-itens").textContent = plural(qtd, "item", "itens");
  document.getElementById("rotulo-sacola").textContent = qtd > 1 ? `Sacola (${moeda(sacola.preco)} × ${qtd})` : "Sacola";
  document.getElementById("valor-sacola").textContent = moeda(total);
  document.getElementById("total").textContent = moeda(total);

  const caixa = document.getElementById("economia");
  caixa.innerHTML = `Você economiza <strong>${moeda(economia)}</strong> e ajuda a salvar cerca de
    <strong>${kg(sacola.peso_estimado_kg * qtd)}</strong> de alimento.`;
  caixa.hidden = false;
}

/** Sacola esgotada, removida ou fora do horário: avisa e trava a confirmação. */
function bloquear() {
  aviso.innerHTML = `
    <div class="alerta alerta-info" role="status">
      <p>Esta sacola não está mais disponível para reserva.</p>
      ${LINK_CATALOGO}
    </div>`;
  seletor.disabled = true;
  botao.disabled = true;
  document.getElementById("economia").hidden = true;
}

// ----------------------------------------------------------------- carregar
async function carregar() {
  if (!idSacola) {
    form.hidden = true;
    mostrarErro(document.getElementById("erro"), "Nenhuma sacola foi escolhida.", LINK_CATALOGO);
    return;
  }
  try {
    sacola = await api(`/sacolas/${encodeURIComponent(idSacola)}`);
  } catch (erro) {
    form.hidden = true;
    mostrarErro(document.getElementById("erro"), erro.message, erro.status === 404 ? LINK_CATALOGO : "");
    return;
  }

  mostrarPedido(sacola);
  atualizarResumo();
  if (!sacola.disponivel || sacola.quantidade < 1) {
    bloquear();
    return;
  }
  seletor.disabled = false;
  botao.disabled = false;
}

// ----------------------------------------------------------------- confirmar
seletor.addEventListener("change", atualizarResumo);

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (!sacola || botao.disabled) return;

  botao.disabled = true;
  botao.textContent = "Confirmando…";
  aviso.innerHTML = "";
  try {
    const reserva = await api("/reservas", {
      metodo: "POST",
      corpo: {
        id_alimento: sacola.id_alimento,
        quantidade: Number(seletor.value),
        forma_pagamento: form.elements.forma_pagamento.value,
      },
    });
    // replace(): assim o "voltar" do navegador não abre de novo um checkout já confirmado
    location.replace(`/reserva.html?id=${reserva.id_reserva}&nova=1`);
  } catch (erro) {
    botao.textContent = "Confirmar reserva";
    if (erro.status === 409) {
      // Esgotou ou restam menos sacolas: busca a sacola de novo para atualizar a tela
      await carregar();
      if (!botao.disabled) {
        aviso.innerHTML = `
          <div class="alerta alerta-erro" role="alert"><p>${esc(erro.message)}</p>${LINK_CATALOGO}</div>`;
      }
    } else {
      aviso.innerHTML = `<div class="alerta alerta-erro" role="alert"><p>${esc(erro.message)}</p></div>`;
      botao.disabled = false;
    }
  }
});

carregar();
