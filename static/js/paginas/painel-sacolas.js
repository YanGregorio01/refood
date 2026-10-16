// Sacolas do comerciante (tela 6.7 do Figma, "Cadastrar Sacola"; no celular, 3.2).
// Parte (a): lista "Suas sacolas" (GET /api/painel/sacolas), com publicar,
//            remover do catálogo e descartar rascunho.
// Parte (b): formulário de cadastro (POST /api/painel/sacolas), que também
//            serve para editar uma sacola (PUT /api/painel/sacolas/{id}).
import { api, exigirLogin } from "/js/api.js";
import {
  STATUS_SACOLA, badge, dia, esc, imagem, moeda, montarPainel, mostrarErrosDoFormulario, toast, vazio,
} from "/js/ui.js";
import {
  confirmar, dataISO, diaEFaixa, enquantoEspera, esqueletos, faixaAs, localDaLoja, mostrarErro,
} from "/js/painel-comum.js";

const conta = exigirLogin("ESTABELECIMENTO");
montarPainel(conta, "sacolas", await localDaLoja());

// ================================================================ (a) lista "Suas sacolas"
const lista = document.getElementById("lista-sacolas");
const botaoMais = document.getElementById("mais-sacolas");
const POR_PAGINA = 20;

let periodo = "ativas"; // aba escolhida: "ativas" ou "todas"
let sacolas = [];       // última lista que veio da API
let mostrando = POR_PAGINA;

async function carregarSacolas() {
  lista.innerHTML = esqueletos(2, 84);
  botaoMais.hidden = true;
  try {
    sacolas = await api("/painel/sacolas", { params: { periodo } });
    mostrando = POR_PAGINA;
    mostrarSacolas();
  } catch (erro) {
    mostrarErro(lista, erro, carregarSacolas);
  }
}

function mostrarSacolas() {
  if (!sacolas.length) {
    lista.innerHTML = periodo === "ativas"
      ? vazio("Nenhuma sacola ativa agora.", "Cadastre uma sacola no formulário abaixo.",
        '<a class="btn btn-primario btn-pequeno" href="#nova">+ Cadastrar nova sacola</a>')
      : vazio("Nenhuma sacola nos últimos 30 dias.");
    return;
  }
  lista.innerHTML = sacolas.slice(0, mostrando).map(itemDaSacola).join("");
  botaoMais.hidden = sacolas.length <= mostrando;
}

function itemDaSacola(s) {
  const encerrada = s.status === "VENCIDO" || s.status === "INDISPONIVEL"; // a API não deixa mexer nessas
  const nomeOculto = `<span class="sr-only"> ${esc(s.nome)}</span>`; // para o leitor de tela saber qual sacola
  return `
    <article class="item sacola-item">
      <img class="item-foto" src="${imagem(s.foto)}" alt="" loading="lazy">
      <div class="item-corpo">
        <div class="linha-titulo"><strong>${esc(s.nome)}</strong>${badge(STATUS_SACOLA, s.status)}</div>
        <span class="muted">${diaEFaixa(s.inicio_retirada, s.fim_retirada)} · ${esc(s.categoria)}</span>
        <span class="sutil">reservadas ${s.reservadas} de ${s.quantidade_inicial}${
          s.reservas_pendentes ? ` · ${s.reservas_pendentes} aguardando retirada` : ""}</span>
      </div>
      <div class="item-preco">
        <span class="preco-de">${moeda(s.preco_original)}</span>
        <span class="preco num">${moeda(s.preco)}</span>
      </div>
      <div class="item-acoes">
        ${encerrada ? "" : `<button type="button" class="btn btn-contorno btn-pequeno" data-acao="editar" data-id="${s.id_alimento}">Editar${nomeOculto}</button>`}
        ${s.status === "RASCUNHO" ? `<button type="button" class="btn btn-primario btn-pequeno" data-acao="publicar" data-id="${s.id_alimento}">Publicar${nomeOculto}</button>` : ""}
        ${encerrada ? "" : `<button type="button" class="btn btn-perigo btn-pequeno" data-acao="remover" data-id="${s.id_alimento}">${
          s.status === "RASCUNHO" ? "Descartar rascunho" : "Remover do catálogo"}${nomeOculto}</button>`}
      </div>
    </article>`;
}

// Abas "Ativas" / "Últimos 30 dias"
document.querySelectorAll("[data-periodo]").forEach((aba) => {
  aba.addEventListener("click", () => {
    periodo = aba.dataset.periodo;
    document.querySelectorAll("[data-periodo]").forEach((a) => a.setAttribute("aria-selected", String(a === aba)));
    carregarSacolas();
  });
});

botaoMais.addEventListener("click", () => {
  mostrando += POR_PAGINA;
  mostrarSacolas();
});

// Um só "ouvinte" para os botões de todas as sacolas (a lista é redesenhada a cada carga).
lista.addEventListener("click", async (e) => {
  const botao = e.target.closest("[data-acao]");
  if (!botao) return;
  const sacola = sacolas.find((s) => s.id_alimento === Number(botao.dataset.id));
  if (botao.dataset.acao === "editar") entrarEmEdicao(sacola);
  if (botao.dataset.acao === "publicar") await publicar(sacola, botao);
  if (botao.dataset.acao === "remover") await remover(sacola, botao);
});

async function publicar(sacola, botao) {
  try {
    await enquantoEspera(botao, () => api(`/painel/sacolas/${sacola.id_alimento}/publicar`, { metodo: "POST" }));
    toast("Sacola publicada! Ela já aparece no catálogo.", "ok");
    carregarSacolas();
  } catch (erro) {
    toast(erro.message, "erro");
  }
}

async function remover(sacola, botao) {
  // A mesma rota (/remover) serve para tirar do catálogo e para descartar um rascunho.
  const ehRascunho = sacola.status === "RASCUNHO";
  const pendentes = sacola.reservas_pendentes
    ? ` ${sacola.reservas_pendentes === 1 ? "Há 1 reserva" : `Há ${sacola.reservas_pendentes} reservas`} aguardando retirada.`
    : "";
  const ok = await confirmar(ehRascunho
    ? {
      titulo: "Descartar rascunho?",
      texto: `O rascunho “${sacola.nome}” não poderá mais ser editado nem publicado.`,
      botao: "Descartar rascunho",
      perigo: true,
    }
    : {
      titulo: "Remover do catálogo?",
      texto: `“${sacola.nome}” sai do catálogo e ninguém mais consegue reservá-la. As reservas já feitas continuam valendo: `
        + `os clientes ainda podem retirar no horário combinado.${pendentes}`,
      botao: "Remover do catálogo",
      perigo: true,
    });
  if (!ok) return;
  try {
    await enquantoEspera(botao, () => api(`/painel/sacolas/${sacola.id_alimento}/remover`, { metodo: "POST" }));
    toast(ehRascunho ? "Rascunho descartado." : "Sacola removida do catálogo.", "ok");
    if (editandoId === sacola.id_alimento) sairDaEdicao();
    carregarSacolas();
  } catch (erro) {
    toast(erro.message, "erro");
  }
}

// ================================================================ (b) formulário
const form = document.getElementById("form-sacola");
const campo = (nome) => form.elements[nome]; // atalho: campo("preco") é o <input name="preco">
const erroForm = document.getElementById("erro-form");
let categorias = [];
let editandoId = null; // id da sacola em edição; null = cadastrando uma nova
let fotoDaSacola = null; // na edição, a foto atual da sacola (até trocar a categoria)

async function carregarCategorias() {
  const select = campo("id_categoria");
  try {
    categorias = await api("/categorias");
    select.innerHTML = '<option value="">Escolha a categoria</option>'
      + categorias.map((c) => `<option value="${c.id_categoria}">${esc(c.nome)}</option>`).join("");
  } catch (erro) {
    select.innerHTML = '<option value="">Não foi possível carregar as categorias</option>';
    toast(erro.message, "erro");
  }
}

/** Valores iniciais: hoje, das 18h às 19h30 (depois das 19h30 já sugere amanhã). */
function preencherPadrao() {
  form.reset();
  const dataPadrao = new Date();
  if (dataPadrao.getHours() * 60 + dataPadrao.getMinutes() >= 19 * 60 + 30) dataPadrao.setDate(dataPadrao.getDate() + 1);
  campo("data").value = dataISO(dataPadrao);
  fotoDaSacola = null;
  mostrarErrosDoFormulario(form, { campos: {} }); // limpa erros antigos
  erroForm.hidden = true;
  atualizarTela();
}

// ---------------------------------------------------------------- partes que mudam enquanto a pessoa digita
function atualizarTela() {
  atualizarDicaDeDesconto();
  atualizarResumo();
  // Selo "Concluído" em cada bloco cujos campos obrigatórios estão válidos
  form.querySelectorAll(".bloco").forEach((bloco) => {
    const obrigatorios = [...bloco.querySelectorAll("[required]")];
    bloco.querySelector("[data-concluido]").hidden = !obrigatorios.every((c) => c.checkValidity());
  });
}

/** "Desconto de 66% • dentro da faixa recomendada" (a recomendação é de 50% a 70%). */
function atualizarDicaDeDesconto() {
  const dica = document.getElementById("dica-desconto");
  const original = Number(campo("preco_original").value);
  const preco = Number(campo("preco").value);
  if (!original || !preco) {
    dica.hidden = true;
    return;
  }
  const desconto = Math.round((1 - preco / original) * 100);
  let classe = "alerta-info";
  let texto;
  if (preco > original) {
    classe = "alerta-erro";
    texto = "O preço Refood não pode ser maior que o preço original.";
  } else if (desconto >= 50 && desconto <= 70) {
    classe = "alerta-ok";
    texto = `Desconto de ${desconto}% • dentro da faixa recomendada`;
  } else if (desconto < 50) {
    texto = `Desconto de ${desconto}% • abaixo da faixa recomendada (50% a 70%). Descontos maiores costumam vender mais rápido.`;
  } else {
    texto = `Desconto de ${desconto}% • acima da faixa recomendada (50% a 70%). Confira se o preço ainda cobre seus custos.`;
  }
  dica.className = `alerta dica ${classe}`;
  dica.textContent = texto;
  dica.hidden = false;
}

/** Card "Resumo da publicação": mostra a sacola como vai ficar. */
function atualizarResumo() {
  const categoria = categorias.find((c) => String(c.id_categoria) === campo("id_categoria").value);
  const foto = fotoDaSacola || categoria?.imagem;
  const caixaFoto = document.getElementById("r-foto");
  caixaFoto.classList.toggle("com-foto", Boolean(foto));
  caixaFoto.innerHTML = foto ? `<img src="${imagem(foto)}" alt="">` : "Escolha a categoria para ver a foto da sacola.";

  document.getElementById("r-nome").textContent = campo("nome").value.trim() || "Nome da sacola";
  const preco = Number(campo("preco").value);
  const original = Number(campo("preco_original").value);
  document.getElementById("r-preco").textContent = moeda(preco);
  document.getElementById("r-preco-de").textContent = original > preco ? moeda(original) : "";

  const dataRetirada = campo("data").value;
  const inicio = `${dataRetirada}T${campo("inicio_retirada").value}`;
  const fim = `${dataRetirada}T${campo("fim_retirada").value}`;
  document.getElementById("r-quando").textContent = dataRetirada
    ? `${dia(inicio)} • ${faixaAs(inicio, fim)}`
    : "Escolha a data da retirada";

  const qtd = Number(campo("quantidade").value) || 0;
  document.getElementById("r-quantidade").textContent = `${qtd} ${qtd === 1 ? "sacola disponível" : "sacolas disponíveis"}`;
}

form.addEventListener("input", atualizarTela);
campo("id_categoria").addEventListener("change", () => {
  fotoDaSacola = null; // trocou a categoria: o resumo passa a mostrar a foto da nova categoria
  atualizarTela();
});

// ---------------------------------------------------------------- modo edição
function entrarEmEdicao(s) {
  preencherPadrao();
  editandoId = s.id_alimento;
  fotoDaSacola = s.foto;
  campo("nome").value = s.nome;
  campo("id_categoria").value = String(s.id_categoria);
  campo("descricao").value = s.descricao || "";
  campo("peso_estimado_kg").value = s.peso_estimado_kg;
  campo("preco_original").value = s.preco_original;
  campo("preco").value = s.preco;
  campo("quantidade").value = s.quantidade;
  campo("data").value = s.inicio_retirada.slice(0, 10);         // "2026-10-16T18:00:00" -> "2026-10-16"
  campo("inicio_retirada").value = s.inicio_retirada.slice(11, 16); // -> "18:00"
  campo("fim_retirada").value = s.fim_retirada.slice(11, 16);

  document.getElementById("t-form").textContent = "Editar sacola";
  document.getElementById("sub-form").textContent = `Alterando “${s.nome}”. As reservas já feitas continuam valendo.`;
  document.getElementById("ajuda-quantidade").textContent = s.reservadas
    ? `Quantas ainda ficam disponíveis. As ${s.reservadas} já reservadas não contam.`
    : "Quantas sacolas vão ficar disponíveis.";
  document.getElementById("b-publicar").textContent = "Salvar alterações";
  document.getElementById("b-rascunho").hidden = true;
  document.getElementById("b-cancelar").hidden = false;
  atualizarTela();
  irParaFormulario();
}

function sairDaEdicao() {
  editandoId = null;
  document.getElementById("t-form").textContent = "Cadastrar nova sacola";
  document.getElementById("sub-form").textContent = "Preencha as informações para publicar uma nova oferta.";
  document.getElementById("ajuda-quantidade").textContent = "Quantas sacolas vão ficar disponíveis.";
  document.getElementById("b-publicar").textContent = "Publicar sacola";
  document.getElementById("b-rascunho").hidden = false;
  document.getElementById("b-cancelar").hidden = true;
  preencherPadrao();
}

document.getElementById("b-cancelar").addEventListener("click", () => {
  sairDaEdicao();
  document.getElementById("t-suas").scrollIntoView();
});

function irParaFormulario() {
  document.getElementById("nova").scrollIntoView();
  campo("nome").focus({ preventScroll: true });
}

// Links "+ Cadastrar nova sacola" desta página: saem da edição e levam ao formulário.
document.addEventListener("click", (e) => {
  if (!e.target.closest('a[href="#nova"]')) return;
  e.preventDefault();
  if (editandoId) sairDaEdicao();
  irParaFormulario();
});

// ---------------------------------------------------------------- enviar
/** Monta o JSON no formato que a API espera (docs/API.md, POST /api/painel/sacolas). */
function montarCorpo(rascunho) {
  const valor = (nome) => campo(nome).value.trim();
  return {
    nome: valor("nome"),
    id_categoria: Number(valor("id_categoria")),
    descricao: valor("descricao") || null,
    peso_estimado_kg: Number(valor("peso_estimado_kg")) || undefined, // vazio: a API usa 1 kg
    preco_original: Number(valor("preco_original")),
    preco: Number(valor("preco")),
    quantidade: Number(valor("quantidade")),
    data: valor("data"),
    inicio_retirada: valor("inicio_retirada"),
    fim_retirada: valor("fim_retirada"),
    rascunho,
  };
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  // e.submitter é o botão que enviou: "Publicar sacola" ou "Salvar como rascunho"
  const rascunho = e.submitter?.id === "b-rascunho";
  const botoes = form.querySelectorAll("button");
  botoes.forEach((b) => { b.disabled = true; });
  mostrarErrosDoFormulario(form, { campos: {} });
  erroForm.hidden = true;

  try {
    if (editandoId) {
      await api(`/painel/sacolas/${editandoId}`, { metodo: "PUT", corpo: montarCorpo(false) });
      toast("Alterações salvas.", "ok");
      sairDaEdicao();
    } else {
      await api("/painel/sacolas", { metodo: "POST", corpo: montarCorpo(rascunho) });
      toast(rascunho ? "Rascunho salvo. Publique quando quiser." : "Sacola publicada! Ela já aparece no catálogo.", "ok");
      preencherPadrao();
    }
    carregarSacolas();
  } catch (erro) {
    mostrarErrosDoFormulario(form, erro); // destaca os campos que a API recusou (erro 422)
    erroForm.textContent = erro.message;
    erroForm.hidden = false;
  } finally {
    botoes.forEach((b) => { b.disabled = false; });
  }
});

// ================================================================ início
preencherPadrao();
await Promise.all([carregarCategorias(), carregarSacolas()]);
atualizarTela(); // as fotos das categorias chegaram: atualiza o resumo
if (location.hash === "#nova") irParaFormulario(); // veio do botão "+ Cadastrar nova sacola" do dashboard
