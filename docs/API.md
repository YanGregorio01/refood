# Contrato da API do Refood

Este arquivo é o combinado entre o back-end e o front-end: para cada rota, o
que mandar e o que volta. O front escreve o `fetch` olhando aqui. Se uma rota
mudar, este arquivo muda junto e o grupo é avisado no mesmo dia.

Para testar qualquer rota sem escrever código, abra **http://127.0.0.1:8000/docs**
com o servidor rodando. É a documentação interativa que o FastAPI gera sozinho.

## Regras gerais

**Endereço.** Toda rota começa com `/api`. Com o front servido pelo próprio
FastAPI (o normal), use caminhos relativos: `fetch("/api/sacolas")`. Com o Live
Server do VS Code (porta 5500), o `static/js/api.js` já troca para
`http://127.0.0.1:8000/api`.

**Datas.** Saem e entram no formato ISO, sem fuso: `"2026-10-16T18:00:00"`.
Horários soltos são `"18:00"`. Dinheiro e quilos são números: `11.9`.

**Login.** `POST /api/auth/login` devolve um `token`. Nas rotas protegidas,
mande o cabeçalho `Authorization: Bearer <token>`. O `api.js` faz isso sozinho.
O token vale 12 horas.

**Erros.** Sempre `{"detail": "mensagem para mostrar ao usuário"}`. Em erro de
validação (422) vem também `"campos": {"preco": "Precisa ser maior que 0."}`.

| Código | Quando | O que o front faz |
|---|---|---|
| 400/409 | regra de negócio (sacola esgotou, reserva já retirada) | mostra o `detail` |
| 401 | sem login ou token vencido | manda para `/login.html` |
| 403 | tipo de usuário errado (consumidor no painel) | mostra o `detail` |
| 404 | não encontrado | mostra o `detail` |
| 422 | campo inválido | mostra o `detail` e destaca os `campos` |
| 428 | comerciante ou ONG sem o cadastro completo | manda para `/completar-cadastro.html` |

**Status das coisas** (os textos que aparecem na tela ficam no front):

| Tabela | Status no banco | Na tela |
|---|---|---|
| sacola (`alimentos`) | `RASCUNHO`, `DISPONIVEL`, `RESERVADO` (esgotou), `INDISPONIVEL` (loja tirou), `VENCIDO` | Rascunho, Ativa, Esgotada, Removida, Encerrada |
| reserva | `PENDENTE`, `RETIRADA`, `CANCELADA`, `NAO_COMPARECEU` | Reservado, Retirado, Cancelado, Expirado |
| oferta de doação | `ATIVA`, `ENCERRADA` | Ativa, Encerrada |
| doação | `PENDENTE`, `CONFIRMADA`, `RECUSADA`, `RECEBIDA`, `CANCELADA` | Aguardando, Confirmada, Recusada, Recebida, Cancelada |

**Contas de exemplo** (senha `refood123`): `camila@refood.test` (consumidora),
`padaria@refood.test` (comerciante da Padaria Dona Flor), `ong@refood.test`
(Instituto Mesa Cheia). Outras: `lucas@`, `mariana@`, `mercado@`, `raizes@`,
`verdevida@`, `saborecia@`, `economico@`, `cafe@`, `sopao@` (todas `@refood.test`).

---

## 1. Público (sem login)

### `GET /api/health`
Confere API e banco. `{"status": "ok", "banco": "ok"}` ou 503.

### `GET /api/impacto`
Números da página inicial (tela 5.1).
```json
{"kg_salvos": 8396.8, "refeicoes_doadas": 3488, "economia_consumidores": 107799.1, "lojas_parceiras": 7}
```

### `GET /api/categorias`
```json
[{"id_categoria": 1, "nome": "Padaria e confeitaria", "descricao": "...", "imagem": "img/categorias/padaria.jpg"}]
```

### `GET /api/sacolas` — catálogo (telas 5.4 e 5.5)
Só sacolas disponíveis agora: publicadas, com estoque, dentro do horário e da validade.

| Parâmetro | Exemplo | Para quê |
|---|---|---|
| `lat`, `lng` | `-23.56`, `-46.68` | ponto de quem busca (sem eles: Largo da Batata) |
| `raio_km` | `1` | só até essa distância |
| `categoria` | `1` | id da categoria |
| `estabelecimento` | `3` | só de uma loja |
| `busca` | `pão` | procura no nome da sacola, da loja, da categoria e no bairro |
| `preco_max` | `15` | preço Refood até |
| `disponivel_agora` | `true` | só as que estão no horário de retirada neste momento |
| `ordem` | `proximo` \| `preco` \| `desconto` \| `termina` | ordenação |
| `limite`, `pagina` | `12`, `1` | paginação ("Carregar mais") |

```json
{
  "total": 18, "pagina": 1, "limite": 12,
  "itens": [{
    "id_alimento": 1, "nome": "Sacola surpresa da padaria", "descricao": "Uma seleção...",
    "quantidade": 4, "quantidade_inicial": 6,
    "preco_original": 32.0, "preco": 11.9, "desconto": 63, "peso_estimado_kg": 1.2,
    "foto": "img/categorias/padaria.jpg",
    "inicio_retirada": "2026-10-16T18:00:00", "fim_retirada": "2026-10-16T19:30:00",
    "validade": "2026-10-16T23:59:00", "status": "DISPONIVEL", "data_cadastro": "2026-10-16T09:12:19",
    "id_categoria": 1, "categoria": "Padaria e confeitaria",
    "id_estabelecimento": 1, "estabelecimento": "Padaria Dona Flor", "tipo_estabelecimento": "PADARIA",
    "endereco": "Rua dos Pinheiros, 450", "bairro": "Pinheiros", "cidade": "São Paulo",
    "latitude": -23.5655, "longitude": -46.6815, "distancia_m": 1258
  }]
}
```
As etiquetas dos cards saem destes campos: "ÚLTIMAS 2" (`quantidade <= 2`),
"EXPIRA HOJE" (`fim_retirada` é hoje), "NOVO" (`data_cadastro` nas últimas 24 h),
"3 DISPONÍVEIS" (`quantidade`).

### `GET /api/sacolas/{id}` — detalhe (tela 6.2)
Os mesmos campos acima, mais `telefone`, `foto_estabelecimento`, `nota_media`,
`total_avaliacoes` e `disponivel` (`true`/`false`; se `false`, mostrar "Esgotada"
e esconder o botão de reservar). Aceita `lat` e `lng`. 404 se não existir.

### `GET /api/estabelecimentos` — mapa (tela 5.3)
Parâmetros: `lat`, `lng`, `raio_km`, `tipo` (`PADARIA`, `MERCADO`,
`RESTAURANTE`, `HORTIFRUTI`, `CAFE`, `OUTRO`), `busca`.
```json
[{
  "id_estabelecimento": 1, "nome": "Padaria Dona Flor", "tipo": "PADARIA",
  "descricao": "Pães artesanais, doces e salgados do dia", "endereco": "Rua dos Pinheiros, 450",
  "bairro": "Pinheiros", "cidade": "São Paulo", "latitude": -23.5655, "longitude": -46.6815,
  "foto": "img/lojas/padaria-dona-flor.jpg", "horario_abertura": "06:30", "horario_fechamento": "20:00",
  "distancia_m": 1258, "nota_media": 4.6, "total_avaliacoes": 212,
  "sacolas_disponiveis": 3, "unidades_disponiveis": 15,
  "proximo_inicio": "2026-10-16T18:00:00", "proximo_fim": "2026-10-16T19:30:00"
}]
```

### `GET /api/estabelecimentos/{id}` — página da loja (tela 5.7)
Dados da loja (como acima, mais `telefone` e `uf`), `sacolas` (lista no formato
do catálogo) e `avaliacoes`:
```json
{"...": "...", "sacolas": [], "avaliacoes": [{"nota": 5, "comentario": "...", "data_avaliacao": "2026-10-15T21:15:00", "cliente": "Marina C."}]}
```

---

## 2. Conta

### `POST /api/auth/cadastro` (tela 5.2, aba "Criar conta")
```json
{"nome": "Camila Ferreira", "email": "camila@email.com", "senha": "minhasenha", "telefone": "(11) 90000-0000", "tipo": "COMUM"}
```
`tipo`: `COMUM` (consumidor), `ESTABELECIMENTO` (comerciante) ou `ONG`.
Senha de 6 a 72 caracteres. Resposta 201: `{"token": "...", "conta": {...}}`.
409 se o e-mail já existe.

### `POST /api/auth/login` (tela 5.2, aba "Entrar")
`{"email": "...", "senha": "..."}` → `{"token": "...", "conta": {...}}`. 401 com
"E-mail ou senha incorretos.".

A `conta` (também em `GET /api/auth/eu`):
```json
{
  "id_usuario": 8, "nome": "Flora Mendes", "email": "padaria@refood.test", "telefone": "...",
  "tipo": "ESTABELECIMENTO", "data_cadastro": "2025-02-01T08:00:00",
  "perfil_completo": true, "id_estabelecimento": 1, "id_ong": null,
  "organizacao": "Padaria Dona Flor", "bairro": "Pinheiros", "cidade": "São Paulo", "uf": "SP",
  "pagina_inicial": "/painel/dashboard.html"
}
```
Depois do login, o front vai para `pagina_inicial`. Comerciante e ONG que ainda
não cadastraram a loja/ONG recebem `perfil_completo: false` e
`pagina_inicial: "/completar-cadastro.html"`.

### `GET /api/auth/eu` 🔒
A `conta` do token atual.

---

## 3. Consumidor 🔒 (tipo `COMUM`)

### `GET /api/consumidor/inicio` — tela 5.5
Aceita `lat`, `lng`.
```json
{
  "nome": "Camila",
  "perto": ["até 3 sacolas no formato do catálogo: uma por loja, as de hoje primeiro, da mais perto para a mais longe"],
  "impacto": {
    "kg_salvos": 27.5, "refeicoes": 68, "economia": 446.3, "reservas_concluidas": 12,
    "kg_este_mes": 8.2, "desconto_medio": 64,
    "nivel": {"numero": 3, "nome": "Raiz Forte", "progresso": 83, "falta_kg": 2.5, "proximo": "Floresta"}
  },
  "lojas_frequentes": [{"id_estabelecimento": 2, "nome": "Mercado Sabor da Terra", "descricao": "...", "foto": "...", "bairro": "Pinheiros", "compras": 2, "sacolas_disponiveis": 2}]
}
```
Níveis: Semente (0 kg), Broto (5 kg), Raiz Forte (15 kg), Floresta (30 kg).
Refeições = kg ÷ 0,4 (uma refeição ≈ 400 g).

### `GET /api/consumidor/perfil` — tela 6.6
`{"nome", "email", "telefone", "membro_desde", "impacto": {...igual acima}}`

### `POST /api/reservas` — tela 6.3 (Confirmar reserva)
```json
{"id_alimento": 1, "quantidade": 1, "forma_pagamento": "PIX"}
```
`quantidade` de 1 a 5; `forma_pagamento`: `PIX` ou `CARTAO` (simulado, nada é
cobrado). Resposta 201: a reserva completa (formato abaixo), com o
`codigo_retirada`. 409 se esgotou ou passou do horário.

### `GET /api/reservas` — tela 6.5 (Meus pedidos)
Filtro opcional `status` (`PENDENTE`, `RETIRADA`, `CANCELADA`, `NAO_COMPARECEU`).
```json
{
  "contagem": {"PENDENTE": 2, "RETIRADA": 12, "NAO_COMPARECEU": 1},
  "itens": [{
    "id_reserva": 1, "codigo_retirada": "RF-24098", "status": "PENDENTE", "quantidade": 1,
    "valor_pago": 11.9, "forma_pagamento": "CARTAO", "data_reserva": "...",
    "data_limite_retirada": "2026-10-16T19:30:00", "data_retirada": null,
    "id_alimento": 1, "sacola": "Sacola surpresa da padaria", "descricao": "...", "foto": "img/...",
    "inicio_retirada": "...", "fim_retirada": "...", "preco_original": 32.0, "preco": 11.9, "peso_estimado_kg": 1.2,
    "id_estabelecimento": 1, "estabelecimento": "Padaria Dona Flor", "endereco": "...", "bairro": "...",
    "cidade": "...", "latitude": -23.5655, "longitude": -46.6815, "telefone": "...",
    "avaliada": false, "nota": null
  }]
}
```

### `GET /api/reservas/{id}` — tela 6.4 (Reserva confirmada)
Uma reserva no formato acima. O QR Code é gerado no front a partir do `codigo_retirada`.

### `POST /api/reservas/{id}/cancelar`
Só reservas `PENDENTE`. Devolve a reserva com `status: "CANCELADA"`; as sacolas voltam ao estoque.

### `POST /api/reservas/{id}/avaliar` — "Avaliar pedido"
`{"nota": 5, "comentario": "opcional"}`. Só reservas `RETIRADA`, uma vez cada.

---

## 4. Comerciante 🔒 (tipo `ESTABELECIMENTO`) — "Refood Parcerias"

Se a loja ainda não foi cadastrada, todas as rotas abaixo (menos o `POST` da loja) devolvem **428**.

### `POST /api/painel/estabelecimento` — completar cadastro
```json
{
  "nome": "Padaria Dona Flor", "cnpj": "00.000.001/0001-01", "telefone": "(11) 3000-2001",
  "tipo": "PADARIA", "descricao": "Pães artesanais, doces e salgados do dia",
  "endereco": "Rua dos Pinheiros, 450", "bairro": "Pinheiros", "cidade": "São Paulo", "uf": "SP",
  "cep": "05422-000", "latitude": -23.5655, "longitude": -46.6815,
  "horario_abertura": "06:30", "horario_fechamento": "20:00"
}
```
`latitude` e `longitude` vêm do pino que o usuário posiciona no mapa.
### `GET /api/painel/estabelecimento` · `PUT /api/painel/estabelecimento`
Lê e edita a loja (mesmo corpo do POST).

### `GET /api/painel/resumo` — tela 5.6 (Dashboard)
```json
{
  "loja": {"id_estabelecimento": 1, "nome": "Padaria Dona Flor", "bairro": "Pinheiros", "cidade": "São Paulo", "foto": "...", "...": "..."},
  "sacolas_ativas": 4, "reservas_pendentes": 4, "vendidas_hoje": 5, "receita_mes": 1909.8,
  "vendas_7_dias": [{"dia": "2026-10-10", "rotulo": "Sáb", "quantidade": 14}],
  "ultimas_reservas": [{"id_reserva": 4, "codigo_retirada": "RF-24076", "status": "PENDENTE", "quantidade": 2,
                        "data_reserva": "...", "data_limite_retirada": "...", "data_retirada": null,
                        "sacola": "Croissants do Dia", "cliente": "João A."}]
}
```

### `GET /api/painel/sacolas` — lista da aba "Sacolas"
`periodo=ativas` (padrão: rascunhos e as que ainda estão no horário) ou `todas` (30 dias).
```json
[{"id_alimento": 13, "nome": "...", "descricao": "...", "id_categoria": 1, "categoria": "...",
  "quantidade": 6, "quantidade_inicial": 6, "reservadas": 0, "preco_original": 32.0, "preco": 11.9,
  "desconto": 63, "peso_estimado_kg": 1.2, "foto": "...", "validade": "...", "inicio_retirada": "...",
  "fim_retirada": "...", "status": "DISPONIVEL", "data_cadastro": "...", "reservas_pendentes": 0}]
```

### `POST /api/painel/sacolas` — tela 6.7 (Cadastrar sacola)
```json
{
  "nome": "Sacola Mista — Doce & Salgado", "id_categoria": 1,
  "descricao": "Pães artesanais, salgados assados e doces do dia",
  "preco_original": 38.0, "preco": 12.9, "quantidade": 8, "peso_estimado_kg": 1.5,
  "data": "2026-10-17", "inicio_retirada": "18:00", "fim_retirada": "19:30",
  "rascunho": false
}
```
`rascunho: true` = botão "Salvar como rascunho". Opcionais: `validade` (data e
hora; padrão 23:59 do dia da retirada) e `foto` (padrão é a foto da categoria;
se vier, precisa ser uma imagem do site, como `img/categorias/doces.jpg`). Regras: preço Refood ≤ preço original; fim depois do início; para
publicar, o fim precisa estar no futuro. Desconto recomendado na tela: 50% a 70%.

### `PUT /api/painel/sacolas/{id}` — editar
Mesmo corpo. `quantidade` é quantas ainda ficam disponíveis (as já reservadas
não contam). Não edita sacola `VENCIDO` ou `INDISPONIVEL`.

### `POST /api/painel/sacolas/{id}/publicar` · `POST /api/painel/sacolas/{id}/remover`
Rascunho → no ar; no ar → fora do catálogo (as reservas já feitas continuam valendo).

### `GET /api/painel/reservas` — tela 6.8 (Gestão de pedidos)
`periodo`: `hoje` (padrão), `semana`, `mes`. Filtro `status` opcional.
```json
{
  "aguardando": 4, "retirados_hoje": 1, "valor_em_reservas": 54.5,
  "itens": [{"id_reserva": 1, "codigo_retirada": "RF-24098", "status": "PENDENTE", "quantidade": 1,
             "valor_pago": 11.9, "data_reserva": "...", "data_limite_retirada": "...", "data_retirada": null,
             "id_alimento": 1, "sacola": "...", "inicio_retirada": "...", "fim_retirada": "...", "cliente": "Camila F."}]
}
```

### `POST /api/painel/reservas/confirmar-retirada` — "Inserir código manualmente"
`{"codigo": "RF-24098"}` (aceita também `24098` ou `#rf-24098`).
```json
{"mensagem": "Retirada confirmada: 1x Sacola surpresa da padaria para Camila F.", "reserva": {"id_reserva": 1, "status": "RETIRADA", "...": "..."}}
```
404 se o código não é da loja; 409 se já foi retirada, cancelada ou expirou.

### `GET /api/painel/relatorios` — tela 6.9
`dias` de 7 a 90 (padrão 30).
```json
{
  "dias": 30, "receita": 3154.6, "variacao_receita": 1.2, "sacolas_vendidas": 284,
  "kg_salvos": 328.7, "kg_doados": 55.7, "refeicoes": 821, "aproveitamento": 74,
  "nota_media": 4.6, "total_avaliacoes": 212,
  "receita_diaria": [{"dia": "2026-09-17", "valor": 64.5}],
  "vendas_por_categoria": [{"categoria": "Padaria e confeitaria", "quantidade": 179, "percentual": 63}],
  "avaliacoes_recentes": [{"nota": 5, "comentario": "...", "data_avaliacao": "...", "cliente": "Marina C."}]
}
```
`variacao_receita` (%) compara com os `dias` anteriores; `null` se não há base.
`aproveitamento` (%) = sacolas vendidas ÷ oferecidas.

### `GET /api/painel/previsao` — IA (card "Previsão de sobras")
```json
{
  "suficiente": true,
  "aviso": "Estimativa feita por um modelo estatístico com o histórico da plataforma. Use como referência, não como garantia.",
  "modelo": {"tipo": "Regressão linear (scikit-learn)", "amostras": 1016, "r2": 0.62, "erro_medio_pontos": 7.4},
  "dias": [{"data": "2026-10-17", "dia_semana": "sábado", "sacolas": 0.9, "kg": 1.1,
            "por_categoria": [{"categoria": "Padaria e confeitaria", "oferta_media": 9.2, "taxa_sobra": 8, "sacolas": 0.7, "kg": 1.0}]}],
  "maior_sobra": {"data": "2026-10-20", "dia_semana": "terça-feira", "sacolas": 5.4},
  "sugestao": "Na terça-feira (20/10) devem sobrar cerca de 5 sacolas, principalmente de padaria e confeitaria. ..."
}
```
Se `suficiente` for `false`, mostrar só o `aviso`. Os 7 dias começam amanhã.

### Doações do comerciante (sem tela no Figma; ver docs/DECISOES.md)

| Rota | O que faz |
|---|---|
| `GET /api/painel/doacoes/ofertas` | ofertas da loja: `id_oferta, tipo_alimento, quantidade_kg` (ainda disponível), `disponivel_ate, observacoes, status, data_cadastro, kg_pedidos, pedidos_pendentes` |
| `POST /api/painel/doacoes/ofertas` | `{"tipo_alimento": "Pães e doces", "quantidade_kg": 8, "disponivel_ate": "2026-10-16T21:00:00", "observacoes": "opcional"}` |
| `POST /api/painel/doacoes/ofertas/{id}/encerrar` | tira a oferta do mapa |
| `GET /api/painel/doacoes/solicitacoes` | pedidos das ONGs (`status` opcional): `id_doacao, status, quantidade_kg, data_retirada, observacoes, data_solicitacao, id_oferta, tipo_alimento, ong, telefone, responsavel, bairro, refeicoes` |
| `POST /api/painel/doacoes/solicitacoes/{id}/confirmar` | PENDENTE → CONFIRMADA |
| `POST /api/painel/doacoes/solicitacoes/{id}/recusar` | PENDENTE ou CONFIRMADA → RECUSADA (os kg voltam para a oferta) |
| `POST /api/painel/doacoes/solicitacoes/{id}/entregar` | CONFIRMADA → RECEBIDA (a ONG buscou) |

---

## 5. ONG 🔒 (tipo `ONG`)

Sem o cadastro da ONG, as rotas abaixo (menos o `POST /perfil`) devolvem **428**.

### `POST /api/ong/perfil` — completar cadastro · `GET`/`PUT /api/ong/perfil`
```json
{"nome": "Instituto Mesa Cheia", "cnpj": "00.000.101/0001-11", "telefone": "(11) 90000-7710",
 "responsavel": "Juliana Martins", "endereco": "Rua Henrique Schaumann, 200", "bairro": "Pinheiros",
 "cidade": "São Paulo", "uf": "SP", "cep": "05413-000", "latitude": -23.5579, "longitude": -46.677}
```

### `GET /api/ong/ofertas` — tela 6.10 (Mapa de doações)
Parâmetros: `raio_km`, `tipo` (tipo da loja), `busca`. A distância é medida a partir da ONG.
```json
{
  "ong": {"id_ong": 1, "nome": "Instituto Mesa Cheia", "latitude": -23.5579, "longitude": -46.677, "...": "..."},
  "itens": [{"id_oferta": 1, "tipo_alimento": "Frutas, legumes e verduras", "quantidade_kg": 12.0,
             "disponivel_ate": "2026-10-16T21:00:00", "observacoes": "...",
             "id_estabelecimento": 2, "estabelecimento": "Mercado Sabor da Terra", "tipo_estabelecimento": "HORTIFRUTI",
             "endereco": "Rua Fradique Coutinho, 328", "bairro": "Pinheiros", "latitude": -23.5626, "longitude": -46.6862,
             "foto": "img/lojas/mercado-sabor-da-terra.jpg", "telefone": "...", "distancia_m": 1213, "nota_media": 4.6,
             "refeicoes": 30}]
}
```

### `POST /api/ong/solicitacoes` — tela 6.11 (Enviar solicitação)
```json
{"id_oferta": 1, "quantidade_kg": 12, "data_retirada": "2026-10-16T19:30:00", "observacoes": "Iremos com veículo refrigerado."}
```
`data_retirada` entre agora e o `disponivel_ate` da oferta. 409 se a oferta não
tem tantos kg. Resposta 201: a solicitação (formato abaixo).

### `GET /api/ong/solicitacoes` — tela 6.12 e pedidos em andamento
Filtros: `status`, `mes` (`2026-09`; conta a data em que a doação foi recebida ou, se ainda não foi, a data marcada para a retirada, o mesmo critério do resumo), `busca` (loja ou tipo de alimento).
```json
[{"id_doacao": 2, "status": "CONFIRMADA", "quantidade_kg": 5.0, "data_retirada": "...", "observacoes": "...",
  "data_solicitacao": "...", "data_resposta": "...", "data_recebimento": null,
  "id_oferta": 3, "tipo_alimento": "Refeições prontas", "id_estabelecimento": 3, "estabelecimento": "Restaurante Raízes",
  "tipo_estabelecimento": "RESTAURANTE", "endereco": "...", "bairro": "...", "cidade": "São Paulo", "uf": "SP",
  "latitude": -23.5668, "longitude": -46.6852, "telefone": "...", "foto": "...", "refeicoes": 12}]
```

### `POST /api/ong/solicitacoes/{id}/cancelar`
Só `PENDENTE` ou `CONFIRMADA`; os kg voltam para a oferta.

### `GET /api/ong/resumo` — os três números da tela 6.12
`mes` opcional (`2026-09`; padrão o atual).
```json
{"mes": "2026-10", "recebido_kg": 256.9, "variacao_percentual": 67, "doacoes_concluidas": 24,
 "parceiros": 7, "refeicoes_estimadas": 642, "pedidos_em_andamento": 1}
```
No mês corrente, a variação compara com os mesmos dias do mês anterior.
