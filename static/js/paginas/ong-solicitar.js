// Tela 6.11 do Figma: Solicitar doação (no celular, tela 4.2).
// Recebe ?oferta=ID, procura a oferta em GET /api/ong/ofertas (não existe rota
// de uma oferta só), preenche o formulário e o card "Resumo" e envia
// POST /api/ong/solicitacoes. Deu certo: vai para solicitacoes.html?nova=ID.
import { api, exigirLogin } from "/js/api.js";
import {
  data, dia, diaHora, distancia, esc, hora, imagem, kg, montarPainel,
  mostrarErrosDoFormulario, parametros, vazio,
} from "/js/ui.js";
import { atualizarCidade, cidadeDaOng, plural, refeicoes } from "/js/ong-comum.js";

const conta = exigirLogin("ONG");
montarPainel(conta, "solicitacoes", cidadeDaOng(conta));

const idOferta = Number(parametros().get("oferta"));
const estado = document.getElementById("estado");
const area = document.getElementById("solicitar");
const form = document.getElementById("form-solicitacao");
const campoQuantidade = document.getElementById("quantidade");
const campoData = document.getElementById("data");
const campoHora = document.getElementById("hora");
const campoObservacoes = document.getElementById("observacoes");
const botaoEnviar = document.getElementById("enviar");
const erroEnvio = document.getElementById("erro-envio");

let oferta = null; // a oferta escolhida, como veio da API
let limite = null; // Date do disponivel_ate: a retirada não pode passar disso

// ----------------------------------------------------------------- datas do formulário
const doisDigitos = (n) => String(n).padStart(2, "0");
/** Date → "2026-10-16" (valor do <input type="date">). */
const paraData = (d) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
/** Date → "18:00" (valor do <input type="time">). */
const paraHora = (d) => `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;

/** "2026-10-16T18:00:00", o formato que a API espera, ou "" se faltar data ou hora. */
function retiradaEscolhida() {
  if (!campoData.value || !campoHora.value) return "";
  return `${campoData.value}T${campoHora.value}:00`;
}

/** Próximo horário cheio (17h20 → 18h), sem passar do limite da oferta. */
function horarioPadrao() {
  const proxima = new Date();
  proxima.setHours(proxima.getHours() + 1, 0, 0, 0);
  return proxima < limite ? proxima : limite;
}

/** O horário mínimo só vale para hoje, e o máximo só no último dia da oferta. */
function ajustarLimitesDoHorario() {
  const agora = new Date();
  if (campoData.value === paraData(agora)) campoHora.min = paraHora(agora);
  else campoHora.removeAttribute("min");
  if (campoData.value === paraData(limite)) campoHora.max = paraHora(limite);
  else campoHora.removeAttribute("max");
}

// ----------------------------------------------------------------- tela
function mostrarSemOferta(titulo, texto) {
  estado.innerHTML = `<div class="card">${vazio(titulo, texto,
    '<a class="btn btn-primario" href="/ong/mapa.html">Ver doações no mapa</a>')}</div>`;
}

function preencher(ong) {
  document.getElementById("loja-foto").src = imagem(oferta.foto);
  document.getElementById("loja-nome").textContent = oferta.estabelecimento;
  document.getElementById("loja-endereco").textContent = `${oferta.endereco} • ${distancia(oferta.distancia_m)}`;
  document.getElementById("tipo-alimento").value = oferta.tipo_alimento;

  campoQuantidade.max = oferta.quantidade_kg;
  campoQuantidade.value = oferta.quantidade_kg;
  document.getElementById("quantidade-ajuda").textContent = `Até ${kg(oferta.quantidade_kg)}`;

  limite = data(oferta.disponivel_ate);
  const inicio = horarioPadrao();
  campoData.min = paraData(new Date());
  campoData.max = paraData(limite);
  campoData.value = paraData(inicio);
  campoHora.value = paraHora(inicio);
  ajustarLimitesDoHorario();
  document.getElementById("hora-ajuda").textContent =
    `A loja aceita retiradas até ${hora(oferta.disponivel_ate)} (${dia(oferta.disponivel_ate).toLowerCase()}).`;

  const responsavel = ong.responsavel ? ` • retirada por ${ong.responsavel}` : "";
  document.getElementById("contato").textContent = `Contato da ONG: ${ong.telefone || "sem telefone"}${responsavel}`;

  document.getElementById("resumo-parceiro").textContent = oferta.estabelecimento;
  document.getElementById("resumo-alimentos").textContent = oferta.tipo_alimento;
  document.getElementById("resumo-distancia").textContent = distancia(oferta.distancia_m);
  atualizarResumo();
}

/** Recalcula o card "Resumo" sempre que a quantidade, a data ou a hora mudam. */
function atualizarResumo() {
  const quilos = Math.min(Math.max(Number(campoQuantidade.value) || 0, 0), oferta.quantidade_kg);
  document.getElementById("resumo-refeicoes").textContent = `Até ${plural(refeicoes(quilos), "refeição", "refeições")}`;
  document.getElementById("resumo-quantidade").textContent = kg(quilos);

  const retirada = retiradaEscolhida();
  document.getElementById("resumo-quando").textContent = retirada ? diaHora(retirada) : "—";
  const etiqueta = document.getElementById("resumo-dia");
  etiqueta.textContent = retirada ? dia(retirada) : "";
  etiqueta.hidden = !retirada;
}

async function carregar() {
  if (!idOferta) {
    return mostrarSemOferta("Escolha uma doação no mapa",
      "Para solicitar, comece escolhendo uma oferta aberta em uma loja parceira.");
  }
  try {
    const dados = await api("/ong/ofertas");
    atualizarCidade(conta, dados.ong);
    oferta = dados.itens.find((o) => o.id_oferta === idOferta);
    if (!oferta) {
      return mostrarSemOferta("Esta doação não está mais disponível",
        "A loja pode ter encerrado a oferta ou outra ONG já pediu tudo. Veja as doações abertas no mapa.");
    }
    preencher(dados.ong);
    estado.hidden = true;
    area.hidden = false;
  } catch (erro) {
    estado.innerHTML = `
      <div class="alerta alerta-erro" role="alert">
        <div><p>${esc(erro.message)}</p>
        <button class="btn btn-contorno btn-pequeno" type="button" data-tentar style="margin-top:10px">Tentar de novo</button></div>
      </div>`;
  }
}

// ----------------------------------------------------------------- envio
form.addEventListener("submit", async (e) => {
  e.preventDefault(); // o navegador já conferiu required, min e max antes de chegar aqui
  erroEnvio.innerHTML = "";
  mostrarErrosDoFormulario(form, { campos: {} }); // limpa erros de uma tentativa anterior

  // Confere de novo o horário: a página pode ter ficado aberta e "agora" andou.
  const quando = data(retiradaEscolhida());
  if (quando < new Date(Date.now() - 60 * 1000) || quando > limite) {
    mostrarErrosDoFormulario(form, {
      campos: {
        data_retirada: `Escolha um horário entre agora e ${hora(oferta.disponivel_ate)} (${dia(oferta.disponivel_ate).toLowerCase()}).`,
      },
    });
    campoData.focus();
    return;
  }

  botaoEnviar.disabled = true;
  botaoEnviar.textContent = "Enviando…";
  try {
    const nova = await api("/ong/solicitacoes", {
      metodo: "POST",
      corpo: {
        id_oferta: oferta.id_oferta,
        quantidade_kg: Number(campoQuantidade.value),
        data_retirada: retiradaEscolhida(),
        observacoes: campoObservacoes.value.trim() || null,
      },
    });
    location.href = `/ong/solicitacoes.html?nova=${nova.id_doacao}`;
  } catch (erro) {
    // 409 (a oferta acabou ou não tem tantos kg) e 422 (campo inválido) trazem a mensagem pronta
    erroEnvio.innerHTML = `<p class="alerta alerta-erro">${esc(erro.message)}</p>`;
    mostrarErrosDoFormulario(form, erro);
    botaoEnviar.disabled = false;
    botaoEnviar.textContent = "Enviar solicitação";
  }
});

campoQuantidade.addEventListener("input", atualizarResumo);
campoHora.addEventListener("input", atualizarResumo);
campoData.addEventListener("input", () => {
  ajustarLimitesDoHorario();
  atualizarResumo();
});
estado.addEventListener("click", (e) => {
  if (!e.target.closest("[data-tentar]")) return;
  estado.innerHTML = '<div class="esqueleto" style="height:320px"></div>';
  carregar();
});

carregar();
