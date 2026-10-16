"""Rotas do consumidor: início, perfil e reservas (RF09, RF12, RF14)."""

from typing import Literal, Optional

import pymysql
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import buscar_todos, buscar_um, executar, get_db, inserir
from app.esquemas import NovaAvaliacao, NovaReserva
from app.rotas.publico import CAMPOS_SACOLA, JUNCAO_SACOLA, SACOLA_DISPONIVEL, _ponto
from app.seguranca import exigir
from app.util import atualizar_vencidos, nivel, novo_codigo_retirada, primeiro_dia_do_mes_sql, refeicoes

router = APIRouter(prefix="/api", tags=["Consumidor"])
consumidor = exigir("COMUM")

CAMPOS_RESERVA = """
    r.id_reserva, r.codigo_retirada, r.status, r.quantidade, r.valor_pago, r.forma_pagamento,
    r.data_reserva, r.data_limite_retirada, r.data_retirada,
    a.id_alimento, a.nome AS sacola, a.descricao, COALESCE(a.foto, c.imagem) AS foto,
    a.inicio_retirada, a.fim_retirada, a.preco_original, a.preco, a.peso_estimado_kg,
    e.id_estabelecimento, e.nome AS estabelecimento, e.endereco, e.bairro, e.cidade,
    e.latitude, e.longitude, e.telefone,
    (av.id_avaliacao IS NOT NULL) AS avaliada, av.nota
"""
JUNCAO_RESERVA = """
    FROM reservas r
    JOIN alimentos a ON a.id_alimento = r.id_alimento
    JOIN categorias c ON c.id_categoria = a.id_categoria
    JOIN estabelecimentos e ON e.id_estabelecimento = a.id_estabelecimento
    LEFT JOIN avaliacoes av ON av.id_reserva = r.id_reserva
"""


def _impacto(conn, id_usuario):
    """Quanto comida o consumidor já salvou, contando só o que ele retirou."""
    d = buscar_um(conn, f"""
        SELECT COUNT(*) AS reservas_concluidas,
               COALESCE(SUM(a.peso_estimado_kg * r.quantidade), 0) AS kg,
               COALESCE(SUM((a.preco_original - a.preco) * r.quantidade), 0) AS economia,
               COALESCE(SUM(a.preco_original * r.quantidade), 0) AS valor_original,
               COALESCE(SUM(CASE WHEN r.data_retirada >= {primeiro_dia_do_mes_sql()}
                                 THEN a.peso_estimado_kg * r.quantidade END), 0) AS kg_mes
        FROM reservas r JOIN alimentos a ON a.id_alimento = r.id_alimento
        WHERE r.id_usuario = %s AND r.status = 'RETIRADA'
    """, (id_usuario,))
    kg = float(d["kg"])
    return {
        "kg_salvos": round(kg, 1),
        "refeicoes": refeicoes(kg),
        "economia": d["economia"],
        "reservas_concluidas": d["reservas_concluidas"],
        "kg_este_mes": round(float(d["kg_mes"]), 1),
        "desconto_medio": round(float(d["economia"]) / float(d["valor_original"]) * 100)
        if d["valor_original"] else 0,
        "nivel": nivel(kg),
    }


def _reserva_do_usuario(conn, id_reserva, id_usuario):
    reserva = buscar_um(conn, f"SELECT {CAMPOS_RESERVA} {JUNCAO_RESERVA} "
                              "WHERE r.id_reserva = %s AND r.id_usuario = %s", (id_reserva, id_usuario))
    if reserva is None:
        raise HTTPException(404, "Reserva não encontrada.")
    reserva["avaliada"] = bool(reserva["avaliada"])
    return reserva


@router.get("/consumidor/inicio")
def inicio(lat: Optional[float] = None, lng: Optional[float] = None,
           usuario=Depends(consumidor), conn=Depends(get_db)):
    """Tela 5.5: ofertas perto de você, seu impacto e lojas onde você já comprou."""
    lat, lng = _ponto(lat, lng)
    perto = buscar_todos(conn, f"SELECT {CAMPOS_SACOLA} {JUNCAO_SACOLA} WHERE {SACOLA_DISPONIVEL} "
                               "ORDER BY distancia_m, a.fim_retirada LIMIT 3", (lng, lat))
    lojas = buscar_todos(conn, f"""
        SELECT e.id_estabelecimento, e.nome, e.descricao, e.foto, e.bairro, COUNT(*) AS compras,
               (SELECT COUNT(*) FROM alimentos a WHERE a.id_estabelecimento = e.id_estabelecimento
                  AND {SACOLA_DISPONIVEL}) AS sacolas_disponiveis
        FROM reservas r
        JOIN alimentos x ON x.id_alimento = r.id_alimento
        JOIN estabelecimentos e ON e.id_estabelecimento = x.id_estabelecimento
        WHERE r.id_usuario = %s AND r.status = 'RETIRADA'
        GROUP BY e.id_estabelecimento ORDER BY compras DESC LIMIT 3
    """, (usuario["id_usuario"],))
    return {
        "nome": usuario["nome"].split()[0],
        "perto": perto,
        "impacto": _impacto(conn, usuario["id_usuario"]),
        "lojas_frequentes": lojas,
    }


@router.get("/consumidor/perfil")
def perfil(usuario=Depends(consumidor), conn=Depends(get_db)):
    """Tela 6.6: dados da conta e impacto acumulado."""
    return {
        "nome": usuario["nome"],
        "email": usuario["email"],
        "telefone": usuario["telefone"],
        "membro_desde": usuario["data_cadastro"],
        "impacto": _impacto(conn, usuario["id_usuario"]),
    }


@router.post("/reservas", status_code=status.HTTP_201_CREATED)
def reservar(dados: NovaReserva, usuario=Depends(consumidor), conn=Depends(get_db)):
    """Reserva sacolas sem deixar o estoque ficar negativo (RN05, RN06, RN07, RS05).

    O SELECT ... FOR UPDATE trava a linha da sacola até o commit. Se duas
    pessoas reservarem a última sacola ao mesmo tempo, a segunda espera a
    primeira terminar e então já enxerga a quantidade atualizada.
    """
    conn.begin()
    sacola = buscar_um(conn, """
        SELECT id_alimento, quantidade, preco, status, fim_retirada,
               (fim_retirada > NOW() AND validade > NOW()) AS no_prazo
        FROM alimentos WHERE id_alimento = %s FOR UPDATE
    """, (dados.id_alimento,))
    if sacola is None or sacola["status"] == "RASCUNHO":
        conn.rollback()
        raise HTTPException(404, "Sacola não encontrada.")
    if sacola["status"] != "DISPONIVEL" or not sacola["no_prazo"] or sacola["quantidade"] == 0:
        conn.rollback()
        raise HTTPException(409, "Esta sacola não está mais disponível.")
    if dados.quantidade > sacola["quantidade"]:
        conn.rollback()
        raise HTTPException(409, f"Só restam {sacola['quantidade']} sacola(s) desta oferta.")

    restante = sacola["quantidade"] - dados.quantidade
    executar(conn, "UPDATE alimentos SET quantidade = %s, status = %s WHERE id_alimento = %s",
             (restante, "RESERVADO" if restante == 0 else "DISPONIVEL", dados.id_alimento))
    id_reserva = inserir(conn, """
        INSERT INTO reservas (id_usuario, id_alimento, quantidade, valor_pago, forma_pagamento,
                              codigo_retirada, data_limite_retirada)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (usuario["id_usuario"], dados.id_alimento, dados.quantidade, sacola["preco"] * dados.quantidade,
          dados.forma_pagamento, novo_codigo_retirada(conn), sacola["fim_retirada"]))
    conn.commit()
    return _reserva_do_usuario(conn, id_reserva, usuario["id_usuario"])


@router.get("/reservas")
def minhas_reservas(status_reserva: Optional[Literal["PENDENTE", "RETIRADA", "CANCELADA", "NAO_COMPARECEU"]]
                    = Query(default=None, alias="status"),
                    usuario=Depends(consumidor), conn=Depends(get_db)):
    """Tela 6.5 (Meus pedidos). O consumidor só vê as próprias reservas (RN10)."""
    atualizar_vencidos(conn)
    filtro, params = "r.id_usuario = %s", [usuario["id_usuario"]]
    if status_reserva:
        filtro += " AND r.status = %s"
        params.append(status_reserva)
    itens = buscar_todos(conn, f"SELECT {CAMPOS_RESERVA} {JUNCAO_RESERVA} WHERE {filtro} "
                               "ORDER BY (r.status = 'PENDENTE') DESC, r.data_reserva DESC LIMIT 100", params)
    for item in itens:
        item["avaliada"] = bool(item["avaliada"])
    contagem = buscar_todos(conn, "SELECT status, COUNT(*) AS total FROM reservas WHERE id_usuario = %s "
                                  "GROUP BY status", (usuario["id_usuario"],))
    return {"contagem": {c["status"]: c["total"] for c in contagem}, "itens": itens}


@router.get("/reservas/{id_reserva}")
def ver_reserva(id_reserva: int, usuario=Depends(consumidor), conn=Depends(get_db)):
    """Tela 6.4 (Reserva confirmada): o código que o consumidor mostra na loja."""
    return _reserva_do_usuario(conn, id_reserva, usuario["id_usuario"])


@router.post("/reservas/{id_reserva}/cancelar")
def cancelar_reserva(id_reserva: int, usuario=Depends(consumidor), conn=Depends(get_db)):
    """Cancela e devolve as sacolas para o estoque."""
    conn.begin()
    reserva = buscar_um(conn, "SELECT id_reserva, id_alimento, quantidade, status FROM reservas "
                              "WHERE id_reserva = %s AND id_usuario = %s FOR UPDATE",
                        (id_reserva, usuario["id_usuario"]))
    if reserva is None:
        conn.rollback()
        raise HTTPException(404, "Reserva não encontrada.")
    if reserva["status"] != "PENDENTE":
        conn.rollback()
        raise HTTPException(409, "Só dá para cancelar uma reserva que ainda não foi retirada.")

    executar(conn, "UPDATE reservas SET status = 'CANCELADA' WHERE id_reserva = %s", (id_reserva,))
    # Se a sacola tinha esgotado e ainda está no horário, ela volta para o catálogo
    executar(conn, """
        UPDATE alimentos
        SET quantidade = quantidade + %s,
            status = CASE WHEN status = 'RESERVADO' AND fim_retirada > NOW() THEN 'DISPONIVEL' ELSE status END
        WHERE id_alimento = %s
    """, (reserva["quantidade"], reserva["id_alimento"]))
    conn.commit()
    return _reserva_do_usuario(conn, id_reserva, usuario["id_usuario"])


@router.post("/reservas/{id_reserva}/avaliar", status_code=status.HTTP_201_CREATED)
def avaliar(id_reserva: int, dados: NovaAvaliacao, usuario=Depends(consumidor), conn=Depends(get_db)):
    reserva = _reserva_do_usuario(conn, id_reserva, usuario["id_usuario"])
    if reserva["status"] != "RETIRADA":
        raise HTTPException(409, "Você pode avaliar depois de retirar a sacola.")
    try:
        inserir(conn, "INSERT INTO avaliacoes (id_usuario, id_estabelecimento, id_reserva, nota, comentario) "
                      "VALUES (%s, %s, %s, %s, %s)",
                (usuario["id_usuario"], reserva["id_estabelecimento"], id_reserva, dados.nota,
                 (dados.comentario or "").strip() or None))
    except pymysql.err.IntegrityError:
        conn.rollback()
        raise HTTPException(409, "Você já avaliou este pedido.")
    conn.commit()
    return {"mensagem": "Obrigado pela avaliação!"}
