"""Cadastro, login e "quem sou eu" (RF01, RF02)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import buscar_um, get_db, inserir
from app.esquemas import Cadastro, Login
from app.seguranca import conferir_senha, criar_token, gerar_hash, usuario_atual

router = APIRouter(prefix="/api/auth", tags=["Conta"])

# Para onde o front manda cada tipo de usuário depois de entrar
PAGINA_INICIAL = {
    "COMUM": "/inicio.html",
    "ESTABELECIMENTO": "/painel/dashboard.html",
    "ONG": "/ong/mapa.html",
}
PAGINA_COMPLETAR = {
    "ESTABELECIMENTO": "/completar-cadastro.html",
    "ONG": "/completar-cadastro.html",
}


def montar_conta(conn, usuario):
    """Dados da conta que o front guarda depois do login."""
    loja = ong = None
    if usuario["tipo_usuario"] == "ESTABELECIMENTO":
        loja = buscar_um(conn, "SELECT id_estabelecimento, nome FROM estabelecimentos WHERE id_usuario = %s",
                         (usuario["id_usuario"],))
    elif usuario["tipo_usuario"] == "ONG":
        ong = buscar_um(conn, "SELECT id_ong, nome FROM ongs WHERE id_usuario = %s", (usuario["id_usuario"],))

    tipo = usuario["tipo_usuario"]
    completo = tipo == "COMUM" or bool(loja or ong)
    return {
        "id_usuario": usuario["id_usuario"],
        "nome": usuario["nome"],
        "email": usuario["email"],
        "telefone": usuario["telefone"],
        "tipo": tipo,
        "data_cadastro": usuario["data_cadastro"],
        "perfil_completo": completo,
        "id_estabelecimento": loja["id_estabelecimento"] if loja else None,
        "id_ong": ong["id_ong"] if ong else None,
        "organizacao": (loja or ong or {}).get("nome"),
        "pagina_inicial": PAGINA_INICIAL[tipo] if completo else PAGINA_COMPLETAR[tipo],
    }


@router.post("/cadastro", status_code=status.HTTP_201_CREATED)
def cadastrar(dados: Cadastro, conn=Depends(get_db)):
    if buscar_um(conn, "SELECT 1 AS existe FROM usuarios WHERE email = %s", (dados.email,)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Este e-mail já tem conta. Use a opção Entrar.")

    id_usuario = inserir(
        conn,
        "INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo_usuario) VALUES (%s, %s, %s, %s, %s)",
        (dados.nome, dados.email, gerar_hash(dados.senha), dados.telefone, dados.tipo),
    )
    conn.commit()
    usuario = buscar_um(conn, "SELECT id_usuario, nome, email, telefone, tipo_usuario, data_cadastro "
                              "FROM usuarios WHERE id_usuario = %s", (id_usuario,))
    return {"token": criar_token(id_usuario, dados.tipo), "conta": montar_conta(conn, usuario)}


@router.post("/login")
def entrar(dados: Login, conn=Depends(get_db)):
    usuario = buscar_um(conn, "SELECT * FROM usuarios WHERE email = %s AND status = TRUE", (dados.email,))
    # A mesma mensagem para e-mail errado e senha errada: não contamos a um
    # estranho quais e-mails têm conta.
    if usuario is None or not conferir_senha(dados.senha, usuario["senha_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou senha incorretos.")
    return {
        "token": criar_token(usuario["id_usuario"], usuario["tipo_usuario"]),
        "conta": montar_conta(conn, usuario),
    }


@router.get("/eu")
def quem_sou_eu(usuario=Depends(usuario_atual), conn=Depends(get_db)):
    return montar_conta(conn, usuario)
