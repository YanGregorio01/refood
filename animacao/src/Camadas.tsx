import React from "react";
import { interpolate, Easing } from "remotion";
import { CAMADAS, CamadaId } from "./roteiro";
import { COR, FONTE } from "./estilo";

// O diagrama fixo da esquerda: as seis camadas, de cima (navegador) para baixo (MySQL).
// A bolinha é a requisição: ela desliza da camada da cena anterior para a desta.

export const X = 60;
export const W = 480;
const TOPO = 190;
const ALTURA = 112;
const VAO = 26;
export const yDaCamada = (i: number) => TOPO + i * (ALTURA + VAO);
const centro = (ids: CamadaId[]) => {
  if (!ids.length) return null;
  const idx = ids.map((id) => CAMADAS.findIndex((c) => c.id === id));
  return (yDaCamada(Math.min(...idx)) + yDaCamada(Math.max(...idx)) + ALTURA) / 2;
};

export const Camadas: React.FC<{
  ativas: CamadaId[];
  anteriores: CamadaId[];
  sentido?: "ida" | "volta";
  frame: number; // quadro dentro da cena
}> = ({ ativas, anteriores, sentido, frame }) => {
  const t = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const yNovo = centro(ativas);
  const yVelho = centro(anteriores) ?? yNovo;
  const yBola = yNovo === null ? null : yVelho! + (yNovo - yVelho!) * t;
  const corBola = sentido === "volta" ? COR.laranja : COR.verdeClaro;
  const pulso = 1 + 0.12 * Math.sin(frame / 6);

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 600, height: 1080 }}>
      {/* a linha que liga as camadas */}
      <div
        style={{
          position: "absolute",
          left: X + 28,
          top: yDaCamada(0) + ALTURA / 2,
          width: 3,
          height: yDaCamada(5) - yDaCamada(0),
          background: COR.borda,
        }}
      />
      {CAMADAS.map((c, i) => {
        const acesa = ativas.includes(c.id);
        const antes = anteriores.includes(c.id);
        const luz = acesa ? (antes ? 1 : t) : antes ? 1 - t : 0;
        return (
          <div
            key={c.id}
            style={{
              position: "absolute",
              left: X + 60,
              top: yDaCamada(i),
              width: W - 60,
              height: ALTURA,
              borderRadius: 14,
              boxSizing: "border-box",
              padding: "18px 22px",
              background: `rgba(82,183,136,${0.04 + 0.14 * luz})`,
              border: `2px solid ${luz > 0.5 ? COR.verdeClaro : COR.borda}`,
              opacity: 0.5 + 0.5 * luz,
            }}
          >
            <div style={{ fontFamily: FONTE.titulo, fontWeight: 700, fontSize: 30, color: COR.creme }}>{c.nome}</div>
            <div style={{ fontFamily: FONTE.texto, fontSize: 19, color: COR.texto2, marginTop: 6 }}>{c.sub}</div>
          </div>
        );
      })}
      {/* os pontos na linha */}
      {CAMADAS.map((c, i) => (
        <div
          key={c.id + "p"}
          style={{
            position: "absolute",
            left: X + 21,
            top: yDaCamada(i) + ALTURA / 2 - 8,
            width: 17,
            height: 17,
            borderRadius: 9,
            background: COR.fundo,
            border: `3px solid ${COR.borda}`,
          }}
        />
      ))}
      {yBola !== null && (
        <>
          <div
            style={{
              position: "absolute",
              left: X + 29 - 20 * pulso,
              top: yBola - 20 * pulso,
              width: 40 * pulso,
              height: 40 * pulso,
              borderRadius: "50%",
              background: corBola,
              opacity: 0.25,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: X + 29 - 13,
              top: yBola - 13,
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: corBola,
              boxShadow: `0 0 24px ${corBola}`,
            }}
          />
          {sentido && (
            <div
              style={{
                position: "absolute",
                left: X - 8,
                top: yBola + 26,
                width: 76,
                textAlign: "center",
                fontFamily: FONTE.texto,
                fontWeight: 600,
                fontSize: 17,
                color: corBola,
              }}
            >
              {sentido === "ida" ? "ida ↓" : "volta ↑"}
            </div>
          )}
        </>
      )}
    </div>
  );
};
