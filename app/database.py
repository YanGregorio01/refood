"""Conexão com o MySQL.

Usamos SQL escrito à mão com a biblioteca PyMySQL, sem ORM, para que cada
consulta da API seja um SQL que dá para copiar e rodar no MySQL Workbench.
"""

import pymysql
from pymysql.cursors import DictCursor

from app import config


def conectar():
    """Abre uma conexão nova. As linhas voltam como dicionários: {"nome": ...}."""
    return pymysql.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        database=config.DB_NAME,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,  # nada é gravado até alguém chamar conn.commit()
    )


def get_db():
    """Dependência do FastAPI: uma conexão por requisição.

    A rota recebe a conexão pronta (conn: Connection = Depends(get_db)) e,
    quando termina, a conexão é fechada aqui. Se a rota der erro antes do
    commit, o rollback desfaz o que ficou pela metade.
    """
    conn = conectar()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def buscar_um(conn, sql, params=None):
    """Roda um SELECT e devolve a primeira linha (ou None)."""
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def buscar_todos(conn, sql, params=None):
    """Roda um SELECT e devolve a lista de linhas."""
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def inserir(conn, sql, params=None):
    """Roda um INSERT e devolve o id gerado pelo AUTO_INCREMENT."""
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.lastrowid


def executar(conn, sql, params=None):
    """Roda um UPDATE ou DELETE e devolve quantas linhas foram afetadas."""
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.rowcount
