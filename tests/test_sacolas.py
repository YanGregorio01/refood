"""Cadastro de sacolas e catálogo (RF04 a RF08, RF10, RF11, RN03, RN04, RS04)."""

from datetime import date, timedelta


def ids_no_catalogo(cliente, **params):
    r = cliente.get("/api/sacolas", params={"limite": 50, **params})
    assert r.status_code == 200
    return [s["id_alimento"] for s in r.json()["itens"]]


def test_catalogo_so_mostra_o_que_da_para_reservar(cliente):
    r = cliente.get("/api/sacolas", params={"limite": 50}).json()
    assert r["total"] == len(r["itens"]) or r["total"] > 50
    for s in r["itens"]:
        assert s["status"] == "DISPONIVEL" and s["quantidade"] > 0
    assert 19 not in ids_no_catalogo(cliente)  # o rascunho dos dados de exemplo


def test_filtros_do_catalogo(cliente):
    padaria = cliente.get("/api/sacolas", params={"categoria": 1, "limite": 50}).json()["itens"]
    assert padaria and all(s["id_categoria"] == 1 for s in padaria)

    busca = cliente.get("/api/sacolas", params={"busca": "laticínios"}).json()["itens"]
    assert busca and all("aticínios" in s["nome"] for s in busca)

    perto = cliente.get("/api/sacolas", params={"raio_km": 0.5, "limite": 50}).json()["itens"]
    assert all(s["distancia_m"] <= 500 for s in perto)

    por_preco = [s["preco"] for s in cliente.get("/api/sacolas", params={"ordem": "preco", "limite": 50}).json()["itens"]]
    assert por_preco == sorted(por_preco)


def test_criar_sacola_aparece_no_catalogo(cliente, nova_sacola):
    sacola = nova_sacola()
    assert sacola["status"] == "DISPONIVEL"
    assert sacola["desconto"] == 67
    assert sacola["foto"] == "img/categorias/padaria.jpg"   # sem foto, usa a da categoria
    assert sacola["id_alimento"] in ids_no_catalogo(cliente, estabelecimento=1)


def test_rascunho_so_entra_no_catalogo_depois_de_publicado(cliente, padaria, nova_sacola):
    rascunho = nova_sacola(rascunho=True)
    assert rascunho["status"] == "RASCUNHO"
    assert rascunho["id_alimento"] not in ids_no_catalogo(cliente, estabelecimento=1)
    assert cliente.get(f"/api/sacolas/{rascunho['id_alimento']}").status_code == 404

    publicada = cliente.post(f"/api/painel/sacolas/{rascunho['id_alimento']}/publicar", headers=padaria)
    assert publicada.json()["status"] == "DISPONIVEL"
    assert rascunho["id_alimento"] in ids_no_catalogo(cliente, estabelecimento=1)


def test_remover_tira_do_catalogo(cliente, padaria, nova_sacola):
    sacola = nova_sacola()
    r = cliente.post(f"/api/painel/sacolas/{sacola['id_alimento']}/remover", headers=padaria)
    assert r.json()["status"] == "INDISPONIVEL"
    assert sacola["id_alimento"] not in ids_no_catalogo(cliente, estabelecimento=1)


def test_regras_de_cadastro(cliente, padaria):
    base = {"nome": "Sacola", "id_categoria": 1, "preco_original": 20, "preco": 10, "quantidade": 2,
            "data": (date.today() + timedelta(days=1)).isoformat(), "inicio_retirada": "18:00", "fim_retirada": "19:00"}

    caro = cliente.post("/api/painel/sacolas", headers=padaria, json={**base, "preco": 25})
    assert caro.status_code == 422
    assert caro.json()["detail"] == "O preço Refood não pode ser maior que o preço original."

    invertido = cliente.post("/api/painel/sacolas", headers=padaria, json={**base, "fim_retirada": "17:00"})
    assert invertido.json()["detail"] == "O fim da retirada precisa ser depois do início."

    passado = {**base, "data": (date.today() - timedelta(days=1)).isoformat()}
    r = cliente.post("/api/painel/sacolas", headers=padaria, json=passado)
    assert r.status_code == 422 and "já passou" in r.json()["detail"]   # RS04

    categoria = cliente.post("/api/painel/sacolas", headers=padaria, json={**base, "id_categoria": 999})
    assert categoria.status_code == 422


def test_loja_nao_mexe_na_sacola_de_outra(cliente, mercado, nova_sacola):
    sacola = nova_sacola()
    r = cliente.post(f"/api/painel/sacolas/{sacola['id_alimento']}/remover", headers=mercado)
    assert r.status_code == 404


def test_editar_quantidade_respeita_as_ja_reservadas(cliente, padaria, camila, nova_sacola):
    sacola = nova_sacola(quantidade=4)
    cliente.post("/api/reservas", headers=camila, json={"id_alimento": sacola["id_alimento"], "quantidade": 3})
    corpo = {"nome": "Sacola editada", "id_categoria": 2, "preco_original": 30, "preco": 9, "quantidade": 5,
             "data": (date.today() + timedelta(days=1)).isoformat(), "inicio_retirada": "18:00", "fim_retirada": "20:00"}
    editada = cliente.put(f"/api/painel/sacolas/{sacola['id_alimento']}", headers=padaria, json=corpo).json()
    assert editada["quantidade"] == 5
    assert editada["quantidade_inicial"] == 8        # 3 reservadas + 5 novas disponíveis
    assert editada["reservadas"] == 3
    assert editada["categoria"] == "Doces e sobremesas"


def test_mapa_e_pagina_da_loja(cliente):
    lojas = cliente.get("/api/estabelecimentos").json()
    distancias = [loja["distancia_m"] for loja in lojas]
    assert distancias == sorted(distancias)
    assert {"sacolas_disponiveis", "nota_media", "horario_abertura"} <= set(lojas[0])

    loja = cliente.get("/api/estabelecimentos/3").json()
    assert loja["nome"] == "Restaurante Raízes"
    assert loja["horario_abertura"] == "11:30"
    assert all(" " in a["cliente"] and a["cliente"].endswith(".") for a in loja["avaliacoes"])  # "Marina C."
    assert cliente.get("/api/estabelecimentos/999").status_code == 404
