"""Configurações do Refood, lidas do arquivo .env na raiz do projeto.

O .env guarda segredos (senha do banco, chave do JWT) e nunca vai para o
git. O modelo dele, sem os valores reais, é o .env.example.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

RAIZ = Path(__file__).resolve().parent.parent

# load_dotenv não sobrescreve variáveis que já existem no ambiente. É isso
# que permite aos testes trocarem DB_NAME para o banco de teste.
load_dotenv(RAIZ / ".env")

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "refood")

JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_EXPIRA_HORAS = int(os.getenv("JWT_EXPIRA_HORAS", "12"))

if len(JWT_SECRET) < 32:
    raise RuntimeError(
        "Defina JWT_SECRET no arquivo .env com pelo menos 32 caracteres (veja o .env.example)."
    )

# Origens que podem chamar a API de outro endereço, como o Live Server do
# VS Code (porta 5500). Quando o front é servido pelo próprio FastAPI, isso
# nem é usado, porque front e API estão no mesmo endereço.
ORIGENS_PERMITIDAS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
]

# Ponto usado quando o navegador não informa a localização: Largo da Batata,
# no meio de Pinheiros, onde ficam as lojas dos dados de exemplo.
LOCAL_PADRAO = (-23.5672, -46.6937)
