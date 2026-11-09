import { interpolate, Easing } from "remotion";
import type { Cena } from "./roteiro";
import { CENAS } from "./roteiro";
import tempos from "./tempos.json";

// Cada cena dura a fala dela (src/tempos.json, de ferramentas/narrar.mjs) mais uma folga.
// "instante(cena, pedaço)" diz em que quadro da cena a voz fala aquele pedaço.

export const FPS = 30;
export const ATRASO = 0.35; // a voz começa um pouco depois do corte
const FOLGA = 1.0;
const FOLGA_FINAL = 3.0;
const LETRAS_POR_SEGUNDO = 12.4; // só para cena ainda sem voz

type Tempo = { texto: string; dur: number; letras: number[] };
const TAB = tempos as unknown as Record<string, Tempo>;

export const temVoz = (c: Cena) => TAB[c.id]?.texto === c.fala;

export const quadrosDaCena = (c: Cena) => {
  const fala = temVoz(c) ? TAB[c.id].dur : c.fala.length / LETRAS_POR_SEGUNDO;
  const folga = c === CENAS[CENAS.length - 1] ? FOLGA_FINAL : FOLGA;
  return Math.ceil((ATRASO + fala + folga) * FPS);
};

export const instante = (c: Cena, pedaco: string) => {
  const i = c.fala.toLowerCase().indexOf(pedaco.toLowerCase());
  if (i < 0) throw new Error(`cena ${c.id}: "${pedaco}" não está na fala`);
  const s = temVoz(c) ? TAB[c.id].letras[i] : i / LETRAS_POR_SEGUNDO;
  return Math.round((ATRASO + s) * FPS);
};

export const INICIOS = CENAS.reduce<number[]>((acc, c, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + quadrosDaCena(CENAS[i - 1]));
  return acc;
}, []);
export const TOTAL = INICIOS[INICIOS.length - 1] + quadrosDaCena(CENAS[CENAS.length - 1]);

// 0 -> 1 a partir do quadro "de", em "dur" quadros, com saída suave
export const surgir = (frame: number, de: number, dur = 12) =>
  interpolate(frame, [de, de + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
