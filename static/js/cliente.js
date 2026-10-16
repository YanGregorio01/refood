// =============================================================================
// Peças usadas só pelas páginas da área do cliente:
//   inicio.html (tela 5.5), checkout.html (6.3), reserva.html (6.4),
//   pedidos.html (6.5) e perfil.html (6.6).
//
// Aqui fica o que o ui.js não tem: algumas datas por extenso, ícones extras,
// avatar, barra de progresso, QR Code, mensagem de erro e uma janela modal.
// =============================================================================

import { data, dia, esc, hora, numero } from "/js/ui.js";

export const FORMAS_PAGAMENTO = { CARTAO: "Cartão de crédito", PIX: "Pix" };

// ----------------------------------------------------------------- datas e textos
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PERTO = ["Hoje", "Amanhã", "Ontem"];

/** "Hoje", "Ontem", "Amanhã" ou a data com o ano: "22 set 2026". */
export function diaComAno(iso) {
  const curto = dia(iso);
  if (PERTO.includes(curto)) return curto;
  const d = data(iso);
  return d ? `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}` : "";
}

/** Para o meio de uma frase: "hoje", "amanhã", "ontem" ou "em 16 out". */
export function diaNaFrase(iso) {
  const curto = dia(iso);
  return PERTO.includes(curto) ? curto.toLowerCase() : `em ${curto}`;
}

/** "Hoje • 18h às 19h30" */
export const horarioRetirada = (inicio, fim) => `${dia(inicio)} • ${hora(inicio)} às ${hora(fim)}`;

export const ehHoje = (iso) => dia(iso) === "Hoje";

/** plural(1, "sacola", "sacolas") = "1 sacola"; plural(3, ...) = "3 sacolas". */
export const plural = (n, singular, varios) => `${numero(n)} ${Number(n) === 1 ? singular : varios}`;

/** "Rua dos Pinheiros, 450 • Pinheiros, São Paulo" (texto puro: use esc() ao colocar no HTML). */
export function enderecoCompleto(lugar) {
  const regiao = [lugar.bairro, lugar.cidade].filter(Boolean).join(", ");
  return [lugar.endereco, regiao].filter(Boolean).join(" • ");
}

/** Link do Google Maps para o ponto da loja. */
export const linkComoChegar = (lat, lng) =>
  `https://www.google.com/maps/search/?api=1&query=${Number(lat)},${Number(lng)}`;

// ----------------------------------------------------------------- ícones extras
const svg = (desenho) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${desenho}</svg>`;

const ICONES = {
  check: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>'),
  loja: svg('<path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>'),
  seta: svg('<path d="M9 6l6 6-6 6"/>'),
  relogio: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
};
export const iconeCliente = (nome) => ICONES[nome] || "";

// ----------------------------------------------------------------- avatar e progresso
/** Foto da conta de demonstração (Camila); para as outras, a inicial do nome. */
export function avatar(conta, classe = "") {
  if (conta.email === "camila@refood.test") {
    return `<img class="avatar ${classe}" src="/img/avatares/camila.jpg" alt="">`;
  }
  return `<span class="avatar ${classe}" aria-hidden="true">${esc(conta.nome.charAt(0))}</span>`;
}

/** Barra de progresso acessível. O estilo (.barra) fica no CSS de cada página. */
export function barraProgresso(percentual, rotulo) {
  const p = Math.max(0, Math.min(100, Number(percentual) || 0));
  return `
    <div class="barra" role="progressbar" aria-label="${esc(rotulo)}"
         aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}">
      <span style="width: ${p}%"></span>
    </div>`;
}

// ----------------------------------------------------------------- QR Code
/**
 * Desenha o QR Code do código de retirada dentro do elemento.
 * Usa a biblioteca qrcodejs, carregada por <script> na página (variável global QRCode).
 */
export function gerarQrCode(elemento, codigo, tamanho = 168) {
  elemento.innerHTML = "";
  if (!window.QRCode) {
    elemento.innerHTML = `<p class="sutil">Não foi possível desenhar o QR Code. Mostre o código abaixo.</p>`;
    return;
  }
  new window.QRCode(elemento, { text: codigo, width: tamanho, height: tamanho, colorDark: "#1c4731" });
}

// ----------------------------------------------------------------- erro
/**
 * Mostra uma mensagem de erro no elemento. Sem `acao`, oferece "Tentar de novo"
 * (recarrega a página). Para um link, passe o HTML pronto em `acao`.
 */
export function mostrarErro(elemento, mensagem, acao = "") {
  const botao = acao || `<button class="btn btn-contorno btn-pequeno" type="button" data-recarregar>Tentar de novo</button>`;
  elemento.innerHTML = `
    <div class="alerta alerta-erro" role="alert">
      <p>${esc(mensagem)}</p>
      ${botao}
    </div>`;
  elemento.hidden = false;
  elemento.querySelector("[data-recarregar]")?.addEventListener("click", () => location.reload());
}

// ----------------------------------------------------------------- janela modal
/**
 * Abre uma janela modal com o HTML recebido. O HTML precisa ter um título
 * com id="modal-titulo". Botões com o atributo data-fechar fecham a janela.
 *
 * - o foco vai para o primeiro campo ou botão;
 * - Esc ou um clique fora da janela fecham;
 * - Tab não sai da janela enquanto ela está aberta;
 * - ao fechar, o foco volta para o botão que abriu.
 *
 * Enquanto uma requisição roda, marque a janela com aria-busy="true":
 * assim Esc e o clique fora não fecham no meio do envio.
 * Devolve { modal, fechar }.
 */
export function abrirModal(html) {
  const anterior = document.activeElement;
  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">${html}</div>`;
  document.body.append(fundo);
  const modal = fundo.querySelector(".modal");

  const focaveis = () =>
    [...modal.querySelectorAll("button, a[href], input, select, textarea")].filter((el) => !el.disabled);

  function fechar() {
    if (modal.getAttribute("aria-busy") === "true") return;
    document.removeEventListener("keydown", teclado);
    fundo.remove();
    anterior?.focus();
  }

  function teclado(evento) {
    if (evento.key === "Escape") fechar();
    if (evento.key !== "Tab") return;
    const lista = focaveis();
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  fundo.addEventListener("click", (evento) => {
    if (evento.target === fundo) fechar();
  });
  modal.querySelectorAll("[data-fechar]").forEach((botao) => botao.addEventListener("click", fechar));
  document.addEventListener("keydown", teclado);
  focaveis()[0]?.focus();

  return { modal, fechar };
}
