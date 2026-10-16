"""Cadastro, login e permissões (RF01, RF02, RNF04, RNF05, RS02)."""

import uuid

from app.database import buscar_um, conectar


def email_novo():
    return f"teste-{uuid.uuid4().hex[:8]}@refood.test"


def test_health(cliente):
    assert cliente.get("/api/health").json() == {"status": "ok", "banco": "ok"}


def test_cadastro_devolve_token_e_guarda_so_o_hash(cliente):
    email = email_novo()
    r = cliente.post("/api/auth/cadastro", json={"nome": "Ana  Teste", "email": email.upper(), "senha": "segredo1",
                                                 "tipo": "COMUM"})
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["token"]
    assert corpo["conta"]["nome"] == "Ana Teste"           # espaços extras removidos
    assert corpo["conta"]["email"] == email                # e-mail sempre em minúsculas
    assert corpo["conta"]["pagina_inicial"] == "/inicio.html"

    linha = buscar_um(conectar(), "SELECT senha_hash FROM usuarios WHERE email = %s", (email,))
    assert linha["senha_hash"].startswith("$2b$")          # bcrypt, nunca a senha
    assert "segredo1" not in linha["senha_hash"]


def test_email_repetido_e_recusado(cliente):
    email = email_novo()
    dados = {"nome": "Bruno", "email": email, "senha": "segredo1", "tipo": "COMUM"}
    assert cliente.post("/api/auth/cadastro", json=dados).status_code == 201
    r = cliente.post("/api/auth/cadastro", json=dados)
    assert r.status_code == 409
    assert "já tem conta" in r.json()["detail"]


def test_validacao_em_portugues(cliente):
    r = cliente.post("/api/auth/cadastro", json={"nome": "A", "email": "sem-arroba", "senha": "123", "tipo": "ADMIN"})
    assert r.status_code == 422
    campos = r.json()["campos"]
    assert campos["nome"] == "Use pelo menos 3 caracteres."
    assert campos["senha"] == "Use pelo menos 6 caracteres."
    assert campos["tipo"] == "Escolha uma das opções da lista."


def test_login_errado_nao_diz_qual_campo_errou(cliente):
    senha_errada = cliente.post("/api/auth/login", json={"email": "camila@refood.test", "senha": "errada"})
    email_errado = cliente.post("/api/auth/login", json={"email": "ninguem@refood.test", "senha": "refood123"})
    assert senha_errada.status_code == email_errado.status_code == 401
    assert senha_errada.json()["detail"] == email_errado.json()["detail"] == "E-mail ou senha incorretos."


def test_rota_protegida_sem_token_ou_com_token_falso(cliente):
    assert cliente.get("/api/auth/eu").status_code == 401
    r = cliente.get("/api/auth/eu", headers={"Authorization": "Bearer token.falso.qualquer"})
    assert r.status_code == 401


def test_cada_tipo_de_usuario_so_entra_na_sua_area(cliente, camila, padaria, ong):
    assert cliente.get("/api/painel/resumo", headers=camila).status_code == 403
    assert cliente.get("/api/ong/ofertas", headers=padaria).status_code == 403
    assert cliente.post("/api/reservas", headers=ong, json={"id_alimento": 1}).status_code == 403
    assert cliente.get("/api/consumidor/perfil", headers=padaria).status_code == 403


def test_comerciante_novo_precisa_cadastrar_a_loja(cliente):
    r = cliente.post("/api/auth/cadastro", json={"nome": "Loja Nova", "email": email_novo(), "senha": "segredo1",
                                                 "tipo": "ESTABELECIMENTO"})
    conta = r.json()["conta"]
    assert conta["perfil_completo"] is False
    assert conta["pagina_inicial"] == "/completar-cadastro.html"
    cabecalho = {"Authorization": f"Bearer {r.json()['token']}"}

    assert cliente.get("/api/painel/resumo", headers=cabecalho).status_code == 428
    loja = {"nome": "Empório Teste", "tipo": "MERCADO", "endereco": "Rua Teste, 10", "cidade": "São Paulo",
            "uf": "sp", "latitude": -23.56, "longitude": -46.68, "horario_abertura": "08:00"}
    criada = cliente.post("/api/painel/estabelecimento", headers=cabecalho, json=loja)
    assert criada.status_code == 201
    assert criada.json()["uf"] == "SP"
    assert criada.json()["horario_abertura"] == "08:00"
    assert cliente.get("/api/painel/resumo", headers=cabecalho).status_code == 200
    assert cliente.get("/api/auth/eu", headers=cabecalho).json()["perfil_completo"] is True
    # a segunda tentativa de criar a loja é recusada
    assert cliente.post("/api/painel/estabelecimento", headers=cabecalho, json=loja).status_code == 409


def test_api_desconhecida_responde_json(cliente):
    r = cliente.get("/api/nao-existe")
    assert r.status_code == 404
    assert "não existe" in r.json()["detail"]
