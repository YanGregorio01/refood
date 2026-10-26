# Decisões do projeto

O grupo não chegou a responder a pauta de 19 perguntas enviada em 07/10
(telas que faltavam, front-end e banco). Para não travar, o sistema foi
construído seguindo a sugestão de cada item. Tudo aqui pode ser mudado: cada
decisão diz onde mexer.

## Telas que faltavam no Figma

| # | Decisão | Onde está |
|---|---|---|
| 1 | Depois de criar a conta, o comerciante cai numa tela "Complete o cadastro da sua loja" (nome, CNPJ, tipo, endereço, horário e um pino no mapa). | `static/completar-cadastro.html`, `POST /api/painel/estabelecimento` |
| 2 | A mesma tela serve para a ONG, com os campos da instituição e o responsável pelas retiradas. | `static/completar-cadastro.html`, `POST /api/ong/perfil` |
| 3 | O comerciante ganhou a aba **Doações** no painel: publica uma oferta ("10 kg de pães até as 21h") e confirma, recusa ou marca como entregue os pedidos das ONGs. | `static/painel/doacoes.html`, `app/rotas/doacoes.py` |
| 4 | A previsão de sobras por IA saiu do projeto: o Dashboard do comerciante mostra só os números da loja, o gráfico da semana e as últimas reservas. | `static/painel/dashboard.html` |

## Front-end

| # | Decisão |
|---|---|
| 5 | HTML, CSS e JavaScript puros, sem framework. As páginas buscam os dados com `fetch()` e recebem JSON. O contrato está em `docs/API.md` e dá para testar tudo em http://127.0.0.1:8000/docs. |
| 6 | Desktop primeiro, com layout responsivo para o celular (as telas 1.x a 4.x do Figma serviram de referência). |
| 7 | Ficaram fora do MVP: favoritos, notificações, formas de pagamento salvas, "7 pessoas visualizaram" e leitura do QR Code pela câmera. O comerciante confirma a retirada digitando o código (RF-12345). Os níveis de impacto do consumidor entraram porque saíram baratos (são só uma conta sobre os kg salvos). |
| 8 | Mapa de verdade com Leaflet + OpenStreetMap (grátis, sem chave). O filtro de 500 m / 1 km / 5 km é calculado no banco com `ST_Distance_Sphere`. |
| 9 | Pagamento (cartão/Pix) e "Continuar com Google" são só visuais. Nada é cobrado. |
| 10 | Foto da sacola: imagem padrão por categoria (o comerciante não faz upload). As fotos vieram do próprio arquivo do Figma. |
| 11 | Gráficos com Chart.js. O back-end entrega os números já somados. |
| 12 | Um repositório só, com uma pasta por frente (`app/`, `static/`, `sql/`, `scripts/`, `docs/`, `tests/`), como estava no plano do grupo (`docs/ETAPAS-E-DIVISAO.md`). |

## Banco de dados (sobre o modelo do Vitor)

As 6 tabelas e os nomes do Vitor foram mantidos. Cada mudança está marcada
com `NOVO` em `sql/schema.sql`.

| # | Decisão | Por quê |
|---|---|---|
| 13 | `tipo_usuario` ganhou `'ONG'` e foi criada a tabela `ongs`. | O cadastro do Figma tem o perfil ONG. |
| 14 | Cada linha de `alimentos` é uma **sacola** do catálogo. Ganhou `preco_original`, `preco`, `peso_estimado_kg`, `foto`, `inicio_retirada`, `fim_retirada`, `quantidade_inicial` e o status `RASCUNHO`. | A tela Cadastrar Sacola pede preço e horário. O peso alimenta o "kg salvos". A `quantidade_inicial` permite ao relatório calcular o aproveitamento (vendidas ÷ oferecidas). |
| 15 | `estabelecimentos` ganhou `tipo`, `descricao`, `bairro`, `uf`, `latitude`, `longitude`, `horario_abertura`, `horario_fechamento` e `foto`. Virou uma loja por usuário (`id_usuario` UNIQUE). | O mapa filtra por distância e por tipo de loja. |
| 16 | `reservas` ganhou `codigo_retirada`, `valor_pago`, `forma_pagamento` e `data_retirada`. | O código RF-24098 da tela de reserva confirmada. |
| 17 | Duas tabelas novas: `ofertas_doacao` (o que a loja tem para doar) e `doacoes` (o pedido da ONG). | Uma tabela só misturaria a oferta com os pedidos de várias ONGs sobre ela. |
| 18 | `categorias` virou tabela de verdade, ligada a `alimentos` por `id_categoria`. | Estava na normalização, mas o código usava texto solto. |
| 19 | `statu` virou `status` nas três tabelas. | Corrigido antes de existir código usando o nome. |

Os status das reservas seguem o modelo do Vitor (`PENDENTE`, `RETIRADA`,
`CANCELADA`, `NAO_COMPARECEU`), que bate com as telas (Reservado, Retirado,
Expirado). A regra RN09 do documento da Sprint 1 fala em "pendente,
confirmada, cancelada, concluída"; vale atualizar o texto da RN09 no documento.

## Outras decisões técnicas

- **SQL escrito à mão (PyMySQL), sem ORM.** Cada consulta da API é um SQL que dá para copiar e rodar no Workbench, o que conversa com a disciplina de Banco de Dados.
- **Reserva com `SELECT ... FOR UPDATE`.** Trava a linha da sacola durante a reserva, para duas pessoas não levarem a última sacola. Há um teste que dispara 6 reservas ao mesmo tempo (`tests/test_reservas.py`).
- **Login com JWT** (token assinado, válido por 12 horas) e senha com **bcrypt**.
- **Status vencidos são atualizados na hora da consulta** (`atualizar_vencidos` em `app/util.py`) em vez de um job agendado. É mais simples de entender e de testar.
- **Nome curto do cliente** ("Camila F.") para a loja e para as avaliações públicas: mostra o suficiente para reconhecer o cliente sem expor o nome completo (LGPD).
- **Histórico simulado.** Um sistema novo não tem passado; `scripts/gerar_historico.py` cria 12 semanas de vendas com padrões conhecidos, para os relatórios e o dashboard terem o que mostrar. A semente é fixa: sempre gera os mesmos dados.
- **E-mails de demonstração em `@refood.test`.** O domínio `.test` é reservado e nunca recebe e-mail de verdade.
