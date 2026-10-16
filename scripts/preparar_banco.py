"""Cria (ou recria) o banco do Refood com dados de exemplo.

Uso, na raiz do projeto, com o venv ativo:

    python -m scripts.preparar_banco            # banco do .env (DB_NAME)
    python -m scripts.preparar_banco --sem-historico

Passos: roda sql/schema.sql, depois sql/dados_exemplo.sql e por fim gera o
histórico das últimas 12 semanas (ia/gerar_historico.py), que alimenta os
relatórios e a IA. ATENÇÃO: apaga tudo o que estiver no banco.
"""

import sys
from pathlib import Path

import pymysql

from app import config

PASTA_SQL = Path(__file__).resolve().parent.parent / "sql"


def dividir_comandos(texto):
    """Separa um arquivo .sql em comandos, cortando nos ';' fora de aspas."""
    comandos, atual, aspas = [], [], None
    for linha in texto.splitlines():
        for i, ch in enumerate(linha):
            if aspas:
                if ch == aspas:
                    aspas = None
            elif linha.startswith("--", i):
                break  # comentário até o fim da linha
            elif ch in ("'", '"'):
                aspas = ch
            elif ch == ";":
                comando = "".join(atual).strip()
                if comando:
                    comandos.append(comando)
                atual = []
                continue
            atual.append(ch)
        atual.append("\n")
    resto = "".join(atual).strip()
    if resto:
        comandos.append(resto)
    return comandos


def rodar_arquivo(conn, nome_arquivo, nome_banco):
    """Executa um .sql da pasta sql/ dentro do banco indicado.

    Os arquivos foram escritos para o banco "refood" (para rodar direto no
    Workbench). Aqui ignoramos o DROP/CREATE/USE deles para poder usar o
    mesmo arquivo no banco de teste.
    """
    texto = (PASTA_SQL / nome_arquivo).read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(f"USE `{nome_banco}`")
        for comando in dividir_comandos(texto):
            inicio = comando.upper().split(None, 2)[:2]
            if inicio[:1] == ["USE"] or inicio in (["DROP", "DATABASE"], ["CREATE", "DATABASE"]):
                continue
            cur.execute(comando)
    conn.commit()


def preparar(nome_banco=None, com_historico=True):
    nome_banco = nome_banco or config.DB_NAME
    conn = pymysql.connect(
        host=config.DB_HOST, port=config.DB_PORT, user=config.DB_USER,
        password=config.DB_PASSWORD, charset="utf8mb4",
    )
    try:
        with conn.cursor() as cur:
            cur.execute(f"DROP DATABASE IF EXISTS `{nome_banco}`")
            cur.execute(
                f"CREATE DATABASE `{nome_banco}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
            )
        rodar_arquivo(conn, "schema.sql", nome_banco)
        rodar_arquivo(conn, "dados_exemplo.sql", nome_banco)
    finally:
        conn.close()

    if com_historico:
        from ia.gerar_historico import gerar

        gerar(nome_banco)


if __name__ == "__main__":
    preparar(com_historico="--sem-historico" not in sys.argv)
    print(f"Banco '{config.DB_NAME}' pronto em {config.DB_HOST}:{config.DB_PORT}.")
