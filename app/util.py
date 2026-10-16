"""Funções de apoio usadas por várias rotas."""

import math
import secrets

from app.database import buscar_um, executar

# Uma refeição pesa em média 400 g. É a conta do Figma: 12,4 kg = 31 refeições.
KG_POR_REFEICAO = 0.4

# Níveis de impacto do consumidor (kg de comida salva para chegar em cada um)
NIVEIS = [(0, "Semente"), (5, "Broto"), (15, "Raiz Forte"), (30, "Floresta")]

DIAS_CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]


def distancia_sql(tabela):
    """Trecho de SQL que calcula a distância em metros até um ponto.

    ST_Distance_Sphere é uma função do MySQL que mede a distância na
    superfície da Terra. Recebe POINT(longitude, latitude), nessa ordem.
    Quem usa precisa passar dois parâmetros: longitude e latitude.
    """
    return f"ROUND(ST_Distance_Sphere(POINT({tabela}.longitude, {tabela}.latitude), POINT(%s, %s)))"


# Nome do cliente para mostrar a outras pessoas: "Marina Costa" vira "Marina C.".
# Mostra o suficiente para a loja reconhecer, sem expor o nome completo.
NOME_CURTO_SQL = (
    "CONCAT(SUBSTRING_INDEX({col}, ' ', 1), ' ', LEFT(SUBSTRING_INDEX({col}, ' ', -1), 1), '.')"
)


def nome_curto_sql(coluna):
    return NOME_CURTO_SQL.format(col=coluna)


def refeicoes(kg):
    return math.floor(float(kg or 0) / KG_POR_REFEICAO)


def nivel(kg):
    """Nível de impacto e quanto falta para o próximo."""
    kg = float(kg or 0)
    numero = 1
    for i, (minimo, _) in enumerate(NIVEIS):
        if kg >= minimo:
            numero = i + 1
    _, nome = NIVEIS[numero - 1]
    if numero == len(NIVEIS):
        return {"numero": numero, "nome": nome, "progresso": 100, "falta_kg": 0, "proximo": None}
    inicio, (fim, proximo) = NIVEIS[numero - 1][0], NIVEIS[numero]
    return {
        "numero": numero,
        "nome": nome,
        "progresso": round((kg - inicio) / (fim - inicio) * 100),
        "falta_kg": round(fim - kg, 1),
        "proximo": proximo,
    }


def atualizar_vencidos(conn):
    """Marca o que passou do horário (chamado no começo das consultas do painel).

    - sacola disponível cujo horário de retirada acabou vira VENCIDO;
    - reserva pendente cujo prazo acabou vira NAO_COMPARECEU;
    - oferta de doação cujo prazo acabou vira ENCERRADA.
    """
    executar(conn, "UPDATE alimentos SET status = 'VENCIDO' "
                   "WHERE status = 'DISPONIVEL' AND fim_retirada <= NOW()")
    executar(conn, "UPDATE reservas SET status = 'NAO_COMPARECEU' "
                   "WHERE status = 'PENDENTE' AND data_limite_retirada <= NOW()")
    executar(conn, "UPDATE ofertas_doacao SET status = 'ENCERRADA' "
                   "WHERE status = 'ATIVA' AND disponivel_ate <= NOW()")
    conn.commit()


def novo_codigo_retirada(conn):
    """Código curto e imprevisível para mostrar na retirada, como RF-48213."""
    while True:
        codigo = f"RF-{secrets.randbelow(90000) + 10000}"
        if not buscar_um(conn, "SELECT 1 AS existe FROM reservas WHERE codigo_retirada = %s", (codigo,)):
            return codigo


def primeiro_dia_do_mes_sql():
    """Primeiro dia do mês atual, sem usar '%' (que o PyMySQL usa para parâmetros)."""
    return "(CURDATE() - INTERVAL (DAYOFMONTH(CURDATE()) - 1) DAY)"
