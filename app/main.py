"""Ponto de entrada da API do Refood.

Para rodar (na raiz do projeto, com o venv ativo):

    uvicorn app.main:app --reload

O site abre em http://127.0.0.1:8000 e a documentação interativa da API,
gerada pelo FastAPI, em http://127.0.0.1:8000/docs.
"""

import mimetypes

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app import config
from app.rotas import auth, comerciante, consumidor, doacoes, ong, publico

# No Windows, o registro às vezes diz que .js é "text/plain", e o navegador
# recusa carregar módulos JavaScript com esse tipo. Aqui fixamos o certo.
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

app = FastAPI(
    title="Refood API",
    description=(
        "API do Refood: conecta estabelecimentos com alimentos excedentes a consumidores e ONGs. "
        "Para testar uma rota protegida, faça login em /api/auth/login, copie o token e clique em "
        "Authorize. Contas de exemplo: camila@refood.test (consumidora), padaria@refood.test "
        "(comerciante) e ong@refood.test (ONG), todas com a senha refood123."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ORIGENS_PERMITIDAS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------- erros em português
MENSAGENS = {
    "missing": "Campo obrigatório.",
    "string_type": "Campo obrigatório.",
    "int_type": "Informe um número inteiro.",
    "float_type": "Informe um número.",
    "decimal_type": "Informe um número.",
    "bool_type": "Informe verdadeiro ou falso.",
    "date_type": "Informe uma data válida.",
    "time_type": "Informe um horário válido.",
    "datetime_type": "Informe data e hora válidas.",
    "model_attributes_type": "Envie os dados em JSON.",
    "dict_type": "Envie os dados em JSON.",
    "string_too_short": "Use pelo menos {min_length} caracteres.",
    "string_too_long": "Use no máximo {max_length} caracteres.",
    "greater_than": "Precisa ser maior que {gt}.",
    "greater_than_equal": "Precisa ser no mínimo {ge}.",
    "less_than": "Precisa ser menor que {lt}.",
    "less_than_equal": "Precisa ser no máximo {le}.",
    "literal_error": "Escolha uma das opções da lista.",
    "int_parsing": "Informe um número inteiro.",
    "float_parsing": "Informe um número.",
    "decimal_parsing": "Informe um número.",
    "decimal_max_places": "Use no máximo {decimal_places} casas decimais.",
    "date_from_datetime_parsing": "Informe uma data válida.",
    "date_parsing": "Informe uma data válida.",
    "time_parsing": "Informe um horário válido.",
    "datetime_parsing": "Informe data e hora válidas.",
    "datetime_from_date_parsing": "Informe data e hora válidas.",
    "bool_parsing": "Informe verdadeiro ou falso.",
    "json_invalid": "Os dados enviados não estão em JSON válido.",
}


def _mensagem(erro):
    if erro["type"] == "value_error":
        return str(erro["ctx"]["error"])  # mensagens que nós mesmos escrevemos nos esquemas
    modelo = MENSAGENS.get(erro["type"])
    if modelo is None:
        return erro["msg"]
    return modelo.format(**{k: v for k, v in (erro.get("ctx") or {}).items()})


@app.exception_handler(RequestValidationError)
async def erro_de_validacao(request: Request, exc: RequestValidationError):
    """Devolve {"detail": "...", "campos": {"preco": "..."}} para o front mostrar."""
    campos = {}
    for erro in exc.errors():
        local = [str(p) for p in erro["loc"] if p not in ("body", "query", "path")]
        campos[".".join(local) or "geral"] = _mensagem(erro)
    if len(campos) == 1:
        detalhe = next(iter(campos.values()))
    else:
        detalhe = "Confira os campos destacados."
    return JSONResponse(status_code=422, content={"detail": detalhe, "campos": campos})


@app.middleware("http")
async def revalidar_arquivos_do_site(request: Request, chamar_proxima):
    """Faz o navegador conferir se o HTML/CSS/JS mudou antes de usar o que guardou.

    Sem isso, depois de uma atualização o navegador pode continuar mostrando o
    CSS antigo. Quando nada mudou, o servidor responde 304 e nada é baixado.
    """
    resposta = await chamar_proxima(request)
    if not request.url.path.startswith("/api"):
        resposta.headers.setdefault("Cache-Control", "no-cache")
    return resposta


# ------------------------------------------------------------- rotas
for modulo in (publico, auth, consumidor, comerciante, doacoes, ong):
    app.include_router(modulo.router)


@app.api_route("/api/{caminho:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
def rota_inexistente(caminho: str):
    return JSONResponse({"detail": f"Rota /api/{caminho} não existe."}, status_code=404)


# O front (pasta static/) é servido pelo próprio FastAPI, no mesmo endereço da
# API. Fica por último para não esconder as rotas acima.
app.mount("/", StaticFiles(directory=config.RAIZ / "static", html=True), name="site")
