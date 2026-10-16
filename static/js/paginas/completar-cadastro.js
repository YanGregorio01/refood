// Tela nova (não existe no Figma): completar ou editar o cadastro da loja
// (comerciante) ou da ONG. A pessoa preenche os dados e marca no mapa onde
// fica; a latitude e a longitude saem desse pino. Se o cadastro já existe
// (link "Configurações" do painel, com ?editar=1), carrega os dados e salva com PUT.
import { api, exigirLogin, salvarSessao, sessao } from "/js/api.js";
import { montarRodape, montarTopo, mostrarErrosDoFormulario, TIPOS_LOJA, toast } from "/js/ui.js";

const contaSalva = exigirLogin("ESTABELECIMENTO", "ONG");
montarTopo();
montarRodape();

const EH_LOJA = contaSalva.tipo === "ESTABELECIMENTO";
const ROTA = EH_LOJA ? "/painel/estabelecimento" : "/ong/perfil";
const PINHEIROS = [-23.5672, -46.6937];
const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR",
  "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const OBRIGATORIOS = ["nome", "endereco", "cidade"];

const TEXTOS = {
  ESTABELECIMENTO: {
    titulo: "Complete o cadastro da sua loja",
    subtitulo: "Com estes dados sua loja aparece no mapa e no catálogo do Refood, e você já pode publicar sacolas.",
    tituloEditar: "Dados da sua loja",
    subtituloEditar: "Atualize as informações que os clientes veem no mapa e na página da loja.",
    nome: "Nome da loja",
    exemploNome: "Ex.: Padaria Dona Flor",
    porQue: "Por que pedimos a localização? Para a sua loja aparecer no lugar certo do mapa e para calcularmos a distância até quem procura sacolas.",
  },
  ONG: {
    titulo: "Complete o cadastro da sua ONG",
    subtitulo: "Com estes dados vocês já podem ver as doações disponíveis perto da ONG e pedir retiradas.",
    tituloEditar: "Dados da sua ONG",
    subtituloEditar: "Atualize as informações que as lojas veem quando vocês pedem uma doação.",
    nome: "Nome da instituição",
    exemploNome: "Ex.: Instituto Mesa Cheia",
    porQue: "Por que pedimos a localização? Para mostrar as doações mais perto da ONG e calcular a distância até cada loja.",
  },
};

const form = document.getElementById("form-cadastro");
const textos = TEXTOS[contaSalva.tipo];
let editando = false; // true quando o cadastro já existe (salva com PUT)
let mapa;
let pino; // marcador do Leaflet; só existe depois que a pessoa marca um ponto

// ----------------------------------------------------------------- campos e textos
function prepararPagina(paginaInicial) {
  // Cada tipo de conta tem alguns campos só seus (marcados com data-so no HTML).
  form.querySelectorAll("[data-so]").forEach((el) => {
    if (el.dataset.so !== contaSalva.tipo) el.remove();
  });

  document.getElementById("rotulo-nome").textContent = textos.nome;
  form.elements.nome.placeholder = textos.exemploNome;
  document.getElementById("por-que").textContent = textos.porQue;

  if (EH_LOJA) {
    form.elements.tipo.innerHTML = Object.entries(TIPOS_LOJA)
      .map(([valor, texto]) => `<option value="${valor}">${texto}</option>`).join("");
  }
  form.elements.uf.innerHTML = `<option value="">Selecione</option>` +
    UFS.map((uf) => `<option value="${uf}">${uf}</option>`).join("");

  document.getElementById("titulo").textContent = editando ? textos.tituloEditar : textos.titulo;
  document.getElementById("subtitulo").textContent = editando ? textos.subtituloEditar : textos.subtitulo;
  document.getElementById("rotulo-etapa").textContent = editando ? "Configurações" : "Último passo";
  document.getElementById("salvar").textContent = editando ? "Salvar alterações" : "Concluir cadastro";
  const cancelar = document.getElementById("cancelar");
  cancelar.hidden = !editando;
  cancelar.href = paginaInicial;
  document.title = `${editando ? textos.tituloEditar : textos.titulo} | Refood`;
}

/** Coloca os dados que vieram da API (GET) nos campos de mesmo nome. */
function preencher(dados) {
  for (const [campo, valor] of Object.entries(dados)) {
    const entrada = form.elements[campo];
    if (entrada && entrada.type !== "hidden" && valor !== null) entrada.value = valor;
  }
  if (dados.latitude !== null && dados.longitude !== null) marcar(dados.latitude, dados.longitude, true);
}

// ----------------------------------------------------------------- mapa
const ICONE_PINO = window.L && L.divIcon({
  className: "",
  html: '<span class="pino-cadastro"></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 36], // a ponta do pino (o desenho é um quadrado girado 45°)
});

function criarMapa() {
  if (!window.L) {
    document.getElementById("mapa").innerHTML =
      '<p class="alerta alerta-erro">Não foi possível carregar o mapa. Confira sua conexão e recarregue a página.</p>';
    return;
  }
  mapa = L.map("mapa").setView(PINHEIROS, 15);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  }).addTo(mapa);
  mapa.on("click", (e) => marcar(e.latlng.lat, e.latlng.lng));
}

/** Coloca (ou move) o pino e guarda a posição nos campos escondidos latitude/longitude. */
function marcar(lat, lng, centralizar = false) {
  if (!mapa) return;
  const ponto = [Number(lat), Number(lng)];
  if (pino) {
    pino.setLatLng(ponto);
  } else {
    pino = L.marker(ponto, { icon: ICONE_PINO, draggable: true, keyboard: false, title: "Local marcado" }).addTo(mapa);
    pino.on("dragend", () => {
      const p = pino.getLatLng();
      marcar(p.lat, p.lng);
    });
  }
  if (centralizar) mapa.setView(ponto, 17);

  form.elements.latitude.value = ponto[0].toFixed(6);
  form.elements.longitude.value = ponto[1].toFixed(6);
  document.getElementById("coordenadas").textContent = `Ponto marcado: ${ponto[0].toFixed(5)}, ${ponto[1].toFixed(5)}`;
}

const botaoLocalizacao = document.getElementById("usar-localizacao");
botaoLocalizacao.addEventListener("click", () => {
  if (!navigator.geolocation) {
    toast("Seu navegador não informa a localização. Marque o ponto clicando no mapa.", "erro");
    return;
  }
  botaoLocalizacao.disabled = true;
  botaoLocalizacao.textContent = "Localizando...";
  const terminar = () => {
    botaoLocalizacao.disabled = false;
    botaoLocalizacao.textContent = "Usar minha localização";
  };
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      marcar(pos.coords.latitude, pos.coords.longitude, true);
      terminar();
    },
    () => {
      toast("Não conseguimos pegar sua localização. Marque o ponto clicando no mapa.", "erro");
      terminar();
    },
    { enableHighAccuracy: true, timeout: 10000 },
  );
});

document.getElementById("marcar-centro").addEventListener("click", () => {
  if (!mapa) return;
  const centro = mapa.getCenter();
  marcar(centro.lat, centro.lng);
});

// ----------------------------------------------------------------- envio
/** Junta os campos num objeto para a API. Opcional vazio vai como null (a API recusa "" em UF e horários). */
function montarCorpo() {
  const corpo = {};
  for (const [campo, valor] of new FormData(form)) {
    const texto = valor.trim();
    corpo[campo] = texto || (OBRIGATORIOS.includes(campo) ? "" : null);
  }
  corpo.latitude = Number(corpo.latitude);
  corpo.longitude = Number(corpo.longitude);
  return corpo;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const alerta = form.querySelector(".alerta-erro");
  const botao = document.getElementById("salvar");
  alerta.hidden = true;
  mostrarErrosDoFormulario(form, { campos: {} }); // limpa os erros da tentativa anterior

  if (!form.elements.latitude.value) {
    mostrarErrosDoFormulario(form, { campos: { latitude: "Clique no mapa para marcar onde fica." } });
    document.getElementById("campo-mapa").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const textoBotao = botao.textContent;
  botao.disabled = true;
  botao.textContent = "Salvando...";
  try {
    await api(ROTA, { metodo: editando ? "PUT" : "POST", corpo: montarCorpo() });
    // A conta muda (perfil_completo, organizacao, pagina_inicial): atualiza a sessão antes de sair daqui.
    const conta = await api("/auth/eu");
    salvarSessao(sessao().token, conta);
    location.href = conta.pagina_inicial;
  } catch (erro) {
    alerta.textContent = erro.message;
    alerta.hidden = false;
    mostrarErrosDoFormulario(form, erro);
    alerta.scrollIntoView({ behavior: "smooth", block: "center" });
    botao.disabled = false;
    botao.textContent = textoBotao;
  }
});

// ----------------------------------------------------------------- início
async function iniciar() {
  const carregando = document.getElementById("carregando");
  try {
    // A sessão guardada pode estar velha: pergunta à API se o cadastro já existe.
    const conta = await api("/auth/eu");
    salvarSessao(sessao().token, conta);
    editando = conta.perfil_completo; // quem já tem cadastro só pode editar
    const dados = editando ? await api(ROTA) : null;

    prepararPagina(conta.pagina_inicial);
    carregando.hidden = true;
    form.hidden = false;
    criarMapa(); // só depois de o formulário aparecer: o Leaflet precisa saber o tamanho da caixa
    if (dados) preencher(dados);
  } catch (erro) {
    carregando.hidden = true;
    document.getElementById("erro-inicio-texto").textContent = erro.message;
    document.getElementById("erro-inicio").hidden = false;
  }
}

document.getElementById("tentar-de-novo").addEventListener("click", () => location.reload());
iniciar();
