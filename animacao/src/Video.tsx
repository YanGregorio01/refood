import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { CENAS, Cena } from "./roteiro";
import { COR, FONTE } from "./estilo";
import { ATRASO, FPS, INICIOS, quadrosDaCena, surgir, temVoz } from "./tempo";
import { Camadas } from "./Camadas";
import { CenaDeCodigo } from "./Codigo";
import { Abertura, Biblioteca, Corrida, Http, Injecao, Resumo, Tela } from "./Especiais";

const SEM_DIAGRAMA = new Set(["abertura", "resumo"]);

const Conteudo: React.FC<{ cena: Cena }> = ({ cena }) => {
  const frame = useCurrentFrame();
  const entra = surgir(frame, 0, 10);
  let corpo: React.ReactNode;
  switch (cena.tipo) {
    case "codigo": corpo = <CenaDeCodigo cena={cena} frame={frame} />; break;
    case "abertura": corpo = <Abertura cena={cena} frame={frame} />; break;
    case "http": corpo = <Http cena={cena} frame={frame} />; break;
    case "biblioteca": corpo = <Biblioteca cena={cena} frame={frame} />; break;
    case "injecao": corpo = <Injecao cena={cena} frame={frame} />; break;
    case "corrida": corpo = <Corrida cena={cena} frame={frame} />; break;
    case "tela": corpo = <Tela cena={cena} frame={frame} />; break;
    case "resumo": corpo = <Resumo cena={cena} frame={frame} />; break;
  }
  const i = CENAS.indexOf(cena);
  const anterior = CENAS[i - 1];
  return (
    <AbsoluteFill style={{ opacity: entra }}>
      {!SEM_DIAGRAMA.has(cena.tipo) && (
        <>
          <Camadas
            ativas={cena.camadas}
            anteriores={anterior && !SEM_DIAGRAMA.has(anterior.tipo) ? anterior.camadas : []}
            sentido={cena.sentido}
            frame={frame}
          />
          {/* cabeçalho: a etapa e o título */}
          <div style={{ position: "absolute", left: 600, top: 52, display: "flex", alignItems: "center", gap: 24 }}>
            <div
              style={{
                fontFamily: FONTE.texto, fontWeight: 600, fontSize: 22, color: COR.fundo, background: COR.verdeClaro,
                borderRadius: 30, padding: "8px 20px",
              }}
            >
              {cena.etapa}
            </div>
            <div style={{ fontFamily: FONTE.titulo, fontWeight: 800, fontSize: 52, color: COR.creme }}>{cena.titulo}</div>
          </div>
          <div style={{ position: "absolute", left: 60, top: 62, fontFamily: FONTE.mono, fontSize: 24, color: COR.texto3 }}>
            POST /api/reservas
          </div>
        </>
      )}
      {corpo}
    </AbsoluteFill>
  );
};

export const Video: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(circle at 70% 20%, ${COR.fundo2}, ${COR.fundo} 60%)` }}>
    {CENAS.map((cena, i) => (
      <Sequence key={cena.id} from={INICIOS[i]} durationInFrames={quadrosDaCena(cena)} name={`${cena.id} ${cena.titulo}`}>
        <Conteudo cena={cena} />
        {temVoz(cena) && (
          <Sequence from={Math.round(ATRASO * FPS)} layout="none">
            <Audio src={staticFile(`voz/${cena.id}.mp3`)} />
          </Sequence>
        )}
      </Sequence>
    ))}
  </AbsoluteFill>
);
