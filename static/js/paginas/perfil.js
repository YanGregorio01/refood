// Tela 6.6 do Figma (Meu perfil do consumidor).
// Dados da conta, nível, os três números de impacto (kg salvos, refeições e
// economia), o progresso até o próximo nível e a lista "Conta e preferências"
// (que já está pronta no HTML). O botão "Sair da conta" encerra a sessão.
// Dados: GET /api/consumidor/perfil
import { api, exigirLogin, sair } from "/js/api.js";
import { data, esc, kg, montarRodape, montarTopo, moeda, numero } from "/js/ui.js";
import { avatar, barraProgresso, mostrarErro, plural } from "/js/cliente.js";

const conta = exigirLogin("COMUM");
montarTopo("");
montarRodape();

document.getElementById("sair").addEventListener("click", () => sair());

/** "2025-03-12T10:00:00" vira "março de 2025". */
function mesEAno(iso) {
  const d = data(iso);
  return d ? d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "";
}

function htmlTopo(perfil) {
  const i = perfil.impacto;
  const economiaDetalhe = i.reservas_concluidas
    ? `${numero(i.desconto_medio)}% abaixo do preço original`
    : "Sem compras concluídas ainda";
  return `
    <div class="card card-pad quem">
      <div class="quem-linha">
        ${avatar(conta, "avatar-grande")}
        <div>
          <h2>${esc(perfil.nome)}</h2>
          <p class="muted">${esc(perfil.email)}</p>
          <span class="badge">${esc(i.nivel.nome)}</span>
        </div>
      </div>
      <p class="sutil">Membro desde ${mesEAno(perfil.membro_desde)}</p>
    </div>
    <div class="kpi">
      <span>Alimentos salvos</span>
      <strong>${kg(i.kg_salvos)}</strong>
      <small>+${kg(i.kg_este_mes)} este mês</small>
    </div>
    <div class="kpi">
      <span>Refeições aproveitadas</span>
      <strong>${numero(i.refeicoes)}</strong>
      <small>${plural(i.reservas_concluidas, "reserva concluída", "reservas concluídas")}</small>
    </div>
    <div class="kpi">
      <span>Economia total</span>
      <strong>${moeda(i.economia)}</strong>
      <small>${economiaDetalhe}</small>
    </div>`;
}

function htmlNivel(nivel) {
  // No último nível não existe "próximo": a API manda proximo = null
  const ultimo = !nivel.proximo;
  const frase = ultimo
    ? "Você chegou ao nível máximo. Obrigado por cuidar do planeta! 🌳"
    : `Salve mais ${kg(nivel.falta_kg)} para alcançar o nível ${esc(nivel.proximo)}.`;
  return `
    <div class="card-titulo">
      <h2 id="t-nivel">${ultimo ? "Seu nível" : "Seu próximo nível"}</h2>
      <strong class="nivel-pct">${numero(nivel.progresso)}%</strong>
    </div>
    <p class="nivel-atual">Nível ${numero(nivel.numero)}: ${esc(nivel.nome)}</p>
    ${barraProgresso(nivel.progresso, ultimo ? "Nível máximo alcançado" : `Progresso até o nível ${nivel.proximo}`)}
    <p class="sutil">${frase}</p>`;
}

async function carregar() {
  const topo = document.getElementById("perfil-topo");
  const areaNivel = document.getElementById("nivel");
  try {
    const perfil = await api("/consumidor/perfil");
    topo.innerHTML = htmlTopo(perfil);
    areaNivel.innerHTML = htmlNivel(perfil.impacto.nivel);
  } catch (erro) {
    // A lista "Conta e preferências" e o botão de sair continuam funcionando
    topo.hidden = true;
    areaNivel.hidden = true;
    mostrarErro(document.getElementById("erro"), erro.message);
  }
}

carregar();
