import { loadFont as carregarInter } from "@remotion/google-fonts/Inter";
import { loadFont as carregarJetBrains } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as carregarJakarta } from "@remotion/google-fonts/PlusJakartaSans";

// As cores do próprio Refood (static/css), num fundo escuro para o código ler bem no projetor.
export const COR = {
  fundo: "#0f1f17",
  fundo2: "#15291f",
  painel: "#0b1611",
  borda: "#24402f",
  creme: "#f8f5f0",
  texto2: "#b7c4bb",
  texto3: "#7d8f84",
  verde: "#2d6a4f",
  verdeClaro: "#52b788",
  laranja: "#f4a261",
  coral: "#e76f51",
  dourado: "#d3a13b",
  azul: "#8ecae6",
};

export const FONTE = {
  titulo: carregarJakarta("normal", { weights: ["600", "700", "800"], subsets: ["latin"] }).fontFamily,
  texto: carregarInter("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily,
  mono: carregarJetBrains("normal", { weights: ["400", "600"], subsets: ["latin"] }).fontFamily,
};

// área de conteúdo à direita do diagrama de camadas
export const AREA = { x: 600, y: 170, w: 1260, h: 850 };
