"""Gera 12 semanas de histórico de uso do Refood.

Um sistema novo não tem passado, mas os relatórios e o dashboard precisam
de dados para mostrar alguma coisa. Este script inventa o histórico de forma
controlada (sempre o mesmo, por causa da semente fixa) e com padrões
reconhecíveis nos gráficos:

- segunda e terça sobram mais sacolas; sexta e sábado sobram menos;
- padaria e doces sobram mais; refeições e mercearia, menos;
- cada loja tem seu jeito (umas vendem melhor que outras);
- a plataforma cresce: semana a semana sobra um pouco menos.

Uso: python -m scripts.gerar_historico (normalmente chamado pelo preparar_banco).
"""

import random
from datetime import date, datetime, time, timedelta

import pymysql

from app import config

SEMENTE = 42
SEMANAS = 12
SENHA_HASH = "$2b$10$As2I6lFsVt8u3OgdFMpztO4nagQnUcc1nD1HzNGvl37wzxJ6nqRIW"  # refood123

# Fração de sacolas que sobra, por dia da semana (0 = segunda)
SOBRA_DIA_SEMANA = {0: 0.42, 1: 0.38, 2: 0.30, 3: 0.24, 4: 0.14, 5: 0.10, 6: 0.28}
# Ajuste por categoria (id da tabela categorias)
AJUSTE_CATEGORIA = {1: 0.08, 2: 0.05, 3: 0.03, 4: -0.06, 5: 0.0, 6: -0.08}
# Ajuste por loja (id da tabela estabelecimentos)
AJUSTE_LOJA = {1: 0.04, 2: 0.0, 3: -0.04, 4: 0.02, 5: 0.05, 6: -0.02, 7: 0.0}

# O que cada loja costuma oferecer:
# (categoria, nome, preço original, preço, kg, início, fim, foto)
MODELOS_POR_LOJA = {
    1: [(1, "Sacola surpresa da padaria", 32.00, 11.90, 1.2, "18:00", "19:30", "img/categorias/padaria.jpg"),
        (2, "Croissants do Dia", 24.00, 8.90, 0.6, "19:00", "20:00", None),
        (1, "Sacola Mista — Doce & Salgado", 38.00, 12.90, 1.5, "18:00", "19:30", "img/categorias/doces.jpg")],
    2: [(3, "Seleção fresca de hortifruti", 45.00, 14.90, 3.0, "17:00", "20:00", None),
        (6, "Sacola de mercearia do bairro", 40.00, 13.90, 2.5, "18:00", "20:00", None)],
    3: [(4, "Refeição brasileira completa", 39.90, 15.90, 0.8, "20:00", "21:00", None),
        (4, "Sacola Caldos & Sopas do Dia", 39.00, 13.50, 1.0, "20:30", "21:30", "img/categorias/sopas.jpg")],
    4: [(3, "Cesta de frutas orgânicas", 48.00, 17.50, 2.5, "16:00", "19:00", "img/categorias/frutas.jpg"),
        (3, "Sacola Mista Orgânica M", 45.00, 15.90, 2.2, "17:00", "20:00", "img/categorias/saudavel.jpg")],
    5: [(5, "Kit laticínios artesanal", 55.00, 19.90, 1.2, "18:00", "20:00", None),
        (5, "Sacola de frios e antepastos", 50.00, 17.90, 1.0, "18:00", "20:00", None)],
    6: [(6, "Super sacola mercearia básica", 60.00, 21.90, 3.5, "19:00", "21:00", None),
        (3, "Sacola de hortifruti do dia", 30.00, 9.90, 2.5, "18:00", "21:00", None)],
    7: [(1, "Combo Pão de Queijo + Bolo", 28.00, 10.00, 0.9, "17:00", "19:00", "img/categorias/paes-de-queijo.jpg"),
        (2, "Sacola Surpresa de Doces", 38.00, 12.90, 0.8, "18:00", "19:00", None)],
}

# Tipo de alimento que cada loja doa e quanto (kg mínimo e máximo)
DOACAO_POR_LOJA = {
    1: ("Pães e doces", 4, 10), 2: ("Frutas, legumes e verduras", 6, 15),
    3: ("Refeições prontas", 8, 20), 4: ("Frutas e legumes", 5, 15),
    5: ("Laticínios", 3, 8), 6: ("Mercearia seca", 10, 25), 7: ("Pães e bolos", 3, 8),
}

PRIMEIROS_NOMES = ["Ana", "Bruno", "Carla", "Diego", "Eduarda", "Felipe", "Gabriela", "Henrique",
                   "Isabela", "Júlio", "Larissa", "Mateus", "Natália", "Otávio", "Patrícia", "Renato",
                   "Sofia", "Thiago", "Vanessa", "Wagner", "Beatriz", "Caio", "Daniela", "Enzo"]
SOBRENOMES = ["Almeida", "Barbosa", "Cardoso", "Dias", "Esteves", "Freitas", "Gomes", "Henriques",
              "Lopes", "Machado", "Nogueira", "Oliveira", "Pereira", "Queiroz", "Ribeiro", "Santos"]

COMENTARIOS = {
    5: ["Pães frescos, ótima variedade e atendimento muito gentil na retirada.",
        "A sacola veio bem recheada e tudo estava delicioso. Voltarei com certeza!",
        "Reserva rápida e retirada organizada. Excelente iniciativa contra o desperdício.",
        "Comida caseira deliciosa e porção muito bem servida.",
        "Ótimo custo-benefício. Veio tudo fresco e bem embalado."],
    4: ["Gostei bastante, só demorou um pouco na retirada.",
        "Boa variedade, alguns itens já estavam no limite.",
        "Vale muito pelo preço."],
    3: ["Veio menos coisa do que eu esperava.", "Ok, mas a retirada atrasou."],
}


def _hora(texto):
    h, m = map(int, texto.split(":"))
    return time(h, m)


def _juntar(dia, hora):
    return datetime.combine(dia, hora)


def gerar(nome_banco=None):
    nome_banco = nome_banco or config.DB_NAME
    rnd = random.Random(SEMENTE)
    conn = pymysql.connect(
        host=config.DB_HOST, port=config.DB_PORT, user=config.DB_USER,
        password=config.DB_PASSWORD, database=nome_banco, charset="utf8mb4",
    )
    cur = conn.cursor()

    # --- 1. consumidores extras, para o histórico não depender de 7 pessoas
    cur.execute("SELECT COALESCE(MAX(id_usuario), 0) FROM usuarios")
    proximo_usuario = cur.fetchone()[0] + 1
    novos_usuarios = []
    for i in range(80):
        nome = f"{rnd.choice(PRIMEIROS_NOMES)} {rnd.choice(SOBRENOMES)}"
        email = f"cliente{i + 1:03d}@refood.test"
        cadastro = datetime.now() - timedelta(days=rnd.randint(100, 500))
        novos_usuarios.append((proximo_usuario + i, nome, email, SENHA_HASH, "COMUM", cadastro))
    cur.executemany(
        "INSERT INTO usuarios (id_usuario, nome, email, senha_hash, tipo_usuario, data_cadastro) "
        "VALUES (%s, %s, %s, %s, %s, %s)", novos_usuarios)
    clientes = [1, 2, 3, 4, 5, 6, 7] + [u[0] for u in novos_usuarios]
    # As contas de demonstração compram de vez em quando (a Camila um pouco
    # mais), para o perfil delas ter uma história de tamanho realista.
    pesos = [0.25, 0.25, 0.25, 0.2, 0.2, 0.2, 0.2] + [1] * len(novos_usuarios)

    # --- 2. próximos ids e códigos já usados
    cur.execute("SELECT COALESCE(MAX(id_alimento), 0) FROM alimentos")
    proximo_alimento = cur.fetchone()[0] + 1
    cur.execute("SELECT COALESCE(MAX(id_reserva), 0) FROM reservas")
    proxima_reserva = cur.fetchone()[0] + 1
    cur.execute("SELECT codigo_retirada FROM reservas")
    codigos_usados = {linha[0] for linha in cur.fetchall()}
    cur.execute("SELECT COALESCE(MAX(id_oferta), 0) FROM ofertas_doacao")
    proxima_oferta = cur.fetchone()[0] + 1

    def novo_codigo():
        while True:
            codigo = f"RF-{rnd.randint(10000, 99999)}"
            if codigo not in codigos_usados:
                codigos_usados.add(codigo)
                return codigo

    alimentos, reservas, avaliacoes, ofertas, doacoes = [], [], [], [], []
    hoje = date.today()
    total_dias = SEMANAS * 7

    for dias_atras in range(total_dias, 0, -1):
        dia = hoje - timedelta(days=dias_atras)
        semana_do_dia = (total_dias - dias_atras) // 7  # 0 = mais antiga
        crescimento = 0.012 * semana_do_dia            # sobra cai com o tempo

        for loja, modelos in MODELOS_POR_LOJA.items():
            if loja == 7 and dia.weekday() == 6:
                continue  # o Café Mineiro fecha aos domingos
            for (cat, nome, preco_orig, preco, kg, ini, fim, foto) in modelos:
                if rnd.random() > 0.8:
                    continue  # nem todo dia a loja oferece todas as sacolas
                inicial = rnd.randint(3, 8)
                taxa = (SOBRA_DIA_SEMANA[dia.weekday()] + AJUSTE_CATEGORIA[cat]
                        + AJUSTE_LOJA[loja] - crescimento + rnd.gauss(0, 0.07))
                taxa = min(max(taxa, 0.0), 0.9)
                vendidas = inicial - round(inicial * taxa)

                inicio, termino = _juntar(dia, _hora(ini)), _juntar(dia, _hora(fim))
                id_alimento = proximo_alimento
                proximo_alimento += 1

                # reservas que consumiram unidades (1 ou 2 sacolas cada)
                restantes = vendidas
                while restantes > 0:
                    qtd = 2 if restantes >= 2 and rnd.random() < 0.25 else 1
                    restantes -= qtd
                    cliente = rnd.choices(clientes, weights=pesos)[0]
                    reservado_em = inicio - timedelta(minutes=rnd.randint(20, 480))
                    sorteio = rnd.random()
                    if sorteio < 0.92:
                        status, retirada = "RETIRADA", inicio + timedelta(
                            minutes=rnd.randint(0, int((termino - inicio).total_seconds() // 60)))
                    else:
                        status, retirada = "NAO_COMPARECEU", None
                    reservas.append((proxima_reserva, cliente, id_alimento, qtd, round(qtd * preco, 2),
                                     rnd.choice(["PIX", "PIX", "CARTAO"]), novo_codigo(),
                                     reservado_em, termino, retirada, status))
                    if status == "RETIRADA" and rnd.random() < 0.35:
                        nota = rnd.choices([5, 4, 3], weights=[70, 24, 6])[0]
                        avaliado_em = min(retirada + timedelta(hours=rnd.randint(1, 30)),
                                          datetime.now() - timedelta(minutes=30))
                        avaliacoes.append((cliente, loja, proxima_reserva, nota,
                                           rnd.choice(COMENTARIOS[nota]), avaliado_em))
                    proxima_reserva += 1

                # reservas canceladas não consomem unidade: a sacola volta ao estoque
                if rnd.random() < 0.06:
                    cliente = rnd.choices(clientes, weights=pesos)[0]
                    reservas.append((proxima_reserva, cliente, id_alimento, 1, preco,
                                     "PIX", novo_codigo(), inicio - timedelta(hours=3),
                                     termino, None, "CANCELADA"))
                    proxima_reserva += 1

                sobra = inicial - vendidas
                status_sacola = "RESERVADO" if sobra == 0 else "VENCIDO"
                alimentos.append((id_alimento, loja, cat, nome, None, sobra, inicial, preco_orig, preco,
                                  kg, foto, _juntar(dia, time(23, 59)), inicio, termino, status_sacola,
                                  inicio - timedelta(hours=rnd.randint(2, 8))))

            # doação do que sobrou no fim do dia
            if rnd.random() < 0.25:
                tipo, kg_min, kg_max = DOACAO_POR_LOJA[loja]
                kg_total = round(rnd.uniform(kg_min, kg_max), 1)
                fim_doacao = _juntar(dia, time(21, 0))
                ong = 1 if rnd.random() < 0.7 else 2
                ofertas.append((proxima_oferta, loja, tipo, 0, fim_doacao, None, "ENCERRADA",
                                _juntar(dia, time(15, 0))))
                retirada_doacao = _juntar(dia, time(rnd.randint(16, 20), rnd.choice([0, 15, 30, 45])))
                doacoes.append((proxima_oferta, ong, kg_total, retirada_doacao, None, "RECEBIDA",
                                _juntar(dia, time(15, 30)), _juntar(dia, time(15, 50)),
                                retirada_doacao + timedelta(minutes=rnd.randint(0, 40))))
                proxima_oferta += 1

    cur.executemany(
        "INSERT INTO alimentos (id_alimento, id_estabelecimento, id_categoria, nome, descricao, quantidade, "
        "quantidade_inicial, preco_original, preco, peso_estimado_kg, foto, validade, inicio_retirada, "
        "fim_retirada, status, data_cadastro) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        alimentos)
    cur.executemany(
        "INSERT INTO reservas (id_reserva, id_usuario, id_alimento, quantidade, valor_pago, forma_pagamento, "
        "codigo_retirada, data_reserva, data_limite_retirada, data_retirada, status) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", reservas)
    cur.executemany(
        "INSERT INTO avaliacoes (id_usuario, id_estabelecimento, id_reserva, nota, comentario, data_avaliacao) "
        "VALUES (%s,%s,%s,%s,%s,%s)", avaliacoes)
    cur.executemany(
        "INSERT INTO ofertas_doacao (id_oferta, id_estabelecimento, tipo_alimento, quantidade_kg, "
        "disponivel_ate, observacoes, status, data_cadastro) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)", ofertas)
    cur.executemany(
        "INSERT INTO doacoes (id_oferta, id_ong, quantidade_kg, data_retirada, observacoes, status, "
        "data_solicitacao, data_resposta, data_recebimento) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)", doacoes)
    conn.commit()
    conn.close()
    print(f"Histórico: {len(alimentos)} sacolas, {len(reservas)} reservas, "
          f"{len(avaliacoes)} avaliações e {len(doacoes)} doações em {SEMANAS} semanas.")


if __name__ == "__main__":
    gerar()
