"""Senhas e login.

Senha: guardamos só o hash bcrypt (RNF04). O bcrypt é lento de propósito e
mistura um "sal" aleatório em cada hash, então dois usuários com a mesma
senha têm hashes diferentes e um vazamento do banco não entrega as senhas.

Login: o servidor devolve um token JWT assinado com a JWT_SECRET. O front
guarda o token e manda em toda requisição no cabeçalho
"Authorization: Bearer <token>". O servidor confere a assinatura e sabe
quem é o usuário sem precisar guardar sessão (RNF05).
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app import config
from app.database import buscar_um, get_db

ALGORITMO = "HS256"
NOMES_TIPO = {"COMUM": "consumidores", "ESTABELECIMENTO": "comerciantes", "ONG": "ONGs"}

_bearer = HTTPBearer(auto_error=False, description="Token devolvido por /api/auth/login")


def gerar_hash(senha: str) -> str:
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def conferir_senha(senha: str, senha_hash: str) -> bool:
    return bcrypt.checkpw(senha.encode("utf-8"), senha_hash.encode("utf-8"))


def criar_token(id_usuario: int, tipo: str) -> str:
    agora = datetime.now(timezone.utc)
    dados = {
        "sub": str(id_usuario),  # "subject": de quem é o token
        "tipo": tipo,
        "iat": agora,
        "exp": agora + timedelta(hours=config.JWT_EXPIRA_HORAS),
    }
    return jwt.encode(dados, config.JWT_SECRET, algorithm=ALGORITMO)


def _nao_autorizado(mensagem):
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=mensagem,
        headers={"WWW-Authenticate": "Bearer"},
    )


def usuario_atual(
    credenciais: HTTPAuthorizationCredentials = Depends(_bearer),
    conn=Depends(get_db),
) -> dict:
    """Dependência das rotas que exigem login: devolve o usuário do token."""
    if credenciais is None:
        raise _nao_autorizado("Faça login para continuar.")
    try:
        dados = jwt.decode(credenciais.credentials, config.JWT_SECRET, algorithms=[ALGORITMO])
    except jwt.ExpiredSignatureError:
        raise _nao_autorizado("Sua sessão expirou. Entre de novo.")
    except jwt.InvalidTokenError:
        raise _nao_autorizado("Sessão inválida. Entre de novo.")

    usuario = buscar_um(
        conn,
        "SELECT id_usuario, nome, email, telefone, tipo_usuario, data_cadastro "
        "FROM usuarios WHERE id_usuario = %s AND status = TRUE",
        (int(dados["sub"]),),
    )
    if usuario is None:
        raise _nao_autorizado("Conta não encontrada. Entre de novo.")
    return usuario


def exigir(*tipos):
    """Cria uma dependência que só deixa passar os tipos de usuário indicados (RS02).

    Uso: usuario = Depends(exigir("ESTABELECIMENTO"))
    """

    def verificar(usuario: dict = Depends(usuario_atual)) -> dict:
        if usuario["tipo_usuario"] not in tipos:
            quem = " e ".join(NOMES_TIPO[t] for t in tipos)
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Esta área é só para {quem}.")
        return usuario

    return verificar
