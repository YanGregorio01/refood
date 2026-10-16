"""Doações do lado do comerciante: oferecer o excedente e responder às ONGs.

Esta parte não tinha tela no Figma (item 3 da pauta). Fluxo:
1. a loja publica uma oferta ("12 kg de frutas, até as 21h");
2. a ONG vê a oferta no mapa e pede uma quantidade (rotas em ong.py);
3. a loja confirma ou recusa o pedido;
4. quando a ONG busca, a loja marca como entregue e a doação vira RECEBIDA.
"""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import buscar_todos, buscar_um, executar, get_db, inserir
from app.esquemas import NovaOfertaDoacao
from app.rotas.comerciante import minha_loja
from app.util import atualizar_vencidos, refeicoes

router = APIRouter(prefix="/api/painel/doacoes", tags=["Comerciante: doações"])


@router.get("/ofertas")
def minhas_ofertas(loja=Depends(minha_loja), conn=Depends(get_db)):
    atualizar_vencidos(conn)
    return buscar_todos(conn, """
        SELECT o.id_oferta, o.tipo_alimento, o.quantidade_kg, o.disponivel_ate, o.observacoes, o.status,
               o.data_cadastro,
               COALESCE(SUM(CASE WHEN d.status IN ('PENDENTE', 'CONFIRMADA', 'RECEBIDA')
                                 THEN d.quantidade_kg END), 0) AS kg_pedidos,
               COALESCE(SUM(d.status = 'PENDENTE'), 0) AS pedidos_pendentes
        FROM ofertas_doacao o
        LEFT JOIN doacoes d ON d.id_oferta = o.id_oferta
        WHERE o.id_estabelecimento = %s AND (o.status = 'ATIVA' OR o.data_cadastro >= NOW() - INTERVAL 14 DAY)
        GROUP BY o.id_oferta
        ORDER BY o.status, o.disponivel_ate DESC
    """, (loja["id_estabelecimento"],))


@router.post("/ofertas", status_code=status.HTTP_201_CREATED)
def nova_oferta(dados: NovaOfertaDoacao, loja=Depends(minha_loja), conn=Depends(get_db)):
    if not buscar_um(conn, "SELECT %s > NOW() AS ok", (dados.disponivel_ate,))["ok"]:
        raise HTTPException(422, "Escolha um horário limite no futuro.")
    id_oferta = inserir(conn, """
        INSERT INTO ofertas_doacao (id_estabelecimento, tipo_alimento, quantidade_kg, disponivel_ate, observacoes)
        VALUES (%s, %s, %s, %s, %s)
    """, (loja["id_estabelecimento"], dados.tipo_alimento, dados.quantidade_kg, dados.disponivel_ate,
          dados.observacoes))
    conn.commit()
    return buscar_um(conn, "SELECT * FROM ofertas_doacao WHERE id_oferta = %s", (id_oferta,))


@router.post("/ofertas/{id_oferta}/encerrar")
def encerrar_oferta(id_oferta: int, loja=Depends(minha_loja), conn=Depends(get_db)):
    alterou = executar(conn, "UPDATE ofertas_doacao SET status = 'ENCERRADA' "
                             "WHERE id_oferta = %s AND id_estabelecimento = %s AND status = 'ATIVA'",
                       (id_oferta, loja["id_estabelecimento"]))
    if not alterou:
        raise HTTPException(404, "Oferta ativa não encontrada na sua loja.")
    conn.commit()
    return {"mensagem": "Oferta encerrada. Pedidos já confirmados continuam valendo."}


@router.get("/solicitacoes")
def solicitacoes_recebidas(
    status_doacao: Optional[Literal["PENDENTE", "CONFIRMADA", "RECUSADA", "RECEBIDA", "CANCELADA"]]
    = Query(default=None, alias="status"),
    loja=Depends(minha_loja), conn=Depends(get_db),
):
    filtro, params = "o.id_estabelecimento = %s", [loja["id_estabelecimento"]]
    if status_doacao:
        filtro += " AND d.status = %s"
        params.append(status_doacao)
    else:
        filtro += " AND (d.status IN ('PENDENTE', 'CONFIRMADA') OR d.data_solicitacao >= NOW() - INTERVAL 14 DAY)"
    itens = buscar_todos(conn, f"""
        SELECT d.id_doacao, d.status, d.quantidade_kg, d.data_retirada, d.observacoes, d.data_solicitacao,
               o.id_oferta, o.tipo_alimento, g.nome AS ong, g.telefone, g.responsavel, g.bairro
        FROM doacoes d
        JOIN ofertas_doacao o ON o.id_oferta = d.id_oferta
        JOIN ongs g ON g.id_ong = d.id_ong
        WHERE {filtro}
        ORDER BY FIELD(d.status, 'PENDENTE', 'CONFIRMADA', 'RECEBIDA', 'RECUSADA', 'CANCELADA'), d.data_retirada
    """, params)
    for item in itens:
        item["refeicoes"] = refeicoes(item["quantidade_kg"])
    return itens


# Ação -> (status em que precisa estar, novo status)
ACOES = {
    "confirmar": (("PENDENTE",), "CONFIRMADA"),
    "recusar": (("PENDENTE", "CONFIRMADA"), "RECUSADA"),
    "entregar": (("CONFIRMADA",), "RECEBIDA"),
}


@router.post("/solicitacoes/{id_doacao}/{acao}")
def responder_solicitacao(id_doacao: int, acao: Literal["confirmar", "recusar", "entregar"],
                          loja=Depends(minha_loja), conn=Depends(get_db)):
    conn.begin()
    doacao = buscar_um(conn, """
        SELECT d.id_doacao, d.status, d.quantidade_kg, d.id_oferta
        FROM doacoes d JOIN ofertas_doacao o ON o.id_oferta = d.id_oferta
        WHERE d.id_doacao = %s AND o.id_estabelecimento = %s FOR UPDATE
    """, (id_doacao, loja["id_estabelecimento"]))
    if doacao is None:
        conn.rollback()
        raise HTTPException(404, "Solicitação não encontrada.")
    permitidos, novo = ACOES[acao]
    if doacao["status"] not in permitidos:
        conn.rollback()
        raise HTTPException(409, f"Não dá para {acao} uma solicitação com status {doacao['status'].lower()}.")

    if acao == "entregar":
        executar(conn, "UPDATE doacoes SET status = 'RECEBIDA', data_recebimento = NOW() WHERE id_doacao = %s",
                 (id_doacao,))
    else:
        executar(conn, "UPDATE doacoes SET status = %s, data_resposta = NOW() WHERE id_doacao = %s",
                 (novo, id_doacao))
    if acao == "recusar":
        # o que tinha sido reservado para a ONG volta para a oferta
        executar(conn, "UPDATE ofertas_doacao SET quantidade_kg = quantidade_kg + %s WHERE id_oferta = %s",
                 (doacao["quantidade_kg"], doacao["id_oferta"]))
    conn.commit()
    return {"id_doacao": id_doacao, "status": novo}
