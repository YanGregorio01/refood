"""Funções de apoio."""

from app.util import nivel, refeicoes
from scripts.preparar_banco import dividir_comandos


def test_nivel_e_refeicoes():
    assert refeicoes(12.4) == 31            # a conta do Figma: 12,4 kg = 31 refeições
    assert refeicoes(1.2) == 3              # sem o erro de ponto flutuante (1.2 / 0.4 = 2.999...)
    assert nivel(0)["nome"] == "Semente"
    assert nivel(18.6) == {"numero": 3, "nome": "Raiz Forte", "progresso": 24, "falta_kg": 11.4, "proximo": "Floresta"}
    assert nivel(99)["proximo"] is None


def test_divisor_de_sql_ignora_ponto_e_virgula_em_texto_e_comentario():
    sql = "INSERT INTO t VALUES ('a;b'); -- comentário com 'aspas' e ;\nSELECT 1;"
    assert dividir_comandos(sql) == ["INSERT INTO t VALUES ('a;b')", "SELECT 1"]
