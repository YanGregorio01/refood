import React from "react";
import type { CenaCodigo, Nota } from "./roteiro";
import { COR, FONTE, AREA } from "./estilo";
import { instante, surgir } from "./tempo";
import trechos from "./trechos.json";

type Trecho = { arquivo: string; inicio: number; fim: number; linhas: string[]; numeros: (number | null)[] };
const TRECHOS = trechos as Record<string, Trecho>;

// ------------------------------------------------------------ cor das palavras
const PALAVRAS = new Set(
  (
    "def return if else elif try except finally raise yield with as for in not and or is None True False " +
    "import from class async await const let function new throw typeof undefined null"
  ).split(" "),
);
const SQL = new Set("SELECT FROM WHERE FOR UPDATE INSERT INTO VALUES SET AND AS NOW".split(" "));
const TOKEN = /(#.*$|\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+\b)|(%s)|(@\w+(?:\.\w+)*)|(\b[A-Za-z_]\w*\b)/g;

const colorir = (linha: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  let ultimo = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(linha))) {
    if (m.index > ultimo) out.push(linha.slice(ultimo, m.index));
    const [txt, coment, str, num, porc, deco, palavra] = m;
    let cor: string | undefined;
    if (coment) cor = COR.texto3;
    else if (str) cor = "#a7d8a0";
    else if (num) cor = COR.dourado;
    else if (porc) cor = COR.laranja;
    else if (deco) cor = COR.azul;
    else if (palavra && PALAVRAS.has(palavra)) cor = "#e7a6c9";
    else if (palavra && SQL.has(palavra)) cor = COR.azul;
    out.push(
      <span key={m.index} style={{ color: cor, fontStyle: coment ? "italic" : undefined }}>
        {txt}
      </span>,
    );
    ultimo = m.index + txt.length;
  }
  if (ultimo < linha.length) out.push(linha.slice(ultimo));
  return out;
};

// tira a indentação comum do trecho (o código continua igual, só sem o recuo da função)
const semRecuo = (linhas: string[]) => {
  const recuo = Math.min(...linhas.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return linhas.map((l) => l.slice(recuo));
};

// ------------------------------------------------------------ painel
export const PainelCodigo: React.FC<{
  cena: CenaCodigo;
  frame: number;
  altura: number;
}> = ({ cena, frame, altura }) => {
  const paineis = cena.paineis.map((id) => ({ id, ...TRECHOS[id], linhas: semRecuo(TRECHOS[id].linhas) }));
  const totalLinhas = paineis.reduce((s, p) => s + p.linhas.length, 0);
  const maiorLinha = Math.max(...paineis.flatMap((p) => p.linhas.map((l) => l.length)));
  const CABEC = 42;
  const VAO = 14;
  const porAltura = (altura - paineis.length * (CABEC + VAO + 16)) / totalLinhas / 1.55;
  const porLargura = (AREA.w - 110) / (maiorLinha * 0.6);
  const fonte = Math.min(28, porAltura, porLargura);
  const alturaLinha = fonte * 1.55;

  // cada destaque acende no instante da fala; o mais recente fica laranja, os anteriores verdes
  const cues = cena.destaques
    .map((d) => ({ ...d, q: instante(cena, d.em) }))
    .filter((d) => frame >= d.q);
  const atual = cues.length ? cues.reduce((a, b) => (b.q > a.q ? b : a)) : null;

  let atraso = 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: VAO }}>
      {paineis.map((p) => {
        const entra = surgir(frame, atraso, 14);
        atraso += 6;
        return (
          <div
            key={p.id}
            style={{
              background: COR.painel,
              border: `1.5px solid ${COR.borda}`,
              borderRadius: 14,
              overflow: "hidden",
              opacity: entra,
              transform: `translateY(${(1 - entra) * 20}px)`,
            }}
          >
            <div
              style={{
                height: CABEC,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "0 20px",
                background: COR.fundo2,
                borderBottom: `1.5px solid ${COR.borda}`,
                fontFamily: FONTE.mono,
                fontSize: 20,
              }}
            >
              <span style={{ color: COR.creme, fontWeight: 600 }}>{p.arquivo}</span>
              <span style={{ color: COR.texto3 }}>
                {p.fim === p.inicio ? `linha ${p.inicio}` : `linhas ${p.inicio}–${p.fim}`}
              </span>
            </div>
            <div style={{ padding: "8px 0" }}>
              {p.linhas.map((linha, i) => {
                if (p.numeros[i] === null)
                  return (
                    <div key={i} style={{ height: alturaLinha * 0.8, paddingLeft: 40, fontFamily: FONTE.mono, fontSize: fonte, color: COR.texto3 }}>
                      ⋯
                    </div>
                  );
                const acesos = cues.filter((d) => linha.includes(d.texto));
                const eAtual = atual !== null && acesos.includes(atual);
                const aceso = acesos.length > 0;
                const luz = aceso ? surgir(frame, Math.max(...acesos.map((d) => d.q)), 8) : 0;
                const fundo = eAtual
                  ? `rgba(244,162,97,${0.22 * luz})`
                  : aceso
                    ? "rgba(82,183,136,0.10)"
                    : "transparent";
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      height: alturaLinha,
                      alignItems: "center",
                      background: fundo,
                      borderLeft: `5px solid ${eAtual ? COR.laranja : aceso ? COR.verdeClaro : "transparent"}`,
                      fontFamily: FONTE.mono,
                      fontSize: fonte,
                      whiteSpace: "pre",
                      fontVariantLigatures: "none",
                      fontFeatureSettings: '"liga" 0, "calt" 0',
                    }}
                  >
                    <span style={{ width: 70, textAlign: "right", paddingRight: 20, color: COR.texto3, flexShrink: 0 }}>
                      {p.numeros[i]}
                    </span>
                    <span style={{ color: COR.creme, opacity: atual && !aceso ? 0.62 : 1 }}>{colorir(linha)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ------------------------------------------------------------ notas
const COR_TOM = { ok: COR.verdeClaro, erro: COR.coral, info: COR.azul };

export const Notas: React.FC<{ cena: CenaCodigo; frame: number; notas: Nota[] }> = ({ cena, frame, notas }) => (
  <div style={{ display: "flex", gap: 18 }}>
    {notas.map((n, i) => {
      const q = instante(cena, n.em);
      const e = surgir(frame, q, 12);
      const cor = COR_TOM[n.tom];
      return (
        <div
          key={i}
          style={{
            flex: 1,
            opacity: e,
            transform: `translateY(${(1 - e) * 24}px)`,
            background: COR.fundo2,
            border: `2px solid ${cor}`,
            borderRadius: 14,
            padding: "14px 20px",
          }}
        >
          <div style={{ fontFamily: FONTE.titulo, fontWeight: 800, fontSize: 24, color: cor }}>{n.titulo}</div>
          <div
            style={{
              fontFamily: n.corpo.startsWith("{") ? FONTE.mono : FONTE.texto,
              fontSize: n.corpo.startsWith("{") ? 19 : 22,
              color: COR.creme,
              marginTop: 6,
            }}
          >
            {n.corpo}
          </div>
        </div>
      );
    })}
  </div>
);

export const CenaDeCodigo: React.FC<{ cena: CenaCodigo; frame: number }> = ({ cena, frame }) => {
  const notas = cena.notas ?? [];
  const alturaNotas = notas.length ? 130 : 0;
  return (
    <div style={{ position: "absolute", left: AREA.x, top: AREA.y, width: AREA.w, height: AREA.h }}>
      <PainelCodigo cena={cena} frame={frame} altura={AREA.h - alturaNotas - (notas.length ? 20 : 0)} />
      {notas.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <Notas cena={cena} frame={frame} notas={notas} />
        </div>
      )}
    </div>
  );
};
