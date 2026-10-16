"""Preparação dos testes.

Os testes usam um banco SEPARADO (DB_NAME_TESTE do .env, normalmente
refood_teste), que é apagado e recriado no começo de cada rodada. O banco de
desenvolvimento nunca é tocado.

Rodar: python -m pytest   (na raiz do projeto, com o venv ativo)
"""

import os
from datetime import date, timedelta
from pathlib import Path

from dotenv import dotenv_values

# Isto precisa acontecer ANTES de importar o app, que lê DB_NAME ao carregar.
_env = dotenv_values(Path(__file__).resolve().parent.parent / ".env")
os.environ["DB_NAME"] = os.environ.get("DB_NAME_TESTE") or _env.get("DB_NAME_TESTE") or "refood_teste"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from scripts.preparar_banco import preparar  # noqa: E402

SENHA = "refood123"


@pytest.fixture(scope="session", autouse=True)
def banco_de_teste():
    preparar(os.environ["DB_NAME"], com_historico=True)
    yield


@pytest.fixture(scope="session")
def cliente():
    return TestClient(app)


def login(cliente, email, senha=SENHA):
    resposta = cliente.post("/api/auth/login", json={"email": email, "senha": senha})
    assert resposta.status_code == 200, resposta.text
    return {"Authorization": f"Bearer {resposta.json()['token']}"}


@pytest.fixture(scope="session")
def camila(cliente):
    return login(cliente, "camila@refood.test")


@pytest.fixture(scope="session")
def lucas(cliente):
    return login(cliente, "lucas@refood.test")


@pytest.fixture(scope="session")
def padaria(cliente):
    return login(cliente, "padaria@refood.test")


@pytest.fixture(scope="session")
def mercado(cliente):
    return login(cliente, "mercado@refood.test")


@pytest.fixture(scope="session")
def ong(cliente):
    return login(cliente, "ong@refood.test")


@pytest.fixture
def nova_sacola(cliente, padaria):
    """Cria uma sacola da Padaria Dona Flor para amanhã e devolve o JSON dela."""

    def criar(quantidade=3, **extra):
        corpo = {
            "nome": "Sacola de teste", "id_categoria": 1, "descricao": "Criada pelos testes",
            "preco_original": 30, "preco": 10, "quantidade": quantidade, "peso_estimado_kg": 1.5,
            "data": (date.today() + timedelta(days=1)).isoformat(),
            "inicio_retirada": "18:00", "fim_retirada": "19:30",
        }
        corpo.update(extra)
        resposta = cliente.post("/api/painel/sacolas", headers=padaria, json=corpo)
        assert resposta.status_code == 201, resposta.text
        return resposta.json()

    return criar
