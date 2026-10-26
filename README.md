# Refood

Plataforma web que conecta estabelecimentos com alimentos excedentes a
consumidores (sacolas surpresa com até 70% de desconto) e a ONGs (doações).
Projeto Integrador 4 da PUC-Campinas, curso de Ciência de Dados e IA:
João Luís Erustes Zamuner, Pedro Augusto Amorim e Oliveira, Vitor Soares
Polizel e Yan Gregorio.

**Stack:** MySQL 8 · Python com FastAPI · HTML, CSS e JavaScript puros.

## Como rodar

Você precisa do Python 3.12 ou mais novo e de um MySQL 8 rodando (o do
MySQL Workbench serve).

```powershell
# 1. Ambiente Python e dependências (uma vez)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 2. Configuração: copie o modelo e preencha a senha do seu MySQL e uma JWT_SECRET
copy .env.example .env
notepad .env

# 3. Banco: cria o banco "refood" com as tabelas, os dados de exemplo e 12 semanas de histórico
python -m scripts.preparar_banco

# 4. Servidor
uvicorn app.main:app
```

Abra **http://127.0.0.1:8000** para o site e **http://127.0.0.1:8000/docs** para
testar a API.

Prefere montar o banco pelo Workbench? Rode `sql/schema.sql` e depois
`sql/dados_exemplo.sql`. Em seguida, `python -m scripts.gerar_historico` acrescenta
o histórico que alimenta os relatórios e o dashboard.

### Contas de exemplo

Todas com a senha **refood123**:

| Conta | Quem é | O que dá para ver |
|---|---|---|
| `camila@refood.test` | consumidora | catálogo, reserva, meus pedidos, perfil com impacto |
| `padaria@refood.test` | comerciante (Padaria Dona Flor) | dashboard, sacolas, pedidos, doações, relatórios |
| `ong@refood.test` | ONG (Instituto Mesa Cheia) | mapa de doações, solicitações, histórico de recebimentos |

Outras lojas: `mercado@`, `raizes@`, `verdevida@`, `saborecia@`, `economico@`,
`cafe@`. Outra ONG: `sopao@`. Todas terminam em `@refood.test`.

### Testes

```powershell
python -m pytest
```

Os testes usam um banco separado (`refood_teste`), que é apagado e recriado a
cada rodada.

## Como o projeto está organizado

```
app/                 back-end (FastAPI)
  main.py            cria a API, junta as rotas e serve o site
  config.py          lê o .env
  database.py        conexão com o MySQL e funções buscar/inserir/executar
  seguranca.py       senha (bcrypt), token (JWT) e quem pode acessar o quê
  esquemas.py        formato dos dados que a API recebe (validação)
  util.py            distância, nível de impacto, código de retirada...
  rotas/
    publico.py       catálogo, mapa e páginas das lojas (sem login)
    auth.py          cadastro, login, "quem sou eu"
    consumidor.py    início, perfil e reservas
    comerciante.py   painel da loja: sacolas, pedidos, dashboard, relatórios
    doacoes.py       doações do lado da loja
    ong.py           área da ONG
sql/
  schema.sql         tabelas (o modelo do Vitor + o que as telas pedem)
  dados_exemplo.sql  contas, lojas e sacolas de hoje e de amanhã
scripts/
  preparar_banco.py  recria o banco do zero
  gerar_historico.py 12 semanas de histórico simulado
static/              front-end (uma página HTML por tela do Figma)
  css/refood.css     cores, fontes e componentes do Figma
  js/api.js          fetch, token e redirecionamentos
  js/ui.js           formatação, cabeçalho, rodapé, menu do painel, card de sacola
  js/paginas/        o JavaScript de cada página
  painel/            telas do comerciante
  ong/               telas da ONG
tests/               testes automáticos (pytest)
docs/                contrato da API, decisões, requisitos, telas do Figma
```

## Documentos

- [docs/API.md](docs/API.md): todas as rotas, com exemplos de JSON.
- [docs/DECISOES.md](docs/DECISOES.md): as 19 decisões da pauta e as decisões técnicas.
- [docs/REQUISITOS.md](docs/REQUISITOS.md): onde cada requisito da Sprint 1 foi implementado.
- [docs/ROTEIRO-DE-ESTUDO.md](docs/ROTEIRO-DE-ESTUDO.md): a ordem para estudar e refazer o projeto à mão.
- [docs/telas/](docs/telas/): as 32 telas exportadas do Figma.
