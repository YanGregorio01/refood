// Tela 5.2 do Figma (Login / Cadastro). Duas abas: "Entrar" e "Criar conta".
// Depois de entrar ou cadastrar, guarda o token e leva a pessoa para o
// endereço de ?voltar= (se houver) ou para a página inicial da conta.
import { api, sair, salvarSessao, sessao } from "/js/api.js";
import { montarRodape, montarTopo, mostrarErrosDoFormulario, parametros } from "/js/ui.js";

montarTopo();
montarRodape();

const params = parametros();

const OLHO_ABERTO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const OLHO_FECHADO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

// ----------------------------------------------------------------- já está logado?
const atual = sessao();
if (atual) {
  document.getElementById("formularios").hidden = true;
  document.getElementById("ja-logado").hidden = false;
  document.getElementById("logado-nome").textContent = atual.conta.nome;
  document.getElementById("logado-email").textContent = atual.conta.email;
  document.getElementById("logado-ir").href = atual.conta.pagina_inicial || "/index.html";
  // Sai e recarrega esta mesma página (mantendo ?voltar= e ?criar=).
  document.getElementById("logado-sair").addEventListener("click", () => sair(location.pathname + location.search));
}

// ----------------------------------------------------------------- abas
const abas = {
  entrar: document.getElementById("aba-entrar"),
  criar: document.getElementById("aba-criar"),
};

function mostrarAba(nome, focar = false) {
  for (const [chave, aba] of Object.entries(abas)) {
    const ativa = chave === nome;
    aba.setAttribute("aria-selected", String(ativa));
    aba.tabIndex = ativa ? 0 : -1;
    document.getElementById(aba.getAttribute("aria-controls")).hidden = !ativa;
  }
  if (focar) abas[nome].focus();
}

abas.entrar.addEventListener("click", () => mostrarAba("entrar"));
abas.criar.addEventListener("click", () => mostrarAba("criar"));

// Setas do teclado trocam de aba (padrão de acessibilidade para abas).
document.querySelector('[role="tablist"]').addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    mostrarAba(abas.entrar.getAttribute("aria-selected") === "true" ? "criar" : "entrar", true);
  }
});

// Links "Criar conta" / "Entrar" que ficam embaixo de cada formulário.
document.querySelectorAll("[data-ir-para]").forEach((botao) => {
  botao.addEventListener("click", () => mostrarAba(botao.dataset.irPara, true));
});

// Vindo da página inicial com ?criar=COMUM|ESTABELECIMENTO|ONG: abre "Criar conta" com o perfil marcado.
if (params.has("criar")) {
  mostrarAba("criar");
  const perfil = params.get("criar").toUpperCase();
  if (["COMUM", "ESTABELECIMENTO", "ONG"].includes(perfil)) {
    document.querySelector(`input[name="tipo"][value="${perfil}"]`).checked = true;
  }
}

// ----------------------------------------------------------------- mostrar / ocultar senha
document.querySelectorAll("[data-ver-senha]").forEach((botao) => {
  const campo = document.getElementById(botao.dataset.verSenha);
  botao.innerHTML = OLHO_ABERTO;
  botao.addEventListener("click", () => {
    const mostrando = campo.type === "text";
    campo.type = mostrando ? "password" : "text";
    botao.innerHTML = mostrando ? OLHO_ABERTO : OLHO_FECHADO;
    botao.setAttribute("aria-label", mostrando ? "Mostrar senha" : "Ocultar senha");
    botao.setAttribute("aria-pressed", String(!mostrando));
  });
});

// ----------------------------------------------------------------- para onde ir depois de entrar
function destinoDepoisDoLogin(conta) {
  const voltar = params.get("voltar") || "";
  // Só aceita caminhos do próprio site. "//outro-site.com" também começa com "/", por isso o teste extra.
  const caminhoInterno = voltar.startsWith("/") && !voltar.startsWith("//") && !voltar.startsWith("/\\");
  // Comerciante ou ONG sem cadastro completo vai primeiro completar o cadastro.
  if (caminhoInterno && conta.perfil_completo) return voltar;
  return conta.pagina_inicial || "/index.html";
}

// ----------------------------------------------------------------- envio dos formulários
/**
 * Manda o formulário para a API. Enquanto espera, o botão fica desabilitado.
 * Em erro, mostra a mensagem no topo do formulário e marca os campos com problema.
 */
async function enviar(form, caminho, corpo, textoEsperando) {
  const botao = form.querySelector('button[type="submit"]');
  const alerta = form.querySelector(".alerta-erro");
  const textoOriginal = botao.textContent;

  alerta.hidden = true;
  mostrarErrosDoFormulario(form, { campos: {} }); // limpa os erros da tentativa anterior
  botao.disabled = true;
  botao.textContent = textoEsperando;

  try {
    const resposta = await api(caminho, { metodo: "POST", corpo });
    salvarSessao(resposta.token, resposta.conta);
    location.href = destinoDepoisDoLogin(resposta.conta);
  } catch (erro) {
    alerta.textContent = erro.message;
    alerta.hidden = false;
    mostrarErrosDoFormulario(form, erro);
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

const formEntrar = document.getElementById("form-entrar");
formEntrar.addEventListener("submit", (e) => {
  e.preventDefault();
  const dados = new FormData(formEntrar);
  enviar(formEntrar, "/auth/login", {
    email: dados.get("email").trim(),
    senha: dados.get("senha"),
  }, "Entrando...");
});

const formCriar = document.getElementById("form-criar");
formCriar.addEventListener("submit", (e) => {
  e.preventDefault();
  const dados = new FormData(formCriar);
  enviar(formCriar, "/auth/cadastro", {
    tipo: dados.get("tipo"),
    nome: dados.get("nome").trim(),
    email: dados.get("email").trim(),
    senha: dados.get("senha"),
    telefone: dados.get("telefone").trim() || null, // opcional: vazio vai como null
  }, "Criando conta...");
});
