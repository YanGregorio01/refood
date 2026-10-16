"""IA de previsão de sobras e funções de apoio."""

from app.util import nivel, refeicoes
from scripts.preparar_banco import dividir_comandos


def test_previsao_de_sobras(cliente, padaria):
    p = cliente.get("/api/painel/previsao", headers=padaria).json()
    assert p["suficiente"] is True
    assert len(p["dias"]) == 7
    assert "estimativa" in p["aviso"].lower()               # RN14: estimativa, não garantia
    assert p["modelo"]["amostras"] > 500
    assert p["modelo"]["r2"] > 0.3                           # o modelo explica boa parte da variação


def test_modelo_aprendeu_que_segunda_sobra_mais_que_sabado(cliente, padaria):
    """O histórico foi gerado com mais sobra na segunda; o modelo precisa perceber isso."""
    dias = {d["dia_semana"]: d for d in cliente.get("/api/painel/previsao", headers=padaria).json()["dias"]}

    def taxa_padaria(dia):
        return next(c["taxa_sobra"] for c in dias[dia]["por_categoria"] if c["categoria"] == "Padaria e confeitaria")

    assert taxa_padaria("segunda-feira") > taxa_padaria("sábado")


def test_nivel_e_refeicoes():
    assert refeicoes(12.4) == 31            # a conta do Figma: 12,4 kg = 31 refeições
    assert nivel(0)["nome"] == "Semente"
    assert nivel(18.6) == {"numero": 3, "nome": "Raiz Forte", "progresso": 24, "falta_kg": 11.4, "proximo": "Floresta"}
    assert nivel(99)["proximo"] is None


def test_divisor_de_sql_ignora_ponto_e_virgula_em_texto_e_comentario():
    sql = "INSERT INTO t VALUES ('a;b'); -- comentário com 'aspas' e ;\nSELECT 1;"
    assert dividir_comandos(sql) == ["INSERT INTO t VALUES ('a;b')", "SELECT 1"]
