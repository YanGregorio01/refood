"""Reservas, retirada e avaliação (RF09, RF12 a RF14, RN05 a RN07, RN10, RS05)."""

from concurrent.futures import ThreadPoolExecutor


def reservar(cliente, quem, id_alimento, quantidade=1):
    return cliente.post("/api/reservas", headers=quem,
                        json={"id_alimento": id_alimento, "quantidade": quantidade, "forma_pagamento": "PIX"})


def test_reservar_baixa_o_estoque_e_gera_codigo(cliente, camila, nova_sacola):
    sacola = nova_sacola(quantidade=3)
    r = reservar(cliente, camila, sacola["id_alimento"], 2)
    assert r.status_code == 201
    reserva = r.json()
    assert reserva["status"] == "PENDENTE"
    assert reserva["codigo_retirada"].startswith("RF-")
    assert reserva["valor_pago"] == 20.0
    depois = cliente.get(f"/api/sacolas/{sacola['id_alimento']}").json()
    assert depois["quantidade"] == 1                                  # RN07


def test_nao_reserva_mais_do_que_tem(cliente, camila, nova_sacola):
    sacola = nova_sacola(quantidade=2)
    r = reservar(cliente, camila, sacola["id_alimento"], 3)
    assert r.status_code == 409
    assert r.json()["detail"] == "Só restam 2 sacola(s) desta oferta."   # RS05


def test_ultima_sacola_esgota_e_sai_do_catalogo(cliente, camila, lucas, nova_sacola):
    sacola = nova_sacola(quantidade=1)
    assert reservar(cliente, camila, sacola["id_alimento"]).status_code == 201
    detalhe = cliente.get(f"/api/sacolas/{sacola['id_alimento']}").json()
    assert detalhe["status"] == "RESERVADO" and detalhe["disponivel"] is False
    assert reservar(cliente, lucas, sacola["id_alimento"]).status_code == 409


def test_duas_pessoas_ao_mesmo_tempo_nao_estouram_o_estoque(cliente, camila, lucas, nova_sacola):
    """O SELECT ... FOR UPDATE garante que só uma reserva leva a última sacola."""
    sacola = nova_sacola(quantidade=1)
    pessoas = [camila, lucas, camila, lucas, camila, lucas]
    with ThreadPoolExecutor(max_workers=6) as pool:
        respostas = list(pool.map(lambda quem: reservar(cliente, quem, sacola["id_alimento"]), pessoas))
    codigos = sorted(r.status_code for r in respostas)
    assert codigos == [201, 409, 409, 409, 409, 409]
    assert cliente.get(f"/api/sacolas/{sacola['id_alimento']}").json()["quantidade"] == 0


def test_cancelar_devolve_a_sacola(cliente, camila, nova_sacola):
    sacola = nova_sacola(quantidade=1)
    reserva = reservar(cliente, camila, sacola["id_alimento"]).json()
    cancelada = cliente.post(f"/api/reservas/{reserva['id_reserva']}/cancelar", headers=camila).json()
    assert cancelada["status"] == "CANCELADA"
    volta = cliente.get(f"/api/sacolas/{sacola['id_alimento']}").json()
    assert volta["quantidade"] == 1 and volta["status"] == "DISPONIVEL"
    # cancelar de novo não pode
    assert cliente.post(f"/api/reservas/{reserva['id_reserva']}/cancelar", headers=camila).status_code == 409


def test_cada_um_ve_so_as_proprias_reservas(cliente, camila, lucas, nova_sacola):
    sacola = nova_sacola()
    reserva = reservar(cliente, camila, sacola["id_alimento"]).json()
    assert cliente.get(f"/api/reservas/{reserva['id_reserva']}", headers=lucas).status_code == 404   # RN10
    minhas = cliente.get("/api/reservas", headers=camila).json()
    assert reserva["id_reserva"] in [r["id_reserva"] for r in minhas["itens"]]


def test_retirada_pelo_codigo_e_avaliacao(cliente, camila, padaria, mercado, nova_sacola):
    sacola = nova_sacola()
    reserva = reservar(cliente, camila, sacola["id_alimento"]).json()
    numero = reserva["codigo_retirada"].removeprefix("RF-")

    # antes de retirar, ainda não dá para avaliar
    antes = cliente.post(f"/api/reservas/{reserva['id_reserva']}/avaliar", headers=camila, json={"nota": 5})
    assert antes.status_code == 409

    # outra loja não confirma o código desta
    assert cliente.post("/api/painel/reservas/confirmar-retirada", headers=mercado,
                        json={"codigo": numero}).status_code == 404

    ok = cliente.post("/api/painel/reservas/confirmar-retirada", headers=padaria, json={"codigo": f"#rf-{numero}"})
    assert ok.status_code == 200
    assert ok.json()["reserva"]["status"] == "RETIRADA"
    assert ok.json()["reserva"]["data_retirada"] is not None
    de_novo = cliente.post("/api/painel/reservas/confirmar-retirada", headers=padaria, json={"codigo": numero})
    assert de_novo.status_code == 409 and de_novo.json()["detail"] == "Esta reserva já foi retirada."

    avaliou = cliente.post(f"/api/reservas/{reserva['id_reserva']}/avaliar", headers=camila,
                           json={"nota": 5, "comentario": "Tudo fresquinho!"})
    assert avaliou.status_code == 201
    repetida = cliente.post(f"/api/reservas/{reserva['id_reserva']}/avaliar", headers=camila, json={"nota": 4})
    assert repetida.status_code == 409


def test_painel_mostra_a_reserva_com_nome_curto(cliente, camila, padaria, nova_sacola):
    sacola = nova_sacola()
    reserva = reservar(cliente, camila, sacola["id_alimento"]).json()
    pedidos = cliente.get("/api/painel/reservas", headers=padaria, params={"periodo": "semana"}).json()
    linha = next(p for p in pedidos["itens"] if p["id_reserva"] == reserva["id_reserva"])
    assert linha["cliente"] == "Camila F."
    assert pedidos["aguardando"] >= 1


def test_perfil_do_consumidor(cliente, camila):
    perfil = cliente.get("/api/consumidor/perfil", headers=camila).json()
    impacto = perfil["impacto"]
    assert impacto["refeicoes"] == int(impacto["kg_salvos"] / 0.4)
    assert impacto["nivel"]["nome"] in ("Semente", "Broto", "Raiz Forte", "Floresta")
