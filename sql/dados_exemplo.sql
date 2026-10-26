-- =====================================================================
-- Refood: dados de exemplo
--
-- Rode DEPOIS do schema.sql. Cria as contas de demonstração, as lojas
-- de Pinheiros (São Paulo) que aparecem no Figma e as sacolas de HOJE e
-- de AMANHÃ, sempre relativas à data em que o arquivo é executado.
--
-- O histórico das últimas semanas (vendas, avaliações, doações recebidas)
-- vem do script scripts/gerar_historico.py.
--
-- Todas as contas usam a senha: refood123
-- =====================================================================

USE refood;

SET @senha = '$2b$10$As2I6lFsVt8u3OgdFMpztO4nagQnUcc1nD1HzNGvl37wzxJ6nqRIW';
SET @hoje = CURDATE();
SET @amanha = CURDATE() + INTERVAL 1 DAY;

-- ---------------------------------------------------------------------
-- Usuários (o domínio .test é reservado para testes e nunca recebe e-mail)
-- ---------------------------------------------------------------------
INSERT INTO usuarios (id_usuario, nome, email, senha_hash, telefone, tipo_usuario, data_cadastro) VALUES
 (1,  'Camila Ferreira',   'camila@refood.test',     @senha, '(11) 90000-1001', 'COMUM', '2025-03-12 10:00:00'),
 (2,  'Lucas Rocha',       'lucas@refood.test',      @senha, '(11) 90000-1002', 'COMUM', '2025-06-02 09:00:00'),
 (3,  'Mariana Costa',     'mariana@refood.test',    @senha, '(11) 90000-1003', 'COMUM', '2025-08-20 18:30:00'),
 (4,  'João Pedro Alves',  'joao@refood.test',       @senha, '(11) 90000-1004', 'COMUM', '2026-01-15 12:00:00'),
 (5,  'Ana Beatriz Souza', 'ana@refood.test',        @senha, '(11) 90000-1005', 'COMUM', '2026-02-03 08:45:00'),
 (6,  'Rafael Souza',      'rafael@refood.test',     @senha, '(11) 90000-1006', 'COMUM', '2026-04-11 19:10:00'),
 (7,  'Bianca Lima',       'bianca@refood.test',     @senha, '(11) 90000-1007', 'COMUM', '2026-05-27 14:20:00'),
 (8,  'Flora Mendes',      'padaria@refood.test',    @senha, '(11) 90000-2001', 'ESTABELECIMENTO', '2025-02-01 08:00:00'),
 (9,  'Sérgio Tavares',    'mercado@refood.test',    @senha, '(11) 90000-2002', 'ESTABELECIMENTO', '2025-02-10 08:00:00'),
 (10, 'Helena Duarte',     'raizes@refood.test',     @senha, '(11) 90000-2003', 'ESTABELECIMENTO', '2025-03-05 08:00:00'),
 (11, 'Tiago Moreira',     'verdevida@refood.test',  @senha, '(11) 90000-2004', 'ESTABELECIMENTO', '2025-04-18 08:00:00'),
 (12, 'Cláudia Prado',     'saborecia@refood.test',  @senha, '(11) 90000-2005', 'ESTABELECIMENTO', '2025-05-22 08:00:00'),
 (13, 'Marcos Lima',       'economico@refood.test',  @senha, '(11) 90000-2006', 'ESTABELECIMENTO', '2025-07-09 08:00:00'),
 (14, 'Rosa Andrade',      'cafe@refood.test',       @senha, '(11) 90000-2007', 'ESTABELECIMENTO', '2025-09-30 08:00:00'),
 (15, 'Juliana Martins',   'ong@refood.test',        @senha, '(11) 90000-3001', 'ONG', '2025-04-02 08:00:00'),
 (16, 'Paulo Nunes',       'sopao@refood.test',      @senha, '(11) 90000-3002', 'ONG', '2025-10-14 08:00:00');

-- ---------------------------------------------------------------------
-- Categorias das sacolas
-- ---------------------------------------------------------------------
INSERT INTO categorias (id_categoria, nome, descricao, imagem) VALUES
 (1, 'Padaria e confeitaria', 'Pães, bolos e salgados assados no dia',      'img/categorias/padaria.jpg'),
 (2, 'Doces e sobremesas',    'Croissants, tortas, bolos e doces finos',     'img/categorias/doces.jpg'),
 (3, 'Hortifruti',            'Frutas, legumes e verduras',                  'img/categorias/hortifruti.jpg'),
 (4, 'Refeições',             'Pratos prontos, marmitas, caldos e sopas',    'img/categorias/refeicoes.jpg'),
 (5, 'Laticínios',            'Queijos, iogurtes e frios',                   'img/categorias/laticinios.jpg'),
 (6, 'Mercearia',             'Itens de despensa próximos da validade',      'img/categorias/mercearia.jpg');

-- ---------------------------------------------------------------------
-- Estabelecimentos (CNPJs fictícios, começando com 00.000.00)
-- ---------------------------------------------------------------------
INSERT INTO estabelecimentos (id_estabelecimento, id_usuario, nome, cnpj, telefone, tipo, descricao,
        endereco, bairro, cidade, uf, cep, latitude, longitude, horario_abertura, horario_fechamento, foto) VALUES
 (1, 8,  'Padaria Dona Flor',      '00.000.001/0001-01', '(11) 3000-2001', 'PADARIA',     'Pães artesanais, doces e salgados do dia',
     'Rua dos Pinheiros, 450',      'Pinheiros', 'São Paulo', 'SP', '05422-000', -23.565500, -46.681500, '06:30', '20:00', 'img/lojas/padaria-dona-flor.jpg'),
 (2, 9,  'Mercado Sabor da Terra', '00.000.002/0001-02', '(11) 3000-2002', 'HORTIFRUTI',  'Hortifruti e mercearia de bairro',
     'Rua Fradique Coutinho, 328',  'Pinheiros', 'São Paulo', 'SP', '05416-000', -23.562600, -46.686200, '07:00', '21:00', 'img/lojas/mercado-sabor-da-terra.jpg'),
 (3, 10, 'Restaurante Raízes',     '00.000.003/0001-03', '(11) 3000-2003', 'RESTAURANTE', 'Comida brasileira • almoço e janta',
     'Rua dos Pinheiros, 824',      'Pinheiros', 'São Paulo', 'SP', '05422-001', -23.566800, -46.685200, '11:30', '22:00', 'img/lojas/restaurante-raizes.jpg'),
 (4, 11, 'Hortifruti Verde Vida',  '00.000.004/0001-04', '(11) 3000-2004', 'HORTIFRUTI',  'Orgânicos e frutas da estação',
     'Rua Teodoro Sampaio, 1500',   'Pinheiros', 'São Paulo', 'SP', '05406-100', -23.561800, -46.681200, '07:00', '20:00', 'img/lojas/hortifruti-verde-vida.jpg'),
 (5, 12, 'Sabor & Cia Mercearia',  '00.000.005/0001-05', '(11) 3000-2005', 'MERCADO',     'Queijos, frios e mercearia fina',
     'Rua Cardeal Arcoverde, 1200', 'Pinheiros', 'São Paulo', 'SP', '05407-002', -23.560500, -46.688600, '08:00', '20:00', 'img/lojas/sabor-e-cia.jpg'),
 (6, 13, 'Supermercado Econômico', '00.000.006/0001-06', '(11) 3000-2006', 'MERCADO',     'Supermercado de bairro',
     'Rua Butantã, 300',            'Pinheiros', 'São Paulo', 'SP', '05424-000', -23.569800, -46.698500, '07:00', '22:00', 'img/lojas/supermercado-economico.jpg'),
 (7, 14, 'Café Mineiro',           '00.000.007/0001-07', '(11) 3000-2007', 'CAFE',        'Pão de queijo, bolos e café coado',
     'Rua Artur de Azevedo, 900',   'Pinheiros', 'São Paulo', 'SP', '05404-001', -23.560800, -46.676600, '07:00', '19:00', 'img/lojas/cafe-mineiro.jpg');

-- ---------------------------------------------------------------------
-- ONGs
-- ---------------------------------------------------------------------
INSERT INTO ongs (id_ong, id_usuario, nome, cnpj, telefone, responsavel, endereco, bairro, cidade, uf, cep, latitude, longitude) VALUES
 (1, 15, 'Instituto Mesa Cheia',     '00.000.101/0001-11', '(11) 90000-7710', 'Juliana Martins',
     'Rua Henrique Schaumann, 200', 'Pinheiros', 'São Paulo', 'SP', '05413-000', -23.557900, -46.677000),
 (2, 16, 'Projeto Sopão Pinheiros',  '00.000.102/0001-12', '(11) 90000-7720', 'Paulo Nunes',
     'Rua Mateus Grou, 100',        'Pinheiros', 'São Paulo', 'SP', '05415-050', -23.566900, -46.689900);

-- ---------------------------------------------------------------------
-- Sacolas de hoje e de amanhã
-- (id, loja, categoria, nome, descrição, disponível, inicial, preço original, preço, kg, foto, validade, início, fim, status)
-- ---------------------------------------------------------------------
INSERT INTO alimentos (id_alimento, id_estabelecimento, id_categoria, nome, descricao, quantidade, quantidade_inicial,
        preco_original, preco, peso_estimado_kg, foto, validade, inicio_retirada, fim_retirada, status) VALUES
 (1,  1, 1, 'Sacola surpresa da padaria', 'Uma seleção especial de pães artesanais, doces e salgados frescos preparados no dia. 4 a 6 itens.',
         4, 6, 32.00, 11.90, 1.20, 'img/categorias/padaria.jpg',
         TIMESTAMP(@hoje, '23:59:00'), TIMESTAMP(@hoje, '18:00:00'), TIMESTAMP(@hoje, '19:30:00'), 'DISPONIVEL'),
 (2,  1, 1, 'Sacola Mista — Doce & Salgado', 'Pães artesanais, salgados assados e doces do dia.',
         7, 8, 38.00, 12.90, 1.50, 'img/categorias/doces.jpg',
         TIMESTAMP(@hoje, '23:59:00'), TIMESTAMP(@hoje, '18:00:00'), TIMESTAMP(@hoje, '19:30:00'), 'DISPONIVEL'),
 (3,  1, 2, 'Croissants do Dia', 'Croissants de manteiga e de chocolate assados pela manhã.',
         4, 6, 24.00, 8.90, 0.60, NULL,
         TIMESTAMP(@hoje, '23:59:00'), TIMESTAMP(@hoje, '19:00:00'), TIMESTAMP(@hoje, '20:00:00'), 'DISPONIVEL'),
 (4,  2, 3, 'Seleção fresca de hortifruti', 'Legumes e verduras da estação, com pequenas imperfeições na aparência. Cerca de 3 kg.',
         4, 6, 45.00, 14.90, 3.00, NULL,
         TIMESTAMP(@amanha, '12:00:00'), TIMESTAMP(@hoje, '17:00:00'), TIMESTAMP(@hoje, '20:00:00'), 'DISPONIVEL'),
 (5,  3, 4, 'Refeição brasileira completa', 'Arroz, feijão, uma proteína do dia e salada, embalados para viagem.',
         3, 5, 39.90, 15.90, 0.80, NULL,
         TIMESTAMP(@hoje, '23:30:00'), TIMESTAMP(@hoje, '20:00:00'), TIMESTAMP(@hoje, '21:00:00'), 'DISPONIVEL'),
 (6,  3, 4, 'Sacola Caldos & Sopas do Dia', 'Dois potes de 500 ml com os caldos e sopas do cardápio de hoje.',
         2, 4, 39.00, 13.50, 1.00, 'img/categorias/sopas.jpg',
         TIMESTAMP(@hoje, '23:59:00'), TIMESTAMP(@hoje, '20:30:00'), TIMESTAMP(@hoje, '21:30:00'), 'DISPONIVEL'),
 (7,  4, 3, 'Cesta de frutas orgânicas', 'Frutas orgânicas maduras, ótimas para consumir em até dois dias.',
         2, 5, 48.00, 17.50, 2.50, 'img/categorias/frutas.jpg',
         TIMESTAMP(@amanha, '20:00:00'), TIMESTAMP(@hoje, '16:00:00'), TIMESTAMP(@hoje, '19:00:00'), 'DISPONIVEL'),
 (8,  4, 3, 'Sacola Mista Orgânica M', 'Mix de folhas, legumes e frutas orgânicas para a semana.',
         4, 6, 45.00, 15.90, 2.20, 'img/categorias/saudavel.jpg',
         TIMESTAMP(@amanha, '20:00:00'), TIMESTAMP(@hoje, '17:00:00'), TIMESTAMP(@hoje, '20:00:00'), 'DISPONIVEL'),
 (9,  5, 5, 'Kit laticínios artesanal', 'Queijos artesanais, iogurte natural e manteiga próximos da validade.',
         3, 4, 55.00, 19.90, 1.20, NULL,
         TIMESTAMP(@amanha, '23:59:00'), TIMESTAMP(@hoje, '18:00:00'), TIMESTAMP(@hoje, '20:00:00'), 'DISPONIVEL'),
 (10, 6, 6, 'Super sacola mercearia básica', 'Arroz, massas, enlatados e biscoitos com validade curta.',
         5, 6, 60.00, 21.90, 3.50, NULL,
         TIMESTAMP(@hoje + INTERVAL 10 DAY, '23:59:00'), TIMESTAMP(@hoje, '19:00:00'), TIMESTAMP(@hoje, '21:00:00'), 'DISPONIVEL'),
 (11, 7, 1, 'Combo Pão de Queijo + Bolo', 'Pães de queijo da última fornada e um bolo caseiro inteiro.',
         3, 5, 28.00, 10.00, 0.90, 'img/categorias/paes-de-queijo.jpg',
         TIMESTAMP(@hoje, '23:59:00'), TIMESTAMP(@hoje, '17:00:00'), TIMESTAMP(@hoje, '19:00:00'), 'DISPONIVEL'),
 (12, 7, 2, 'Sacola Surpresa de Doces', 'Fatias de bolo, cookies e doces mineiros.',
         4, 6, 38.00, 12.90, 0.80, NULL,
         TIMESTAMP(@hoje, '23:59:00'), TIMESTAMP(@hoje, '18:00:00'), TIMESTAMP(@hoje, '19:00:00'), 'DISPONIVEL'),
 -- amanhã: garantem que o catálogo tenha ofertas a qualquer hora do dia
 (13, 1, 1, 'Sacola surpresa da padaria', 'Uma seleção especial de pães artesanais, doces e salgados frescos preparados no dia. 4 a 6 itens.',
         6, 6, 32.00, 11.90, 1.20, 'img/categorias/padaria.jpg',
         TIMESTAMP(@amanha, '23:59:00'), TIMESTAMP(@amanha, '18:00:00'), TIMESTAMP(@amanha, '19:30:00'), 'DISPONIVEL'),
 (14, 2, 3, 'Seleção fresca de hortifruti', 'Legumes e verduras da estação, com pequenas imperfeições na aparência. Cerca de 3 kg.',
         6, 6, 45.00, 14.90, 3.00, NULL,
         TIMESTAMP(@amanha + INTERVAL 1 DAY, '12:00:00'), TIMESTAMP(@amanha, '17:00:00'), TIMESTAMP(@amanha, '20:00:00'), 'DISPONIVEL'),
 (15, 3, 4, 'Sacola Refeição Completa Individual', 'Prato feito do dia com sobremesa, pronto para aquecer.',
         4, 4, 48.00, 15.90, 0.90, NULL,
         TIMESTAMP(@amanha, '23:30:00'), TIMESTAMP(@amanha, '20:00:00'), TIMESTAMP(@amanha, '21:00:00'), 'DISPONIVEL'),
 (16, 5, 5, 'Kit laticínios artesanal', 'Queijos artesanais, iogurte natural e manteiga próximos da validade.',
         4, 4, 55.00, 19.90, 1.20, NULL,
         TIMESTAMP(@amanha + INTERVAL 1 DAY, '23:59:00'), TIMESTAMP(@amanha, '16:00:00'), TIMESTAMP(@amanha, '18:00:00'), 'DISPONIVEL'),
 (17, 6, 6, 'Super sacola mercearia básica', 'Arroz, massas, enlatados e biscoitos com validade curta.',
         6, 6, 60.00, 21.90, 3.50, NULL,
         TIMESTAMP(@hoje + INTERVAL 10 DAY, '23:59:00'), TIMESTAMP(@amanha, '19:00:00'), TIMESTAMP(@amanha, '21:00:00'), 'DISPONIVEL'),
 (18, 7, 1, 'Combo Pão de Queijo + Bolo', 'Pães de queijo da última fornada e um bolo caseiro inteiro.',
         5, 5, 28.00, 10.00, 0.90, 'img/categorias/paes-de-queijo.jpg',
         TIMESTAMP(@amanha, '23:59:00'), TIMESTAMP(@amanha, '17:00:00'), TIMESTAMP(@amanha, '19:00:00'), 'DISPONIVEL'),
 -- rascunho da padaria (aparece só no painel dela)
 (19, 1, 1, 'Sacola de pães integrais', 'Pães integrais e de fermentação natural.',
         5, 5, 30.00, 10.90, 1.00, NULL,
         TIMESTAMP(@amanha, '23:59:00'), TIMESTAMP(@amanha, '18:00:00'), TIMESTAMP(@amanha, '19:30:00'), 'RASCUNHO');

-- A maioria das sacolas foi publicada ontem; só duas são novidade de hoje
-- (a etiqueta "NOVO" do catálogo aparece para sacolas com menos de 24 horas).
UPDATE alimentos SET data_cadastro = NOW() - INTERVAL 26 HOUR
WHERE id_alimento BETWEEN 1 AND 18 AND id_alimento NOT IN (8, 12);

-- ---------------------------------------------------------------------
-- Reservas de hoje, ainda não retiradas (batem com a quantidade das sacolas)
-- ---------------------------------------------------------------------
INSERT INTO reservas (id_usuario, id_alimento, quantidade, valor_pago, forma_pagamento, codigo_retirada, data_reserva, data_limite_retirada, status) VALUES
 (1, 1, 1, 11.90, 'CARTAO', 'RF-24098', NOW() - INTERVAL 2 HOUR,  TIMESTAMP(@hoje, '19:30:00'), 'PENDENTE'),
 (5, 1, 1, 11.90, 'PIX',    'RF-24071', NOW() - INTERVAL 1 HOUR,  TIMESTAMP(@hoje, '19:30:00'), 'PENDENTE'),
 (2, 2, 1, 12.90, 'PIX',    'RF-24087', NOW() - INTERVAL 90 MINUTE, TIMESTAMP(@hoje, '19:30:00'), 'PENDENTE'),
 (4, 3, 2, 17.80, 'CARTAO', 'RF-24076', NOW() - INTERVAL 40 MINUTE, TIMESTAMP(@hoje, '20:00:00'), 'PENDENTE'),
 (3, 4, 2, 29.80, 'PIX',    'RF-24112', NOW() - INTERVAL 3 HOUR,  TIMESTAMP(@hoje, '20:00:00'), 'PENDENTE'),
 (6, 5, 2, 31.80, 'PIX',    'RF-24120', NOW() - INTERVAL 2 HOUR,  TIMESTAMP(@hoje, '21:00:00'), 'PENDENTE'),
 (7, 6, 2, 27.00, 'CARTAO', 'RF-24131', NOW() - INTERVAL 1 HOUR,  TIMESTAMP(@hoje, '21:30:00'), 'PENDENTE'),
 (1, 7, 2, 35.00, 'PIX',    'RF-24140', NOW() - INTERVAL 30 MINUTE, TIMESTAMP(@hoje, '19:00:00'), 'PENDENTE'),
 (2, 7, 1, 17.50, 'PIX',    'RF-24141', NOW() - INTERVAL 25 MINUTE, TIMESTAMP(@hoje, '19:00:00'), 'PENDENTE'),
 (3, 8, 2, 31.80, 'CARTAO', 'RF-24150', NOW() - INTERVAL 4 HOUR,  TIMESTAMP(@hoje, '20:00:00'), 'PENDENTE'),
 (4, 9, 1, 19.90, 'PIX',    'RF-24155', NOW() - INTERVAL 2 HOUR,  TIMESTAMP(@hoje, '20:00:00'), 'PENDENTE'),
 (5, 10, 1, 21.90, 'PIX',   'RF-24160', NOW() - INTERVAL 3 HOUR,  TIMESTAMP(@hoje, '21:00:00'), 'PENDENTE'),
 (6, 11, 2, 20.00, 'CARTAO','RF-24170', NOW() - INTERVAL 5 HOUR,  TIMESTAMP(@hoje, '19:00:00'), 'PENDENTE'),
 (7, 12, 2, 25.80, 'PIX',   'RF-24175', NOW() - INTERVAL 1 HOUR,  TIMESTAMP(@hoje, '19:00:00'), 'PENDENTE');

-- ---------------------------------------------------------------------
-- Ofertas de doação abertas agora
-- ---------------------------------------------------------------------
INSERT INTO ofertas_doacao (id_oferta, id_estabelecimento, tipo_alimento, quantidade_kg, disponivel_ate, observacoes) VALUES
 (1, 2, 'Frutas, legumes e verduras', 12.00, TIMESTAMP(@hoje, '21:00:00'),   'Caixas retornáveis. Trazer veículo para retirada.'),
 (2, 1, 'Pães e doces',                6.00, TIMESTAMP(@hoje, '21:00:00'),   'Pães do dia, embalados em sacos de papel.'),
 (3, 3, 'Refeições prontas',          10.00, TIMESTAMP(@hoje, '22:30:00'),   'Marmitas lacradas. Precisa de caixa térmica.'),
 (4, 6, 'Mercearia seca',             20.00, TIMESTAMP(@amanha, '20:00:00'), 'Arroz, massas e enlatados dentro da validade.'),
 (5, 4, 'Frutas e legumes',           10.00, TIMESTAMP(@amanha, '19:00:00'), NULL);

-- Uma solicitação esperando resposta da padaria e uma já confirmada pelo restaurante
INSERT INTO doacoes (id_oferta, id_ong, quantidade_kg, data_retirada, observacoes, status, data_solicitacao, data_resposta) VALUES
 (2, 2, 4.00, TIMESTAMP(@hoje, '20:30:00'), 'Vamos de carro, com caixas próprias.', 'PENDENTE', NOW() - INTERVAL 20 MINUTE, NULL),
 (3, 1, 5.00, TIMESTAMP(@hoje, '21:30:00'), 'Nossa equipe irá com veículo refrigerado. Podemos realizar a pesagem no local.',
         'CONFIRMADA', NOW() - INTERVAL 2 HOUR, NOW() - INTERVAL 90 MINUTE);
