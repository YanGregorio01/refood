"""Área da ONG: perfil, mapa de doações, solicitações e recebimentos (telas 6.10 a 6.12)."""

from datetime import date, timedelta
from typing import Literal, Optional

import pymysql
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import buscar_todos, buscar_um, executar, get_db, inserir
from app.esquemas import DadosOng, NovaSolicitacao
from app.seguranca import exigir
from app.util import atualizar_vencidos, distancia_sql, kg_texto, refeicoes

router = APIRouter(prefix="/api/ong", tags=["ONG"])
usuario_ong = exigir("ONG")

CAMPOS_ONG = ("id_ong, nome, cnpj, telefone, responsavel, endereco, bairro, cidade, uf, cep, "
              "latitude, longitude")


def minha_ong(usuario=Depends(usuario_ong), conn=Depends(get_db)) -> dict:
    ong = buscar_um(conn, f"SELECT {CAMPOS_ONG} FROM ongs WHERE id_usuario = %s", (usuario["id_usuario"],))
    if ong is None:
        raise HTTPException(status.HTTP_428_PRECONDITION_REQUIRED,
                            "Complete o cadastro da sua ONG para ver as doações.")
    return ong


@router.get("/perfil")
def ver_perfil(ong=Depends(minha_ong)):
    return ong


@router.post("/perfil", status_code=status.HTTP_201_CREATED)
def cadastrar_ong(dados: DadosOng, usuario=Depends(usuario_ong), conn=Depends(get_db)):
    if buscar_um(conn, "SELECT 1 AS existe FROM ongs WHERE id_usuario = %s", (usuario["id_usuario"],)):
        raise HTTPException(409, "Sua ONG já está cadastrada.")
    try:
        inserir(conn, """
            INSERT INTO ongs (id_usuario, nome, cnpj, telefone, responsavel, endereco, bairro, cidade, uf, cep,
                              latitude, longitude)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (usuario["id_usuario"], dados.nome, dados.cnpj or None, dados.telefone, dados.responsavel,
              dados.endereco, dados.bairro, dados.cidade, (dados.uf or "").upper() or None, dados.cep,
              dados.latitude, dados.longitude))
    except pymysql.err.IntegrityError:
        conn.rollback()
        raise HTTPException(409, "Este CNPJ já está cadastrado em outra ONG.")
    conn.commit()
    return minha_ong(usuario, conn)


@router.put("/perfil")
def editar_ong(dados: DadosOng, ong=Depends(minha_ong), conn=Depends(get_db)):
    try:
        executar(conn, """
            UPDATE ongs SET nome = %s, cnpj = %s, telefone = %s, responsavel = %s, endereco = %s, bairro = %s,
                cidade = %s, uf = %s, cep = %s, latitude = %s, longitude = %s
            WHERE id_ong = %s
        """, (dados.nome, dados.cnpj or None, dados.telefone, dados.responsavel, dados.endereco, dados.bairro,
              dados.cidade, (dados.uf or "").upper() or None, dados.cep, dados.latitude, dados.longitude,
              ong["id_ong"]))
    except pymysql.err.IntegrityError:
        conn.rollback()
        raise HTTPException(409, "Este CNPJ já está cadastrado em outra ONG.")
    conn.commit()
    return buscar_um(conn, f"SELECT {CAMPOS_ONG} FROM ongs WHERE id_ong = %s", (ong["id_ong"],))


@router.get("/ofertas")
def mapa_de_doacoes(
    raio_km: Optional[float] = Query(default=None, gt=0, le=50),
    tipo: Optional[str] = None,
    busca: Optional[str] = Query(default=None, max_length=60),
    ong=Depends(minha_ong), conn=Depends(get_db),
):
    """Ofertas de doação ativas, da mais perto para a mais longe da ONG."""
    atualizar_vencidos(conn)
    lng, lat = ong["longitude"], ong["latitude"]
    filtros, params = ["o.status = 'ATIVA'", "o.disponivel_ate > NOW()", "o.quantidade_kg > 0"], []
    if tipo:
        filtros.append("e.tipo = %s")
        params.append(tipo.upper())
    if busca:
        filtros.append("(e.nome LIKE %s OR e.bairro LIKE %s OR o.tipo_alimento LIKE %s)")
        params += [f"%{busca.strip()}%"] * 3
    if raio_km:
        filtros.append(f"{distancia_sql('e')} <= %s")
        params += [lng, lat, raio_km * 1000]
    itens = buscar_todos(conn, f"""
        SELECT o.id_oferta, o.tipo_alimento, o.quantidade_kg, o.disponivel_ate, o.observacoes,
               e.id_estabelecimento, e.nome AS estabelecimento, e.tipo AS tipo_estabelecimento, e.endereco,
               e.bairro, e.latitude, e.longitude, e.foto, e.telefone,
               {distancia_sql('e')} AS distancia_m,
               (SELECT ROUND(AVG(nota), 1) FROM avaliacoes v WHERE v.id_estabelecimento = e.id_estabelecimento) AS nota_media
        FROM ofertas_doacao o
        JOIN estabelecimentos e ON e.id_estabelecimento = o.id_estabelecimento
        WHERE {" AND ".join(filtros)}
        ORDER BY distancia_m
    """, [lng, lat] + params)
    for item in itens:
        item["refeicoes"] = refeicoes(item["quantidade_kg"])
    return {"ong": ong, "itens": itens}


@router.post("/solicitacoes", status_code=status.HTTP_201_CREATED)
def solicitar_doacao(dados: NovaSolicitacao, ong=Depends(minha_ong), conn=Depends(get_db)):
    """Tela 6.11. Trava a oferta (FOR UPDATE) para duas ONGs não pegarem os mesmos quilos."""
    conn.begin()
    oferta = buscar_um(conn, """
        SELECT id_oferta, quantidade_kg, status, (disponivel_ate > NOW()) AS no_prazo,
               (%s <= disponivel_ate) AS horario_ok, (%s >= NOW() - INTERVAL 10 MINUTE) AS horario_futuro
        FROM ofertas_doacao WHERE id_oferta = %s FOR UPDATE
    """, (dados.data_retirada, dados.data_retirada, dados.id_oferta))
    if oferta is None:
        conn.rollback()
        raise HTTPException(404, "Oferta de doação não encontrada.")
    if oferta["status"] != "ATIVA" or not oferta["no_prazo"]:
        conn.rollback()
        raise HTTPException(409, "Esta oferta não está mais disponível.")
    if not oferta["horario_ok"] or not oferta["horario_futuro"]:
        conn.rollback()
        raise HTTPException(422, "Escolha um horário de retirada entre agora e o limite da oferta.")
    if dados.quantidade_kg > oferta["quantidade_kg"]:
        conn.rollback()
        raise HTTPException(409, f"Esta oferta tem só {kg_texto(oferta['quantidade_kg'])} disponíveis.")

    executar(conn, "UPDATE ofertas_doacao SET quantidade_kg = quantidade_kg - %s WHERE id_oferta = %s",
             (dados.quantidade_kg, dados.id_oferta))
    id_doacao = inserir(conn, """
        INSERT INTO doacoes (id_oferta, id_ong, quantidade_kg, data_retirada, observacoes)
        VALUES (%s, %s, %s, %s, %s)
    """, (dados.id_oferta, ong["id_ong"], dados.quantidade_kg, dados.data_retirada, dados.observacoes))
    conn.commit()
    return _solicitacao(conn, id_doacao, ong["id_ong"])


CAMPOS_SOLICITACAO = """
    d.id_doacao, d.status, d.quantidade_kg, d.data_retirada, d.observacoes, d.data_solicitacao,
    d.data_resposta, d.data_recebimento, o.id_oferta, o.tipo_alimento,
    e.id_estabelecimento, e.nome AS estabelecimento, e.tipo AS tipo_estabelecimento, e.endereco, e.bairro,
    e.cidade, e.uf, e.latitude, e.longitude, e.telefone, e.foto
"""
JUNCAO_SOLICITACAO = """
    FROM doacoes d
    JOIN ofertas_doacao o ON o.id_oferta = d.id_oferta
    JOIN estabelecimentos e ON e.id_estabelecimento = o.id_estabelecimento
"""


def _solicitacao(conn, id_doacao, id_ong):
    item = buscar_um(conn, f"SELECT {CAMPOS_SOLICITACAO} {JUNCAO_SOLICITACAO} "
                           "WHERE d.id_doacao = %s AND d.id_ong = %s", (id_doacao, id_ong))
    if item is None:
        raise HTTPException(404, "Solicitação não encontrada.")
    item["refeicoes"] = refeicoes(item["quantidade_kg"])
    return item


def _intervalo_do_mes(mes: Optional[str]):
    """'2026-09' -> (2026-09-01, 2026-10-01). Sem mês, usa o mês atual."""
    if mes:
        try:
            ano, m = map(int, mes.split("-"))
            inicio = date(ano, m, 1)
        except ValueError:
            raise HTTPException(422, "Use o mês no formato AAAA-MM, como 2026-09.")
    else:
        inicio = date.today().replace(day=1)
    fim = date(inicio.year + (inicio.month == 12), inicio.month % 12 + 1, 1)
    return inicio, fim


@router.get("/solicitacoes")
def minhas_solicitacoes(
    status_doacao: Optional[Literal["PENDENTE", "CONFIRMADA", "RECUSADA", "RECEBIDA", "CANCELADA"]]
    = Query(default=None, alias="status"),
    mes: Optional[str] = Query(default=None, description="AAAA-MM; filtra pela data de retirada"),
    busca: Optional[str] = Query(default=None, max_length=60),
    ong=Depends(minha_ong), conn=Depends(get_db),
):
    """Tela 6.12 (Histórico de recebimentos) e a lista de pedidos em andamento."""
    filtro, params = "d.id_ong = %s", [ong["id_ong"]]
    if status_doacao:
        filtro += " AND d.status = %s"
        params.append(status_doacao)
    if mes:
        inicio, fim = _intervalo_do_mes(mes)
        filtro += (" AND COALESCE(d.data_recebimento, d.data_retirada) >= %s"
                   " AND COALESCE(d.data_recebimento, d.data_retirada) < %s")
        params += [inicio, fim]
    if busca:
        filtro += " AND (e.nome LIKE %s OR o.tipo_alimento LIKE %s)"
        params += [f"%{busca.strip()}%"] * 2
    itens = buscar_todos(conn, f"SELECT {CAMPOS_SOLICITACAO} {JUNCAO_SOLICITACAO} WHERE {filtro} "
                               "ORDER BY (d.status IN ('PENDENTE', 'CONFIRMADA')) DESC, d.data_retirada DESC "
                               "LIMIT 200", params)
    for item in itens:
        item["refeicoes"] = refeicoes(item["quantidade_kg"])
    return itens


@router.post("/solicitacoes/{id_doacao}/cancelar")
def cancelar_solicitacao(id_doacao: int, ong=Depends(minha_ong), conn=Depends(get_db)):
    conn.begin()
    doacao = buscar_um(conn, "SELECT id_doacao, status, quantidade_kg, id_oferta FROM doacoes "
                             "WHERE id_doacao = %s AND id_ong = %s FOR UPDATE", (id_doacao, ong["id_ong"]))
    if doacao is None:
        conn.rollback()
        raise HTTPException(404, "Solicitação não encontrada.")
    if doacao["status"] not in ("PENDENTE", "CONFIRMADA"):
        conn.rollback()
        raise HTTPException(409, "Só dá para cancelar pedidos que ainda não foram retirados.")
    executar(conn, "UPDATE doacoes SET status = 'CANCELADA' WHERE id_doacao = %s", (id_doacao,))
    executar(conn, "UPDATE ofertas_doacao SET quantidade_kg = quantidade_kg + %s WHERE id_oferta = %s",
             (doacao["quantidade_kg"], doacao["id_oferta"]))
    conn.commit()
    return _solicitacao(conn, id_doacao, ong["id_ong"])


@router.get("/resumo")
def resumo_do_mes(mes: Optional[str] = Query(default=None, description="AAAA-MM"),
                  ong=Depends(minha_ong), conn=Depends(get_db)):
    """Os três números do topo da tela 6.12."""
    inicio, fim = _intervalo_do_mes(mes)
    inicio_anterior, fim_anterior = _intervalo_do_mes(
        f"{inicio.year - (inicio.month == 1)}-{(inicio.month - 2) % 12 + 1:02d}")
    hoje = date.today()
    if inicio <= hoje < fim:
        # mês em andamento: compara com os mesmos dias do mês anterior,
        # senão meio mês sempre parece pior que o mês inteiro de antes
        fim = hoje + timedelta(days=1)
        fim_anterior = min(fim_anterior, inicio_anterior + (fim - inicio))

    def recebido(de, ate):
        return buscar_um(conn, """
            SELECT COALESCE(SUM(d.quantidade_kg), 0) AS kg, COUNT(*) AS doacoes,
                   COUNT(DISTINCT o.id_estabelecimento) AS parceiros
            FROM doacoes d JOIN ofertas_doacao o ON o.id_oferta = d.id_oferta
            WHERE d.id_ong = %s AND d.status = 'RECEBIDA'
              AND d.data_recebimento >= %s AND d.data_recebimento < %s
        """, (ong["id_ong"], de, ate))

    atual, anterior = recebido(inicio, fim), recebido(inicio_anterior, fim_anterior)
    kg, kg_anterior = float(atual["kg"]), float(anterior["kg"])
    pendentes = buscar_um(conn, "SELECT COUNT(*) AS total FROM doacoes WHERE id_ong = %s "
                                "AND status IN ('PENDENTE', 'CONFIRMADA')", (ong["id_ong"],))
    return {
        "mes": inicio.strftime("%Y-%m"),
        "recebido_kg": round(kg, 1),
        "variacao_percentual": round((kg - kg_anterior) / kg_anterior * 100) if kg_anterior else None,
        "doacoes_concluidas": atual["doacoes"],
        "parceiros": atual["parceiros"],
        "refeicoes_estimadas": refeicoes(kg),
        "pedidos_em_andamento": pendentes["total"],
    }
