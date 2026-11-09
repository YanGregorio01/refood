// Gera a narração no ElevenLabs: um mp3 por cena do roteiro (src/roteiro.ts), com a voz
// do perfil (Will, a mesma de ../../instagram-como-funciona/narracao/voz.json).
// Salva public/voz/<id>.mp3 e anota em src/tempos.json a duração e o instante em que cada
// letra da fala é dita (endpoint with-timestamps). O vídeo usa isso para durar o tempo da
// voz e acender cada linha de código quando a voz fala dela.
//
//   node ferramentas/narrar.mjs --conferir   # só confere o roteiro (âncoras e marcas)
//   node ferramentas/narrar.mjs --custo      # quantos caracteres (créditos) vai gastar
//   node ferramentas/narrar.mjs              # gera só as falas novas ou alteradas
//   node ferramentas/narrar.mjs 07 11        # refaz essas cenas
//
// A chave vem de ELEVENLABS_API_KEY, do .env daqui ou do .env de ../../instagram.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CENAS } from "../src/roteiro.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const PASTA_VOZ = path.join(RAIZ, "public", "voz");
const ARQ_TEMPOS = path.join(RAIZ, "src", "tempos.json");
const VOZ = {
  voice_id: "CstacWqMhJQlnfLPxRG4",
  modelo: "eleven_multilingual_v2",
  ajustes: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
};

const args = process.argv.slice(2);
const trechos = JSON.parse(readFileSync(path.join(RAIZ, "src", "trechos.json"), "utf8"));

// ---- conferência do roteiro: toda marca existe na fala, todo destaque existe no código
const problemas = [];
for (const c of CENAS) {
  const fala = c.fala.toLowerCase();
  const pedacos = c.tipo === "codigo"
    ? [...c.destaques.map((d) => d.em), ...(c.notas ?? []).map((n) => n.em)]
    : Object.values(c.marcas);
  for (const p of pedacos) if (!fala.includes(p.toLowerCase())) problemas.push(`${c.id}: "${p}" não está na fala`);
  if (c.tipo === "codigo") {
    for (const id of c.paineis) if (!trechos[id]) problemas.push(`${c.id}: trecho ${id} não existe`);
    const codigo = c.paineis.flatMap((id) => trechos[id]?.linhas ?? []).join("\n");
    for (const d of c.destaques) if (!codigo.includes(d.texto)) problemas.push(`${c.id}: "${d.texto}" não está no código`);
  }
}
if (problemas.length) {
  console.error(problemas.join("\n"));
  process.exit(1);
}
console.log(`Roteiro ok: ${CENAS.length} cenas.`);
if (args.includes("--conferir")) process.exit(0);

// ---- o que gerar
const tempos = existsSync(ARQ_TEMPOS) ? JSON.parse(readFileSync(ARQ_TEMPOS, "utf8")) : {};
const pedidas = args.filter((a) => /^\d+$/.test(a));
const gerar = CENAS.filter((c) =>
  pedidas.length ? pedidas.includes(c.id) : tempos[c.id]?.texto !== c.fala || !existsSync(path.join(PASTA_VOZ, `${c.id}.mp3`)),
);
const caracteres = gerar.reduce((s, c) => s + c.fala.length, 0);
console.log(`${gerar.length} fala(s) para gerar, ${caracteres} caracteres.`);
if (args.includes("--custo") || gerar.length === 0) process.exit(0);

const chave = (() => {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  for (const env of [path.join(RAIZ, ".env"), path.resolve(RAIZ, "..", "..", "instagram", ".env")]) {
    if (!existsSync(env)) continue;
    const m = readFileSync(env, "utf8").match(/^ELEVENLABS_API_KEY\s*=\s*"?([^"\r\n]+)"?/m);
    if (m) return m[1].trim();
  }
  console.error("Sem ELEVENLABS_API_KEY: ponha no .env daqui ou no do instagram.");
  process.exit(1);
})();

mkdirSync(PASTA_VOZ, { recursive: true });
for (const c of gerar) {
  const i = CENAS.indexOf(c);
  const corpo = {
    text: c.fala,
    model_id: VOZ.modelo,
    voice_settings: VOZ.ajustes,
    previous_text: CENAS[i - 1]?.fala,
    next_text: CENAS[i + 1]?.fala,
  };
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOZ.voice_id}/with-timestamps?output_format=mp3_44100_128`,
    { method: "POST", headers: { "xi-api-key": chave, "Content-Type": "application/json" }, body: JSON.stringify(corpo) },
  );
  if (!r.ok) {
    console.error(`${c.id}: ElevenLabs respondeu ${r.status}: ${await r.text()}`);
    process.exit(1);
  }
  const j = await r.json();
  writeFileSync(path.join(PASTA_VOZ, `${c.id}.mp3`), Buffer.from(j.audio_base64, "base64"));
  const a = j.alignment;
  const fim = a.character_end_times_seconds.at(-1);
  tempos[c.id] = {
    texto: c.fala,
    dur: fim,
    // instante (s) em que cada caractere da fala começa a ser dito
    letras: a.character_start_times_seconds.map((t) => Math.round(t * 1000) / 1000),
    caracteres: a.characters.join(""),
  };
  writeFileSync(ARQ_TEMPOS, JSON.stringify(tempos) + "\n");
  console.log(`${c.id}  ${fim.toFixed(1)} s`);
}
const total = CENAS.reduce((s, c) => s + (tempos[c.id]?.dur ?? 0), 0);
console.log(`Voz total: ${Math.floor(total / 60)} min ${Math.round(total % 60)} s`);
