# Roteiro para estudar e refazer o Refood à mão

O sistema inteiro já funciona. A ideia agora é cada um entender a sua parte
a ponto de conseguir escrever de novo, sem copiar. Este roteiro segue a ordem
em que uma coisa depende da outra, igual ao plano de `docs/ETAPAS-E-DIVISAO.md`.

**Como estudar cada etapa:**
1. Abra o grafo do Understand Anything e clique nos arquivos da etapa para ver
   o resumo e com quem cada um conversa. Com o Node.js 18 ou mais novo, rode na
   pasta do projeto:
   `npx https://github.com/Egonex-AI/Understand-Anything/releases/latest/download/understand-anything-viewer.tgz .`
2. Leia os arquivos indicados, de cima para baixo.
3. Feche os arquivos e responda às perguntas da etapa.
4. Refaça numa pasta sua (ou num branch) e confira com o critério "pronto quando".
5. Travou numa linha? Pergunte com `/understand-explain caminho/do/arquivo.py`
   ou `/understand-chat como funciona a reserva?`.

---

## Etapa 1: o banco (Vitor)

**Leia:** `sql/schema.sql`, depois `sql/dados_exemplo.sql`.

O que observar: as 6 tabelas originais e as 3 novas (`ongs`, `ofertas_doacao`,
`doacoes`); as chaves estrangeiras; os `CHECK` que impedem estoque negativo e
preço maior que o original; os índices.

**Perguntas:**
- Por que `alimentos` tem `quantidade` e `quantidade_inicial`? Quem usa cada uma?
- O que acontece se você tentar `UPDATE alimentos SET quantidade = -1`?
- Por que a oferta de doação e o pedido da ONG são tabelas separadas?

**Pronto quando:** você roda `schema.sql` e `dados_exemplo.sql` no Workbench e
consegue escrever, sem olhar, o SELECT que lista as sacolas disponíveis agora
com o nome da loja e da categoria.

## Etapa 2: o servidor e a conexão (Yan)

**Leia:** `app/config.py`, `app/database.py`, `app/main.py` (só até o
`include_router`).

O que observar: o `.env` com segredos fora do código; uma conexão por
requisição (`get_db`); por que `autocommit=False`; `buscar_um`, `buscar_todos`,
`inserir`, `executar`.

**Perguntas:**
- O que o `yield` faz dentro de `get_db`?
- Por que `cur.execute(sql, params)` e nunca `cur.execute(f"... {valor}")`? (pense em SQL injection)

**Pronto quando:** `GET /api/health` responde `{"status": "ok", "banco": "ok"}`.

## Etapa 3: cadastro e login (Yan)

**Leia:** `app/esquemas.py` (classes `Cadastro` e `Login`), `app/seguranca.py`, `app/rotas/auth.py`.

O que observar: o Pydantic recusando dados ruins antes da rota rodar; bcrypt
gerando o hash; o JWT com `sub`, `tipo` e `exp`; a dependência
`usuario_atual`; a função `exigir("COMUM")` criando outra dependência.

**Perguntas:**
- Por que o login responde a mesma mensagem para e-mail errado e senha errada?
- Onde fica guardada a "sessão" do usuário? O servidor guarda alguma coisa?
- Por que bcrypt e não SHA-256?

**Pronto quando:** pelo `/docs` você cadastra uma conta, faz login, clica em
Authorize com o token e o `GET /api/auth/eu` devolve a sua conta. Sem o token, devolve 401.

## Etapa 4: catálogo e mapa (Yan)

**Leia:** `app/rotas/publico.py`.

O que observar: a lista `filtros` + `params` que monta o `WHERE` aos poucos;
`ST_Distance_Sphere` calculando a distância no próprio MySQL; a paginação com
`LIMIT` e `OFFSET`; a mesma lista de campos (`CAMPOS_SACOLA`) reaproveitada.

**Pronto quando:** `GET /api/sacolas?categoria=1&raio_km=1&ordem=preco` traz só
padaria, até 1 km, da mais barata para a mais cara.

## Etapa 5: reservas (Yan)

**Leia:** `app/rotas/consumidor.py`, função `reservar`, e depois `tests/test_reservas.py`.

O que observar: `conn.begin()`, `SELECT ... FOR UPDATE`, `UPDATE`, `INSERT` e
`conn.commit()`; o `rollback` em cada erro.

**Perguntas:**
- Sem o `FOR UPDATE`, o que acontece quando duas pessoas reservam a última sacola ao mesmo tempo?
- Por que o teste `test_duas_pessoas_ao_mesmo_tempo_nao_estouram_o_estoque` espera exatamente um 201?

**Pronto quando:** `python -m pytest tests/test_reservas.py` passa.

## Etapa 6: painel do comerciante e doações (Yan)

**Leia:** `app/rotas/comerciante.py` e `app/rotas/doacoes.py`.

O que observar: a dependência `minha_loja` (e o 428 quando falta a loja); os
`SUM(CASE WHEN ...)` dos relatórios; o preenchimento dos dias sem venda no
Python; o dicionário `ACOES`, que diz de qual status para qual status cada ação leva.

**Pronto quando:** pelo `/docs`, logado como `padaria@refood.test`, você cria
uma sacola, um consumidor reserva e você confirma a retirada pelo código.

## Etapa 7: a IA (quem pegar a IA)

**Leia:** `ia/gerar_historico.py` (os padrões no topo), `ia/previsao.py`, `ia/relatorio.py`, `docs/ia/RESULTADO.md`.

O que observar: a variável que o modelo prevê (fração que sobra); o
`OneHotEncoder` transformando dia da semana e categoria em colunas de 0 e 1;
`train_test_split` separando 20% para medir o erro; o R².

**Perguntas:**
- Por que medir o erro em dados que o modelo não viu no treino?
- O gráfico `docs/ia/pesos_do_modelo.png` mostra segunda com +15 pontos. O que isso significa para o dono da padaria?
- Por que o resultado vem com um `aviso` dizendo que é estimativa (RN14)?

**Pronto quando:** você muda um número em `SOBRA_DIA_SEMANA`, recria o banco,
roda `python -m ia.relatorio` e o gráfico muda do jeito que você esperava.

## Etapa 8: a base do front (Vitor, João, Pedro)

**Leia:** `static/css/refood.css` (os tokens no topo vêm do Figma),
`static/js/api.js`, `static/js/ui.js`, e a página modelo `static/index.html` +
`static/js/paginas/index.js`.

O que observar: `fetch` com `async/await`; o token indo no cabeçalho
`Authorization`; `esc()` antes de qualquer `innerHTML` (para não abrir brecha de
XSS); módulos com `import`/`export`.

**Pronto quando:** você faz uma página nova, em branco, que lista as categorias
com `api("/categorias")`.

## Etapa 9: as telas (Vitor, João, Pedro)

Cada tela do Figma virou um par HTML + JS. Sugestão de ordem, da mais simples
para a mais completa:

1. `login.html`: formulário, `POST`, guardar a sessão, redirecionar.
2. `catalogo.html`: filtros, `GET` com parâmetros, paginação.
3. `sacola.html` → `checkout.html` → `reserva.html`: o fluxo de reserva inteiro.
4. `pedidos.html` e `perfil.html`: listas e números do consumidor.
5. `mapa.html`: Leaflet, pinos e filtros.
6. `painel/dashboard.html` e `painel/relatorios.html`: Chart.js.
7. `painel/sacolas.html`: o formulário mais completo, com criação e edição.
8. `painel/pedidos.html` e `painel/doacoes.html`: ações que mudam status.
9. `ong/mapa.html` → `ong/solicitar.html` → `ong/solicitacoes.html` → `ong/recebimentos.html`.

**Pronto quando:** você abre a tela do Figma (`docs/telas/`) ao lado da sua
página e as duas mostram as mesmas informações, vindas da API.

## Na apresentação

Cada um deve conseguir explicar em 30 segundos:
- **Banco:** por que essas tabelas e esses relacionamentos.
- **Back-end:** o caminho de uma reserva, do clique até o `COMMIT`.
- **Front:** como a página pega os dados (`fetch`) e como o login vai junto.
- **IA:** o que o modelo prevê, com quais dados e qual o erro dele.
