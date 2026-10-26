-- =====================================================================
-- Refood: estrutura do banco de dados (MySQL 8)
--
-- Ponto de partida: o modelo do Vitor (entrega parcial 1 de Banco de
-- Dados), com as 6 tabelas usuarios, estabelecimentos, categorias,
-- alimentos, reservas e avaliacoes. As mudanças em relação a ele estão
-- marcadas com "NOVO" e explicadas em docs/DECISOES.md.
--
-- Rodar este arquivo APAGA o banco refood e cria tudo de novo.
-- =====================================================================

DROP DATABASE IF EXISTS refood;
CREATE DATABASE refood CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE refood;

-- ---------------------------------------------------------------------
-- Usuários: todo mundo que faz login. O tipo define o que cada um pode
-- fazer (RS02): COMUM = consumidor, ESTABELECIMENTO = comerciante.
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id_usuario     INT AUTO_INCREMENT PRIMARY KEY,
    nome           VARCHAR(100) NOT NULL,
    email          VARCHAR(150) NOT NULL UNIQUE,
    senha_hash     VARCHAR(255) NOT NULL,              -- bcrypt, nunca a senha (RNF04)
    telefone       VARCHAR(20),
    tipo_usuario   ENUM('COMUM', 'ESTABELECIMENTO', 'ONG') NOT NULL,  -- NOVO: 'ONG'
    data_cadastro  DATETIME DEFAULT CURRENT_TIMESTAMP,
    status         BOOLEAN DEFAULT TRUE                -- NOVO nome: era "statu"
);

-- ---------------------------------------------------------------------
-- Categorias das sacolas. Estava na normalização do Vitor, mas no código
-- a categoria era um texto solto dentro de alimentos.
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
    id_categoria  INT AUTO_INCREMENT PRIMARY KEY,
    nome          VARCHAR(60) NOT NULL UNIQUE,
    descricao     VARCHAR(255),
    imagem        VARCHAR(255)                         -- NOVO: foto padrão da categoria
);

-- ---------------------------------------------------------------------
-- Estabelecimentos: a loja de cada comerciante (um por usuário).
-- ---------------------------------------------------------------------
CREATE TABLE estabelecimentos (
    id_estabelecimento  INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario          INT NOT NULL UNIQUE,           -- NOVO: UNIQUE (uma loja por conta)
    nome                VARCHAR(150) NOT NULL,
    cnpj                VARCHAR(18) UNIQUE,
    telefone            VARCHAR(20),
    tipo                ENUM('PADARIA', 'MERCADO', 'RESTAURANTE', 'HORTIFRUTI', 'CAFE', 'OUTRO')
                        NOT NULL DEFAULT 'OUTRO',      -- NOVO: filtro do mapa
    descricao           VARCHAR(255),                  -- NOVO: "Comida brasileira • almoço e janta"
    endereco            VARCHAR(200) NOT NULL,
    bairro              VARCHAR(100),                  -- NOVO
    cidade              VARCHAR(100) NOT NULL,
    uf                  CHAR(2),                       -- NOVO
    cep                 VARCHAR(10),
    latitude            DECIMAL(9, 6),                 -- NOVO: filtro por distância (RN12)
    longitude           DECIMAL(9, 6),                 -- NOVO
    horario_abertura    TIME,                          -- NOVO: "Aberto hoje • 11h30–22h"
    horario_fechamento  TIME,                          -- NOVO
    foto                VARCHAR(255),                  -- NOVO
    data_cadastro       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
);

-- ---------------------------------------------------------------------
-- ONGs: dados da instituição que recebe doações. NOVO (tabela inteira).
-- ---------------------------------------------------------------------
CREATE TABLE ongs (
    id_ong         INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario     INT NOT NULL UNIQUE,
    nome           VARCHAR(150) NOT NULL,
    cnpj           VARCHAR(18) UNIQUE,
    telefone       VARCHAR(20),
    responsavel    VARCHAR(100),                       -- quem vai buscar as doações
    endereco       VARCHAR(200) NOT NULL,
    bairro         VARCHAR(100),
    cidade         VARCHAR(100) NOT NULL,
    uf             CHAR(2),
    cep            VARCHAR(10),
    latitude       DECIMAL(9, 6),
    longitude      DECIMAL(9, 6),
    data_cadastro  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
);

-- ---------------------------------------------------------------------
-- Alimentos: cada linha é uma SACOLA que o comerciante oferece no
-- catálogo (tela 6.7 Cadastrar Sacola).
-- ---------------------------------------------------------------------
CREATE TABLE alimentos (
    id_alimento         INT AUTO_INCREMENT PRIMARY KEY,
    id_estabelecimento  INT NOT NULL,
    id_categoria        INT NOT NULL,                  -- NOVO: era o texto "categoria"
    nome                VARCHAR(150) NOT NULL,
    descricao           VARCHAR(500),                  -- "Conteúdo estimado"
    quantidade          INT NOT NULL,                  -- quantas sacolas ainda estão disponíveis
    quantidade_inicial  INT NOT NULL,                  -- NOVO: quantas foram oferecidas (o aproveitamento usa)
    preco_original      DECIMAL(8, 2) NOT NULL,        -- NOVO
    preco               DECIMAL(8, 2) NOT NULL,        -- NOVO: "Preço Refood"
    peso_estimado_kg    DECIMAL(5, 2) NOT NULL DEFAULT 1.00,  -- NOVO: alimenta o "kg salvos"
    foto                VARCHAR(255),                  -- NOVO: se vazio, usa a foto da categoria
    validade            DATETIME NOT NULL,             -- até quando o alimento está bom (RN04)
    inicio_retirada     DATETIME NOT NULL,             -- NOVO
    fim_retirada        DATETIME NOT NULL,             -- NOVO
    status              ENUM('RASCUNHO', 'DISPONIVEL', 'RESERVADO', 'INDISPONIVEL', 'VENCIDO')
                        DEFAULT 'DISPONIVEL',          -- NOVO: 'RASCUNHO'; nome era "statu"
    data_cadastro       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_estabelecimento) REFERENCES estabelecimentos (id_estabelecimento),
    FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria),
    CHECK (quantidade >= 0),                           -- RN05
    CHECK (quantidade <= quantidade_inicial),
    CHECK (preco > 0 AND preco <= preco_original),
    CHECK (fim_retirada > inicio_retirada),
    INDEX idx_alimentos_catalogo (status, fim_retirada) -- RNF02: a busca do catálogo usa os dois
);

-- ---------------------------------------------------------------------
-- Reservas: o consumidor garante uma ou mais sacolas e retira no local.
-- Status: PENDENTE = reservada, RETIRADA, CANCELADA, NAO_COMPARECEU.
-- ---------------------------------------------------------------------
CREATE TABLE reservas (
    id_reserva            INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario            INT NOT NULL,
    id_alimento           INT NOT NULL,
    quantidade            INT NOT NULL,
    valor_pago            DECIMAL(8, 2) NOT NULL,      -- NOVO
    forma_pagamento       ENUM('CARTAO', 'PIX') NOT NULL DEFAULT 'PIX',  -- NOVO (pagamento simulado)
    codigo_retirada       VARCHAR(12) NOT NULL UNIQUE, -- NOVO: o "#RF-24098" do QR Code
    data_reserva          DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_limite_retirada  DATETIME NOT NULL,
    data_retirada         DATETIME,                    -- NOVO: quando o comerciante confirmou
    status                ENUM('PENDENTE', 'RETIRADA', 'CANCELADA', 'NAO_COMPARECEU')
                          DEFAULT 'PENDENTE',          -- nome era "statu"
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
    FOREIGN KEY (id_alimento) REFERENCES alimentos (id_alimento),
    CHECK (quantidade > 0),
    INDEX idx_reservas_usuario (id_usuario, status)
);

-- ---------------------------------------------------------------------
-- Avaliações do consumidor sobre o estabelecimento.
-- ---------------------------------------------------------------------
CREATE TABLE avaliacoes (
    id_avaliacao        INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario          INT NOT NULL,
    id_estabelecimento  INT NOT NULL,
    id_reserva          INT UNIQUE,                    -- NOVO: "Avaliar pedido" (uma por reserva)
    nota                INT NOT NULL,
    comentario          VARCHAR(500),
    data_avaliacao      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
    FOREIGN KEY (id_estabelecimento) REFERENCES estabelecimentos (id_estabelecimento),
    FOREIGN KEY (id_reserva) REFERENCES reservas (id_reserva),
    CHECK (nota >= 1 AND nota <= 5)
);

-- ---------------------------------------------------------------------
-- Ofertas de doação: o comerciante avisa que tem alimento para doar
-- ("12 kg disponíveis hoje" na tela 6.10). NOVO (tabela inteira).
-- ---------------------------------------------------------------------
CREATE TABLE ofertas_doacao (
    id_oferta           INT AUTO_INCREMENT PRIMARY KEY,
    id_estabelecimento  INT NOT NULL,
    tipo_alimento       VARCHAR(100) NOT NULL,         -- "Frutas, legumes e verduras"
    quantidade_kg       DECIMAL(6, 2) NOT NULL,        -- quanto ainda pode ser pedido
    disponivel_ate      DATETIME NOT NULL,
    observacoes         VARCHAR(300),
    status              ENUM('ATIVA', 'ENCERRADA') NOT NULL DEFAULT 'ATIVA',
    data_cadastro       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_estabelecimento) REFERENCES estabelecimentos (id_estabelecimento),
    CHECK (quantidade_kg >= 0)
);

-- ---------------------------------------------------------------------
-- Doações: a solicitação que a ONG faz sobre uma oferta (tela 6.11) e
-- que vira o histórico de recebimentos (tela 6.12). NOVO (tabela inteira).
-- ---------------------------------------------------------------------
CREATE TABLE doacoes (
    id_doacao         INT AUTO_INCREMENT PRIMARY KEY,
    id_oferta         INT NOT NULL,
    id_ong            INT NOT NULL,
    quantidade_kg     DECIMAL(6, 2) NOT NULL,
    data_retirada     DATETIME NOT NULL,               -- data e horário preferencial
    observacoes       VARCHAR(500),
    status            ENUM('PENDENTE', 'CONFIRMADA', 'RECUSADA', 'RECEBIDA', 'CANCELADA')
                      NOT NULL DEFAULT 'PENDENTE',
    data_solicitacao  DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_resposta     DATETIME,
    data_recebimento  DATETIME,
    FOREIGN KEY (id_oferta) REFERENCES ofertas_doacao (id_oferta),
    FOREIGN KEY (id_ong) REFERENCES ongs (id_ong),
    CHECK (quantidade_kg > 0),
    INDEX idx_doacoes_ong (id_ong, status)
);
