import React from "react";
import { interpolate, Easing } from "remotion";
import { CAMADAS, CenaEspecial } from "./roteiro";
import { COR, FONTE, AREA } from "./estilo";
import { instante, surgir } from "./tempo";

type P = { cena: CenaEspecial; frame: number };

// quadro em que a voz diz a marca, e quanto ela já "entrou" (0 -> 1)
const usarMarcas = (cena: CenaEspecial, frame: number) => {
  const q = (nome: string) => instante(cena, cena.marcas[nome]);
  const e = (nome: string, dur = 12) => surgir(frame, q(nome), dur);
  return { q, e };
};

const Caixa: React.FC<{
  x: number; y: number; w: number; h: number;
  cor?: string; luz?: number; children: React.ReactNode; estilo?: React.CSSProperties;
}> = ({ x, y, w, h, cor = COR.borda, luz = 0, children, estilo }) => (
  <div
    style={{
      position: "absolute", left: x, top: y, width: w, height: h, boxSizing: "border-box",
      borderRadius: 16, border: `2.5px solid ${cor}`, background: COR.fundo2, padding: "18px 24px",
      boxShadow: luz ? `0 0 ${36 * luz}px ${cor}` : undefined, ...estilo,
    }}
  >
    {children}
  </div>
);

const T: React.FC<{ tam?: number; cor?: string; peso?: number; mono?: boolean; children: React.ReactNode; estilo?: React.CSSProperties }> = ({
  tam = 26, cor = COR.creme, peso = 500, mono, children, estilo,
}) => (
  <div style={{ fontFamily: mono ? FONTE.mono : peso >= 700 ? FONTE.titulo : FONTE.texto, fontSize: tam, color: cor, fontWeight: peso, ...estilo }}>
    {children}
  </div>
);

// seta em SVG que se desenha de (x1,y1) até (x2,y2) conforme "p" vai de 0 a 1
const Seta: React.FC<{ x1: number; y1: number; x2: number; y2: number; p: number; cor: string; tracejada?: boolean }> = ({
  x1, y1, x2, y2, p, cor, tracejada,
}) => {
  const xf = x1 + (x2 - x1) * p;
  const yf = y1 + (y2 - y1) * p;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const ponta = 18;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
      <line x1={x1} y1={y1} x2={xf} y2={yf} stroke={cor} strokeWidth={4} strokeDasharray={tracejada ? "12 10" : undefined} />
      {p > 0.05 && (
        <polygon
          fill={cor}
          points={`${xf},${yf} ${xf - ponta * Math.cos(ang - 0.45)},${yf - ponta * Math.sin(ang - 0.45)} ${xf - ponta * Math.cos(ang + 0.45)},${yf - ponta * Math.sin(ang + 0.45)}`}
        />
      )}
    </svg>
  );
};

const Area: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", left: AREA.x, top: AREA.y, width: AREA.w, height: AREA.h }}>{children}</div>
);

const aparece = (e: number, dy = 20): React.CSSProperties => ({ opacity: e, transform: `translateY(${(1 - e) * dy}px)` });

// ================================================================ 01 abertura
export const Abertura: React.FC<P> = ({ cena, frame }) => {
  const { q } = usarMarcas(cena, frame);
  const t0 = surgir(frame, 0, 20);
  const aperto = interpolate(frame, [q("botao"), q("botao") + 4, q("botao") + 10], [1, 0.93, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const clicou = frame >= q("botao");
  return (
    <>
      <div style={{ position: "absolute", left: 120, top: 150, ...aparece(t0) }}>
        <T tam={30} cor={COR.verdeClaro} peso={600} mono>POST /api/reservas</T>
        <T tam={84} peso={800} estilo={{ marginTop: 14, lineHeight: 1.05, width: 900 }}>
          Uma requisição, do clique à tela
        </T>
        <T tam={30} cor={COR.texto2} estilo={{ marginTop: 26, width: 820, lineHeight: 1.4 }}>
          Seguindo o código de verdade do Refood: cada etapa mostra o arquivo e as linhas.
        </T>
      </div>
      {/* o checkout */}
      <div
        style={{
          position: "absolute", left: 120, top: 600, width: 760, borderRadius: 20, background: COR.creme,
          padding: "30px 36px", boxSizing: "border-box", ...aparece(surgir(frame, 10, 20)),
        }}
      >
        <T tam={22} cor="#5f6a6a" peso={600}>Checkout</T>
        <T tam={34} cor="#2d3436" peso={700} estilo={{ marginTop: 6 }}>Sacola surpresa · Padaria do Bairro</T>
        <T tam={22} cor="#5f6a6a" estilo={{ marginTop: 8 }}>1 sacola · PIX · R$ 14,90</T>
        <div
          style={{
            marginTop: 24, height: 76, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
            background: clicou ? "#1c4731" : "#2d6a4f", transform: `scale(${aperto})`,
            fontFamily: FONTE.titulo, fontWeight: 700, fontSize: 30, color: "#fff",
          }}
        >
          {clicou ? "Confirmando…" : "Confirmar reserva"}
        </div>
      </div>
      {/* as seis camadas */}
      <div style={{ position: "absolute", left: 1080, top: 170, width: 720 }}>
        {CAMADAS.map((c, i) => {
          const ei = surgir(frame, q("camadas") + i * 5, 12);
          return (
            <div
              key={c.id}
              style={{
                height: 118, marginBottom: 20, borderRadius: 14, border: `2px solid ${COR.verdeClaro}`,
                background: "rgba(82,183,136,0.08)", padding: "18px 26px", boxSizing: "border-box",
                display: "flex", alignItems: "center", gap: 24, ...aparece(ei, 30),
              }}
            >
              <T tam={44} peso={800} cor={COR.verdeClaro} estilo={{ width: 40 }}>{i + 1}</T>
              <div>
                <T tam={32} peso={700}>{c.nome}</T>
                <T tam={20} cor={COR.texto2} estilo={{ marginTop: 4 }}>{c.sub}</T>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

// ================================================================ 04 http
export const Http: React.FC<P> = ({ cena, frame }) => {
  const { q, e } = usarMarcas(cena, frame);
  const viagem = interpolate(frame, [q("texto"), q("texto") + 45], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic),
  });
  const PEDIDO = [
    ["POST /api/reservas HTTP/1.1", COR.laranja],
    ["Host: 127.0.0.1:8000", COR.creme],
    ["Authorization: Bearer eyJhbGciOiJIUzI1NiIs…", COR.creme],
    ["Content-Type: application/json", COR.creme],
    ["", COR.creme],
    ['{"id_alimento": 5, "quantidade": 1, "forma_pagamento": "PIX"}', "#a7d8a0"],
  ];
  return (
    <Area>
      <Caixa x={0} y={20} w={380} h={170} cor={COR.verdeClaro}>
        <T tam={32} peso={700}>Navegador</T>
        <T tam={21} cor={COR.texto2} estilo={{ marginTop: 8 }}>checkout.js → api.js → fetch</T>
      </Caixa>
      <Caixa x={880} y={20} w={380} h={170} cor={e("servidor") > 0.5 ? COR.verdeClaro : COR.borda} luz={e("servidor") * (1 - e("nunca"))}>
        <T tam={32} peso={700}>Servidor (API)</T>
        <T tam={21} cor={COR.texto2} mono estilo={{ marginTop: 8 }}>uvicorn · 127.0.0.1:8000</T>
        <T tam={21} cor={COR.texto2} estilo={{ marginTop: 4 }}>FastAPI + nosso código</T>
      </Caixa>
      <Seta x1={390} y1={105} x2={870} y2={105} p={viagem} cor={COR.verdeClaro} />
      {/* o envelope */}
      <div
        style={{
          position: "absolute", left: 390 + 420 * viagem, top: 62, width: 64, height: 44, borderRadius: 6,
          background: COR.creme, opacity: viagem > 0 && viagem < 1 ? 1 : 0,
        }}
      />
      {/* o pedido cru */}
      <div
        style={{
          position: "absolute", left: 0, top: 240, width: 1260, background: COR.painel, borderRadius: 14,
          border: `1.5px solid ${COR.borda}`, padding: "18px 28px", boxSizing: "border-box",
          ...aparece(e("texto")), opacity: e("texto") * (1 - e("nunca")),
        }}
      >
        <T tam={20} cor={COR.texto3} estilo={{ marginBottom: 10 }}>O que vai pelo cabo, como texto</T>
        {PEDIDO.map(([l, c], i) => (
          <T key={i} tam={26} mono cor={c} estilo={{ height: 40, whiteSpace: "pre", fontVariantLigatures: "none" }}>{l}</T>
        ))}
      </div>
      {/* o banco, que o navegador não alcança */}
      <div style={{ position: "absolute", left: 480, top: 640, width: 300, ...aparece(e("nunca")) }}>
        <svg width={300} height={190}>
          <ellipse cx={150} cy={30} rx={130} ry={26} fill={COR.fundo2} stroke={COR.azul} strokeWidth={3} />
          <path d="M20 30 V150 A130 26 0 0 0 280 150 V30" fill={COR.fundo2} stroke={COR.azul} strokeWidth={3} />
          <ellipse cx={150} cy={30} rx={130} ry={26} fill={COR.fundo2} stroke={COR.azul} strokeWidth={3} />
          <text x={150} y={110} textAnchor="middle" fill={COR.creme} fontFamily={FONTE.titulo} fontWeight={700} fontSize={34}>MySQL</text>
        </svg>
      </div>
      <div style={{ opacity: e("nunca") }}>
        <Seta x1={190} y1={200} x2={470} y2={720} p={e("nunca", 20)} cor={COR.coral} tracejada />
        <div style={{ position: "absolute", left: 300, top: 395, fontFamily: FONTE.titulo, fontWeight: 800, fontSize: 80, color: COR.coral, opacity: surgir(frame, q("nunca") + 18, 8) }}>
          ✕
        </div>
        <T tam={24} cor={COR.coral} peso={600} estilo={{ position: "absolute", left: 0, top: 800, width: 440 }}>
          o navegador nunca fala com o banco
        </T>
      </div>
      <div style={{ opacity: e("api") }}>
        <Seta x1={1070} y1={200} x2={790} y2={720} p={e("api", 20)} cor={COR.verdeClaro} />
        <T tam={24} cor={COR.verdeClaro} peso={600} estilo={{ position: "absolute", left: 860, top: 800, width: 400 }}>
          só a API conversa com o MySQL
        </T>
      </div>
    </Area>
  );
};

// ================================================================ 06 framework x biblioteca
export const Biblioteca: React.FC<P> = ({ cena, frame }) => {
  const { e } = usarMarcas(cena, frame);
  const fw = e("framework", 18);
  const bib = e("biblioteca", 18);
  const ind = e("independentes");
  const ponte = e("ponte");
  return (
    <Area>
      <Caixa x={0} y={0} w={560} h={180} cor={fw > 0.3 ? COR.laranja : COR.borda} luz={fw * (1 - ind)}>
        <T tam={22} cor={COR.laranja} peso={600}>FRAMEWORK</T>
        <T tam={40} peso={800} estilo={{ marginTop: 4 }}>FastAPI</T>
        <T tam={21} cor={COR.texto2} estilo={{ marginTop: 6 }}>recebe o HTTP, roda Depends, valida</T>
      </Caixa>
      <Caixa x={0} y={300} w={560} h={250} cor={COR.verdeClaro} luz={ponte}>
        <T tam={22} cor={COR.verdeClaro} peso={600}>NOSSO CÓDIGO</T>
        <T tam={30} mono peso={600} estilo={{ marginTop: 10 }}>reservar()</T>
        <T tam={20} cor={COR.texto2} mono>app/rotas/consumidor.py</T>
        <T tam={30} mono peso={600} estilo={{ marginTop: 14 }} cor={ponte > 0.5 ? COR.laranja : COR.creme}>database.py</T>
        <T tam={20} cor={COR.texto2} mono>conectar() · get_db() · buscar_um()</T>
      </Caixa>
      <Caixa x={0} y={670} w={560} h={180} cor={bib > 0.3 ? COR.azul : COR.borda} luz={bib * (1 - ind)}>
        <T tam={22} cor={COR.azul} peso={600}>BIBLIOTECA</T>
        <T tam={40} peso={800} estilo={{ marginTop: 4 }}>PyMySQL</T>
        <T tam={21} cor={COR.texto2} estilo={{ marginTop: 6 }}>leva o SQL até o MySQL e traz as linhas</T>
      </Caixa>
      <Seta x1={280} y1={185} x2={280} y2={292} p={fw} cor={COR.laranja} />
      <T tam={24} peso={600} cor={COR.laranja} estilo={{ position: "absolute", left: 310, top: 220, opacity: fw }}>
        ele chama a gente
      </T>
      <Seta x1={280} y1={555} x2={280} y2={662} p={bib} cor={COR.azul} />
      <T tam={24} peso={600} cor={COR.azul} estilo={{ position: "absolute", left: 310, top: 590, opacity: bib }}>
        a gente chama ela
      </T>

      {/* a explicação à direita */}
      <div style={{ position: "absolute", left: 660, top: 0, width: 600 }}>
        <div style={aparece(fw)}>
          <T tam={30} peso={700} cor={COR.laranja}>Inversão de controle</T>
          <T tam={24} cor={COR.texto2} estilo={{ marginTop: 10, lineHeight: 1.45 }}>
            Ninguém no nosso código escreve <span style={{ fontFamily: FONTE.mono, color: COR.creme }}>reservar(...)</span>.
            O FastAPI decide quando chamar, e com quais argumentos.
          </T>
        </div>
        <div style={{ marginTop: 50, ...aparece(bib) }}>
          <T tam={30} peso={700} cor={COR.azul}>Biblioteca: quem manda somos nós</T>
          <T tam={24} cor={COR.texto2} estilo={{ marginTop: 10, lineHeight: 1.45 }}>
            O database.py chama <span style={{ fontFamily: FONTE.mono, color: COR.creme }}>pymysql.connect()</span> e{" "}
            <span style={{ fontFamily: FONTE.mono, color: COR.creme }}>cur.execute()</span> quando quer.
          </T>
        </div>
        <div
          style={{
            marginTop: 50, background: COR.painel, border: `1.5px solid ${COR.borda}`, borderRadius: 14,
            padding: "18px 26px", ...aparece(ind),
          }}
        >
          <T tam={20} cor={COR.texto3} mono>requirements.txt</T>
          <T tam={26} mono estilo={{ marginTop: 8 }}>fastapi==0.143.3</T>
          <T tam={26} mono>PyMySQL==1.2.3</T>
          <T tam={22} cor={COR.texto2} estilo={{ marginTop: 12 }}>
            Dois pacotes separados. O FastAPI não sabe que o MySQL existe.
          </T>
        </div>
        <div style={{ marginTop: 40, ...aparece(ponte) }}>
          <T tam={30} peso={700} cor={COR.laranja}>database.py é a ponte</T>
          <T tam={24} cor={COR.texto2} estilo={{ marginTop: 10, lineHeight: 1.45 }}>
            Abre a conexão com o PyMySQL e entrega para o FastAPI pelo{" "}
            <span style={{ fontFamily: FONTE.mono, color: COR.creme }}>Depends(get_db)</span>.
          </T>
        </div>
      </div>
    </Area>
  );
};

// ================================================================ 11 o %s
const Linha: React.FC<{ children: React.ReactNode; cor?: string; estilo?: React.CSSProperties }> = ({ children, cor = COR.borda, estilo }) => (
  <div
    style={{
      background: COR.painel, border: `2px solid ${cor}`, borderRadius: 12, padding: "14px 22px",
      fontFamily: FONTE.mono, fontSize: 26, color: COR.creme, whiteSpace: "pre",
      fontVariantLigatures: "none", fontFeatureSettings: '"liga" 0, "calt" 0', ...estilo,
    }}
  >
    {children}
  </div>
);
const PS: React.FC<{ luz: number }> = ({ luz }) => (
  <span style={{ color: COR.laranja, background: `rgba(244,162,97,${0.3 * luz})`, borderRadius: 4, padding: "0 4px" }}>%s</span>
);

export const Injecao: React.FC<P> = ({ cena, frame }) => {
  const { e } = usarMarcas(cena, frame);
  const pulso = 0.5 + 0.5 * Math.sin(frame / 5);
  return (
    <Area>
      <T tam={22} cor={COR.texto3} estilo={{ marginBottom: 10 }}>app/rotas/consumidor.py · o SQL e o valor viajam separados</T>
      <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
        <Linha cor={e("porcento") > 0.5 ? COR.laranja : COR.borda} estilo={{ flex: 1, fontSize: 23 }}>
          <span style={{ color: COR.azul }}>FROM</span> alimentos <span style={{ color: COR.azul }}>WHERE</span> id_alimento = <PS luz={e("porcento") * pulso} />{" "}
          <span style={{ color: COR.azul }}>FOR UPDATE</span>
        </Linha>
        <Linha cor={COR.verdeClaro} estilo={{ fontSize: 23, ...aparece(e("tupla")) }}>
          (dados.id_alimento,) <span style={{ color: COR.texto3 }}>→</span> <span style={{ color: COR.dourado }}>(5,)</span>
        </Linha>
      </div>
      <div style={{ marginTop: 26, ...aparece(e("trata")) }}>
        <T tam={22} cor={COR.texto3} estilo={{ marginBottom: 10 }}>app/database.py · buscar_um() entrega os dois ao PyMySQL</T>
        <Linha>
          cur.execute(sql, params)  <span style={{ color: COR.texto3 }}># o PyMySQL escapa o valor e só então junta</span>
        </Linha>
        <Linha cor={COR.verdeClaro} estilo={{ marginTop: 14 }}>
          <span style={{ color: COR.texto3 }}>vai ao MySQL: </span>... <span style={{ color: COR.azul }}>WHERE</span> id_alimento = <span style={{ color: COR.dourado }}>5</span>{" "}
          <span style={{ color: COR.azul }}>FOR UPDATE</span>
        </Linha>
      </div>

      <div style={{ marginTop: 44, ...aparece(e("ataque")) }}>
        <T tam={28} peso={700}>
          E se alguém mandar <span style={{ fontFamily: FONTE.mono, color: COR.coral }}>5 OR 1=1</span> no lugar do número?
        </T>
        <div style={{ display: "flex", gap: 24, marginTop: 18 }}>
          <div style={{ flex: 1 }}>
            <T tam={22} cor={COR.coral} peso={600}>✕ Colando o valor no texto (f-string)</T>
            <Linha cor={COR.coral} estilo={{ marginTop: 10, fontSize: 23 }}>
              ... id_alimento = <span style={{ color: COR.coral }}>5 OR 1=1</span>
            </Linha>
            <T tam={21} cor={COR.texto2} estilo={{ marginTop: 10 }}>vira comando: a condição vale para todas as linhas</T>
          </div>
          <div style={{ flex: 1, ...aparece(e("texto")) }}>
            <T tam={22} cor={COR.verdeClaro} peso={600}>✓ Com %s e a tupla</T>
            <Linha cor={COR.verdeClaro} estilo={{ marginTop: 10, fontSize: 23 }}>
              ... id_alimento = <span style={{ color: "#a7d8a0" }}>'5 OR 1=1'</span>
            </Linha>
            <T tam={21} cor={COR.texto2} estilo={{ marginTop: 10 }}>vira só um texto entre aspas, nunca um comando</T>
          </div>
        </div>
      </div>
      <T tam={21} cor={COR.texto3} estilo={{ position: "absolute", bottom: 0, left: 0, width: 1260, lineHeight: 1.4, ...aparece(e("protecao")) }}>
        No Refood esse valor nem chegaria aqui: o Pydantic exige id_alimento inteiro e devolve 422. O %s é a segunda barreira,
        e vale para todo SQL do projeto.
      </T>
    </Area>
  );
};

// ================================================================ 12 a disputa
export const Corrida: React.FC<P> = ({ cena, frame }) => {
  const { q, e } = usarMarcas(cena, frame);
  const passou = (n: string) => frame >= q(n);
  const qtd = passou("baixa") ? 0 : 1;
  const confirmado = passou("commit");
  const dono = passou("zero") ? "Bruno" : passou("solta") ? null : passou("ana") ? "Ana" : null;
  const corDono = dono === "Ana" ? COR.verdeClaro : dono === "Bruno" ? COR.laranja : COR.texto3;
  const espera = passou("bruno") && !passou("solta");
  const pontos = ".".repeat(1 + (Math.floor(frame / 8) % 3));

  const Passo: React.FC<{ quando: string; cor: string; titulo: string; sub?: string }> = ({ quando, cor, titulo, sub }) => {
    const x = surgir(frame, q(quando), 10);
    return (
      <div
        style={{
          minWidth: 250, borderRadius: 12, border: `2px solid ${cor}`, background: COR.fundo2,
          padding: "12px 18px", ...aparece(x, 16),
        }}
      >
        <T tam={23} mono peso={600} cor={cor}>{titulo}</T>
        {sub && <T tam={19} cor={COR.texto2} estilo={{ marginTop: 4 }}>{sub}</T>}
      </div>
    );
  };

  return (
    <Area>
      {/* a linha disputada */}
      <div
        style={{
          margin: "0 auto", width: 860, borderRadius: 16, border: `2.5px solid ${corDono}`, background: COR.painel,
          padding: "20px 30px", display: "flex", alignItems: "center", gap: 30,
        }}
      >
        <div style={{ flex: 1 }}>
          <T tam={20} cor={COR.texto3} mono>tabela alimentos</T>
          <T tam={30} mono estilo={{ marginTop: 6 }}>
            id_alimento <span style={{ color: COR.dourado }}>5</span> · quantidade{" "}
            <span style={{ color: qtd === 0 ? COR.coral : COR.dourado, fontWeight: 600 }}>{qtd}</span>
            {qtd === 0 && !confirmado && <span style={{ color: COR.texto3, fontSize: 20 }}> (ainda sem commit)</span>}
          </T>
        </div>
        <div style={{ textAlign: "center", width: 200 }}>
          <T tam={46}>{dono ? "🔒" : "🔓"}</T>
          <T tam={20} cor={corDono} peso={600}>{dono ? `trava: ${dono}` : "livre"}</T>
        </div>
      </div>

      {/* Ana */}
      <div style={{ position: "absolute", top: 200, left: 0, width: 1260, ...aparece(e("ana")) }}>
        <T tam={34} peso={800} cor={COR.verdeClaro}>Ana</T>
        <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
          <Passo quando="ana" cor={COR.verdeClaro} titulo="SELECT … FOR UPDATE" sub="pega a trava · lê quantidade 1" />
          <Passo quando="baixa" cor={COR.verdeClaro} titulo="UPDATE · INSERT" sub="quantidade 0 · cria a reserva" />
          <Passo quando="commit" cor={COR.verdeClaro} titulo="COMMIT ✓" sub="201 Created · RF-24098" />
        </div>
      </div>

      {/* Bruno */}
      <div style={{ position: "absolute", top: 450, left: 0, width: 1260, ...aparece(e("bruno")) }}>
        <T tam={34} peso={800} cor={COR.laranja}>Bruno</T>
        <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
          <Passo quando="bruno" cor={COR.laranja} titulo="SELECT … FOR UPDATE" sub={espera ? `esperando a trava${pontos}` : "esperou a trava da Ana"} />
          <Passo quando="zero" cor={COR.laranja} titulo="lê quantidade 0" sub="já com o commit da Ana" />
          <Passo quando="erro" cor={COR.coral} titulo="ROLLBACK · 409" sub="Esta sacola não está mais disponível." />
        </div>
      </div>

      {/* sem a trava */}
      <div
        style={{
          position: "absolute", top: 700, left: 0, width: 1260, borderRadius: 14, border: `2px dashed ${COR.coral}`,
          padding: "18px 26px", boxSizing: "border-box", ...aparece(e("sem")),
        }}
      >
        <T tam={26} peso={700} cor={COR.coral}>Sem o FOR UPDATE</T>
        <T tam={23} cor={COR.creme} estilo={{ marginTop: 8 }}>
          Ana e Bruno leem quantidade 1 ao mesmo tempo → os dois gravam uma reserva → uma sacola, duas reservas.
        </T>
      </div>
    </Area>
  );
};

// ================================================================ 16 a tela
export const Tela: React.FC<P> = ({ cena, frame }) => {
  const { e } = usarMarcas(cena, frame);
  const t0 = surgir(frame, 0, 18);
  const cod = e("codigo", 14);
  // um "QR" decorativo, sempre igual: pontos pseudoaleatórios e os três quadrados de canto
  const N = 21;
  const canto = (x: number, y: number) => {
    for (const [cx, cy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
      const dx = x - cx, dy = y - cy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
        const borda = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const miolo = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        return borda || miolo ? 1 : 0;
      }
    }
    return -1;
  };
  const celulas = Array.from({ length: N * N }, (_, i) => {
    const c = canto(i % N, Math.floor(i / N));
    if (c >= 0) return c === 1;
    const h = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return h - Math.floor(h) < 0.48;
  });
  return (
    <Area>
      <div
        style={{
          margin: "10px auto 0", width: 700, height: 820, borderRadius: 26, background: "#f8f5f0", overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)", ...aparece(t0, 40),
        }}
      >
        <div style={{ height: 64, background: "#fff", borderBottom: "1px solid #e4e6e6", display: "flex", alignItems: "center", padding: "0 24px", gap: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: "#e76f51" }} />
          <div style={{ width: 14, height: 14, borderRadius: 7, background: "#f4a261" }} />
          <div style={{ width: 14, height: 14, borderRadius: 7, background: "#52b788" }} />
          <div style={{ marginLeft: 16, fontFamily: FONTE.mono, fontSize: 18, color: "#5f6a6a" }}>/reserva.html?id=87&amp;nova=1</div>
        </div>
        <div style={{ padding: "40px 50px", textAlign: "center" }}>
          <T tam={46} peso={800} cor="#1c4731">Reserva confirmada!</T>
          <T tam={24} cor="#5f6a6a" estilo={{ marginTop: 10 }}>Sacola surpresa · Padaria do Bairro</T>
          <div style={{ margin: "34px auto 0", width: 300, height: 300, display: "grid", gridTemplateColumns: "repeat(21, 1fr)", background: "#fff", padding: 14, borderRadius: 12 }}>
            {celulas.map((c, i) => (
              <div key={i} style={{ background: c ? "#2d3436" : "transparent" }} />
            ))}
          </div>
          <div style={{ marginTop: 30, transform: `scale(${0.85 + 0.15 * cod})`, opacity: 0.3 + 0.7 * cod }}>
            <T tam={22} cor="#5f6a6a" peso={600}>RESERVA</T>
            <T tam={64} peso={800} cor="#2d6a4f" mono>#RF-24098</T>
          </div>
          <T tam={22} cor="#5f6a6a" estilo={{ marginTop: 18 }}>Mostre este código na retirada.</T>
        </div>
      </div>
    </Area>
  );
};

// ================================================================ 17 resumo
const PAPEL: Record<string, string> = {
  navegador: "monta o pedido (api.js)",
  http: "leva o pedido como texto",
  fastapi: "roteia, confere o login, valida",
  ponte: "abre a conexão e entrega (get_db)",
  pymysql: "leva o SQL até o banco",
  mysql: "trava, grava e confirma",
};

export const Resumo: React.FC<P> = ({ cena, frame }) => {
  const { q, e } = usarMarcas(cena, frame);
  const ordem = ["navegador", "http", "fastapi", "ponte", "pymysql", "mysql"];
  const volta = frame >= q("volta");
  const yDe = (i: number) => 190 + i * 125;
  // a bolinha desce marca a marca e depois sobe de uma vez
  const descida = ordem.map((id) => q(id));
  let yBola = yDe(0) + 50;
  for (let i = 0; i < ordem.length; i++) {
    if (frame >= descida[i]) yBola = yDe(i) + 50;
    if (i > 0) {
      const p = interpolate(frame, [descida[i] - 10, descida[i]], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      if (p > 0 && p < 1) yBola = yDe(i - 1) + 50 + 125 * p;
    }
  }
  const sobe = interpolate(frame, [q("volta"), q("volta") + 40], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic),
  });
  if (volta) yBola = yDe(5) + 50 - (yDe(5) - yDe(0)) * sobe;
  const corBola = volta ? COR.laranja : COR.verdeClaro;
  const fim = e("fim", 20);

  return (
    <>
      <div style={{ position: "absolute", left: 300, top: 0 }}>
        {ordem.map((id, i) => {
          const c = CAMADAS.find((x) => x.id === id)!;
          const ei = e(id, 10);
          return (
            <div
              key={id}
              style={{
                position: "absolute", top: yDe(i), left: 80, width: 1240, height: 100, borderRadius: 14,
                border: `2px solid ${ei > 0.5 ? COR.verdeClaro : COR.borda}`, background: `rgba(82,183,136,${0.03 + 0.1 * ei})`,
                display: "flex", alignItems: "center", padding: "0 30px", boxSizing: "border-box", gap: 30,
                opacity: 1 - 0.6 * fim,
              }}
            >
              <T tam={34} peso={700} estilo={{ width: 300 }}>{c.nome}</T>
              <T tam={27} cor={COR.texto2} estilo={{ opacity: ei }}>{PAPEL[id]}</T>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 20, top: yBola - 15, width: 30, height: 30, borderRadius: 15, background: corBola, boxShadow: `0 0 28px ${corBola}`, opacity: 1 - fim }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 440, textAlign: "center", ...aparece(fim, 30) }}>
        <div
          style={{
            display: "inline-block", background: COR.fundo, border: `3px solid ${COR.verdeClaro}`, borderRadius: 24,
            padding: "40px 70px", boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          }}
        >
          <T tam={72} peso={800}>Um clique, seis camadas,</T>
          <T tam={72} peso={800} cor={COR.verdeClaro}>uma transação.</T>
          <T tam={26} cor={COR.texto2} mono estilo={{ marginTop: 20 }}>POST /api/reservas · Refood</T>
        </div>
      </div>
    </>
  );
};
