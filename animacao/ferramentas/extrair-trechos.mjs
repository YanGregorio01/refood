// Copia do código de verdade do Refood os trechos que aparecem na animação.
// Cada trecho é achado por uma ÂNCORA (um pedaço de texto da linha), não por número de linha:
// se o código mudar de lugar, o trecho e a numeração continuam certos.
//
//   node ferramentas/extrair-trechos.mjs     -> grava src/trechos.json
//
// Se uma âncora sumir do código, o script para com erro: aí o roteiro precisa ser revisto.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REFOOD = path.resolve(AQUI, "..", "..");
const SAIDA = path.resolve(AQUI, "..", "src", "trechos.json");

// id: { arquivo, ancora, linhas, depois?, antes?, manter? }
//   depois = a busca da âncora só começa depois desta outra âncora
//   antes  = quantas linhas acima da âncora o trecho começa
//   manter = só estas faixas do trecho ([de, até], contando do 0); o que fica de fora vira "⋯"
const TRECHOS = {
  checkout_submit: { arquivo: "static/js/paginas/checkout.js", ancora: 'form.addEventListener("submit"', linhas: 18 },
  checkout_erro: { arquivo: "static/js/paginas/checkout.js", ancora: "} catch (erro) {", depois: 'form.addEventListener("submit"', linhas: 14 },
  api_base: { arquivo: "static/js/api.js", ancora: "const BASE =", linhas: 2 },
  api_sessao: { arquivo: "static/js/api.js", ancora: "export function sessao()", linhas: 4 },
  api_monta: { arquivo: "static/js/api.js", ancora: "const url = new URL(BASE", linhas: 17 },
  api_volta: { arquivo: "static/js/api.js", ancora: "const dados = await resposta.json()", linhas: 10 },
  checkout_destino: { arquivo: "static/js/paginas/checkout.js", ancora: "location.replace(`/reserva.html", antes: 1, linhas: 2 },
  main_rotas: { arquivo: "app/main.py", ancora: "for modulo in (publico", linhas: 2 },
  main_422: { arquivo: "app/main.py", ancora: "@app.exception_handler(RequestValidationError)", linhas: 12 },
  cons_router: { arquivo: "app/rotas/consumidor.py", ancora: 'router = APIRouter(prefix="/api"', linhas: 2 },
  cons_rota: { arquivo: "app/rotas/consumidor.py", ancora: '@router.post("/reservas"', linhas: 2 },
  cons_trans: { arquivo: "app/rotas/consumidor.py", ancora: "    conn.begin()", depois: "def reservar(", linhas: 15 },
  cons_grava: { arquivo: "app/rotas/consumidor.py", ancora: "    restante = sacola", depois: "def reservar(", linhas: 11 },
  cons_return: { arquivo: "app/rotas/consumidor.py", ancora: "return _reserva_do_usuario(conn, id_reserva", depois: "def reservar(", linhas: 1 },
  db_conectar: { arquivo: "app/database.py", ancora: "def conectar():", linhas: 12, manter: [[0, 2], [9, 11]] },
  db_get: { arquivo: "app/database.py", ancora: "def get_db():", linhas: 15, manter: [[0, 1], [7, 14]] },
  db_buscar_um: { arquivo: "app/database.py", ancora: "def buscar_um(", linhas: 5 },
  seg_usuario: { arquivo: "app/seguranca.py", ancora: "def usuario_atual(", linhas: 23, manter: [[0, 2], [5, 6], [8, 8], [14, 19]] },
  seg_verificar: { arquivo: "app/seguranca.py", ancora: "def verificar(", linhas: 4 },
  cons_consumidor: { arquivo: "app/rotas/consumidor.py", ancora: 'consumidor = exigir(', linhas: 1 },
  seg_exigir: { arquivo: "app/seguranca.py", ancora: "def exigir(*tipos):", linhas: 13 },
  esq_reserva: { arquivo: "app/esquemas.py", ancora: "class NovaReserva", linhas: 4 },
  util_codigo: { arquivo: "app/util.py", ancora: "def novo_codigo_retirada", linhas: 6 },
};

const saida = {};
for (const [id, t] of Object.entries(TRECHOS)) {
  const texto = readFileSync(path.join(REFOOD, t.arquivo), "utf8").replace(/\r\n/g, "\n");
  const todas = texto.split("\n");
  let desde = 0;
  if (t.depois) {
    desde = todas.findIndex((l) => l.includes(t.depois));
    if (desde < 0) throw new Error(`${id}: não achei "${t.depois}" em ${t.arquivo}`);
  }
  const i = todas.findIndex((l, n) => n >= desde && l.includes(t.ancora));
  if (i < 0) throw new Error(`${id}: não achei a âncora "${t.ancora}" em ${t.arquivo}`);
  const inicio = i - (t.antes ?? 0);
  const faixas = t.manter ?? [[0, t.linhas - 1]];
  const linhas = [];
  const numeros = [];
  faixas.forEach(([de, ate], k) => {
    if (k > 0 || de > 0) { linhas.push(""); numeros.push(null); } // o "⋯" do que foi pulado
    for (let n = de; n <= ate; n++) { linhas.push(todas[inicio + n]); numeros.push(inicio + n + 1); }
  });
  saida[id] = { arquivo: t.arquivo, inicio: inicio + 1, fim: inicio + t.linhas, linhas, numeros };
  console.log(`${id.padEnd(17)} ${t.arquivo}:${inicio + 1}-${inicio + t.linhas}`);
}
writeFileSync(SAIDA, JSON.stringify(saida, null, 2) + "\n");
console.log(`\n${Object.keys(saida).length} trechos em ${path.relative(process.cwd(), SAIDA)}`);
