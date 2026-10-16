// Página inicial (tela 5.1): números de impacto e parceiros de destaque.
import { api } from "/js/api.js";
import { esc, imagem, montarRodape, montarTopo, moeda, numero } from "/js/ui.js";

montarTopo("inicio");
montarRodape();

async function carregarImpacto() {
  try {
    const d = await api("/impacto");
    document.getElementById("n-kg").textContent = `${numero(d.kg_salvos)} kg`;
    document.getElementById("n-refeicoes").textContent = numero(d.refeicoes_doadas);
    document.getElementById("n-economia").textContent = moeda(d.economia_consumidores).replace(/,\d\d$/, "");
  } catch {
    document.querySelectorAll(".numero-card strong").forEach((el) => { el.textContent = "—"; });
  }
}

async function carregarParceiros() {
  const area = document.getElementById("parceiros");
  try {
    const lojas = await api("/estabelecimentos");
    const destaque = [...lojas].sort((a, b) => b.total_avaliacoes - a.total_avaliacoes).slice(0, 4);
    area.innerHTML = destaque.map((l) => `
      <a class="parceiro" href="/estabelecimento.html?id=${l.id_estabelecimento}">
        <img src="${imagem(l.foto)}" alt="" loading="lazy">
        <div><strong>${esc(l.nome)}</strong><span>${esc(l.descricao || "")}</span></div>
      </a>`).join("");
  } catch {
    area.innerHTML = "";
  }
}

carregarImpacto();
carregarParceiros();
