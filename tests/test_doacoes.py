"""Fluxo de doação: loja oferece, ONG pede, loja confirma e entrega."""

from datetime import datetime, timedelta

from app.util import refeicoes


def daqui(horas):
    return (datetime.now() + timedelta(hours=horas)).replace(microsecond=0).isoformat()


def nova_oferta(cliente, loja, kg=10):
    r = cliente.post("/api/painel/doacoes/ofertas", headers=loja,
                     json={"tipo_alimento": "Pães de teste", "quantidade_kg": kg, "disponivel_ate": daqui(5)})
    assert r.status_code == 201, r.text
    return r.json()


def pedir(cliente, ong, id_oferta, kg, horas=2):
    return cliente.post("/api/ong/solicitacoes", headers=ong,
                        json={"id_oferta": id_oferta, "quantidade_kg": kg, "data_retirada": daqui(horas)})


def test_fluxo_completo_de_doacao(cliente, padaria, ong):
    oferta = nova_oferta(cliente, padaria, kg=10)
    no_mapa = cliente.get("/api/ong/ofertas", headers=ong).json()["itens"]
    assert oferta["id_oferta"] in [o["id_oferta"] for o in no_mapa]

    assert pedir(cliente, ong, oferta["id_oferta"], 12).status_code == 409       # mais do que tem
    assert pedir(cliente, ong, oferta["id_oferta"], 4, horas=9).status_code == 422  # depois do limite

    pedido = pedir(cliente, ong, oferta["id_oferta"], 8)
    assert pedido.status_code == 201
    doacao = pedido.json()
    assert doacao["status"] == "PENDENTE" and doacao["refeicoes"] == 20
    restante = next(o for o in cliente.get("/api/painel/doacoes/ofertas", headers=padaria).json()
                    if o["id_oferta"] == oferta["id_oferta"])
    assert restante["quantidade_kg"] == 2.0

    acao = lambda nome: cliente.post(f"/api/painel/doacoes/solicitacoes/{doacao['id_doacao']}/{nome}", headers=padaria)
    assert acao("entregar").status_code == 409          # precisa confirmar antes
    assert acao("confirmar").json()["status"] == "CONFIRMADA"
    assert acao("entregar").json()["status"] == "RECEBIDA"

    recebidas = cliente.get("/api/ong/solicitacoes", headers=ong, params={"status": "RECEBIDA"}).json()
    assert doacao["id_doacao"] in [d["id_doacao"] for d in recebidas]


def test_recusar_e_cancelar_devolvem_os_quilos(cliente, padaria, ong):
    oferta = nova_oferta(cliente, padaria, kg=6)
    primeiro = pedir(cliente, ong, oferta["id_oferta"], 4).json()
    cliente.post(f"/api/painel/doacoes/solicitacoes/{primeiro['id_doacao']}/recusar", headers=padaria)

    segundo = pedir(cliente, ong, oferta["id_oferta"], 6).json()     # os 4 kg voltaram
    assert segundo["status"] == "PENDENTE"
    cancelado = cliente.post(f"/api/ong/solicitacoes/{segundo['id_doacao']}/cancelar", headers=ong).json()
    assert cancelado["status"] == "CANCELADA"
    oferta_agora = next(o for o in cliente.get("/api/painel/doacoes/ofertas", headers=padaria).json()
                        if o["id_oferta"] == oferta["id_oferta"])
    assert oferta_agora["quantidade_kg"] == 6.0


def test_oferta_encerrada_some_do_mapa(cliente, padaria, ong):
    oferta = nova_oferta(cliente, padaria)
    cliente.post(f"/api/painel/doacoes/ofertas/{oferta['id_oferta']}/encerrar", headers=padaria)
    ids = [o["id_oferta"] for o in cliente.get("/api/ong/ofertas", headers=ong).json()["itens"]]
    assert oferta["id_oferta"] not in ids
    assert pedir(cliente, ong, oferta["id_oferta"], 1).status_code == 409


def test_resumo_da_ong(cliente, ong):
    resumo = cliente.get("/api/ong/resumo", headers=ong, params={"mes": "2026-09"}).json()
    assert resumo["mes"] == "2026-09"
    assert resumo["refeicoes_estimadas"] == refeicoes(resumo["recebido_kg"])
    assert cliente.get("/api/ong/resumo", headers=ong, params={"mes": "setembro"}).status_code == 422
