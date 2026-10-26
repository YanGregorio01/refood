# Requisitos: onde cada um foi implementado

Os requisitos são os do documento da Sprint 1 (Projeto Integrador 4). Use
esta tabela para mostrar ao professor que cada um saiu do papel, e para achar
o código de cada um.

## Requisitos funcionais

| Requisito | Onde |
|---|---|
| RF01 Cadastro de usuários | `POST /api/auth/cadastro` em `app/rotas/auth.py`; tela `static/login.html` |
| RF02 Login e logout | `POST /api/auth/login` (JWT); o logout apaga o token no navegador (`sair()` em `static/js/api.js`) |
| RF03 Cadastro de estabelecimentos | `POST /api/painel/estabelecimento` em `app/rotas/comerciante.py`; tela `static/completar-cadastro.html` |
| RF04 Cadastrar alimentos (nome, quantidade, categoria, validade, descrição) | `POST /api/painel/sacolas`; tela `static/painel/sacolas.html` |
| RF05 Visualizar alimentos disponíveis | `GET /api/sacolas` em `app/rotas/publico.py`; tela `static/catalogo.html` |
| RF06 Buscar por nome ou categoria | parâmetros `busca` e `categoria` de `GET /api/sacolas` |
| RF07 Filtrar por localização | parâmetro `raio_km` (distância calculada com `ST_Distance_Sphere` no MySQL); telas `static/catalogo.html` e `static/mapa.html` |
| RF08 Informações do estabelecimento | `GET /api/estabelecimentos/{id}`; tela `static/estabelecimento.html` |
| RF09 Reservar um alimento | `POST /api/reservas` em `app/rotas/consumidor.py`; telas `static/sacola.html` e `static/checkout.html` |
| RF10 Atualizar a quantidade disponível | `PUT /api/painel/sacolas/{id}` |
| RF11 Remover ou marcar como indisponível | `POST /api/painel/sacolas/{id}/remover` |
| RF12 Registrar o status da reserva | coluna `reservas.status`; confirmação de retirada em `POST /api/painel/reservas/confirmar-retirada` |
| RF13 Estabelecimento consulta suas reservas e doações | `GET /api/painel/reservas` e `GET /api/painel/doacoes/solicitacoes`; telas `static/painel/pedidos.html` e `static/painel/doacoes.html` |
| RF14 Usuário consulta suas reservas | `GET /api/reservas`; tela `static/pedidos.html` |
| RF16 Resultados em gráficos e indicadores | gráfico da semana e indicadores em `static/painel/dashboard.html`; relatórios em `static/painel/relatorios.html` |

## Regras de negócio

| Regra | Onde |
|---|---|
| RN01 Conta para reservar | `exigir("COMUM")` em `app/rotas/consumidor.py` |
| RN02 Só estabelecimentos cadastrados oferecem alimentos | `minha_loja` em `app/rotas/comerciante.py` (sem loja → 428) |
| RN03 Alimento com nome, quantidade, categoria e validade | classe `Sacola` em `app/esquemas.py` e `NOT NULL` em `sql/schema.sql` |
| RN04 Vencido não é reservável | filtro `SACOLA_DISPONIVEL` em `app/rotas/publico.py` e checagem `no_prazo` na reserva |
| RN05 Quantidade nunca negativa | `CHECK (quantidade >= 0)` no banco e checagem na reserva |
| RN06 Só reserva o que está disponível | `reservar()` em `app/rotas/consumidor.py` |
| RN07 Reserva atualiza a quantidade | mesma função, dentro de uma transação com `SELECT ... FOR UPDATE` |
| RN08 Indisponível quando zera ou é removido | status `RESERVADO` (esgotou) e `INDISPONIVEL` (removido) |
| RN09 Toda reserva tem status | `reservas.status` (ver nota em `docs/DECISOES.md`) |
| RN10 Cada um vê só o que é seu | as consultas filtram por `id_usuario` / `id_estabelecimento`; testado em `tests/test_reservas.py` |
| RN11 Alimento vinculado ao estabelecimento | `alimentos.id_estabelecimento` (chave estrangeira) |
| RN12 Localização do estabelecimento | `estabelecimentos.latitude/longitude` |

## Restrições do sistema

| Restrição | Onde |
|---|---|
| RS02 Acesso por tipo de usuário | `exigir()` em `app/seguranca.py` (403 para o tipo errado) |
| RS03 Só reserva alimento cadastrado e disponível | `reservar()` |
| RS04 Não publica alimento vencido | `cadastrar_sacola()` recusa horário de retirada no passado |
| RS05 Não reserva acima do estoque | `reservar()` (409 "Só restam N sacolas") |
| RS09 Sem transporte/entrega | o sistema só agenda a retirada no local |

## Requisitos não funcionais (principais)

| Requisito | Como |
|---|---|
| RNF02 Consultas otimizadas | índices `idx_alimentos_catalogo`, `idx_reservas_usuario`, `idx_doacoes_ong` em `sql/schema.sql` |
| RNF04 Senhas seguras | bcrypt (`app/seguranca.py`) |
| RNF05 Autenticação | JWT no cabeçalho `Authorization` |
| RNF08 Validar dados | Pydantic (`app/esquemas.py`) + `CHECK` no banco |
| RNF11 Mensagens de erro compreensíveis | erros de validação traduzidos em `app/main.py` |
| RNF18 Responsivo | CSS com breakpoints em `static/css/refood.css` |
| RNF21/RNF30 Integridade | chaves estrangeiras, `UNIQUE`, `CHECK` e transações |
| RNF33/34 Código organizado e documentado | pastas por frente, `docs/API.md`, este arquivo |
| RNF36 Facilitar correção de erros | 33 testes automáticos em `tests/` (`python -m pytest`) |

## Fora do escopo

O grupo tirou do projeto a análise preditiva de excedentes (RF15) e as regras
que dependiam dela (RN13, RN14, RN15, RS08 e RNF28). O Dashboard e os
Relatórios mostram o que já aconteceu na loja, sem previsão.
