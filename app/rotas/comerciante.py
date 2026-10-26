"""Painel do comerciante, o "Refood Parcerias" (RF03, RF04, RF10, RF11, RF13)."""

from datetime import date, datetime, time, timedelta
from typing import Literal, Optional

import pymysql
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import buscar_todos, buscar_um, executar, get_db, inserir
from app.esquemas import ConfirmarRetirada, DadosLoja, Sacola
from app.seguranca import exigir
from app.util import (DIAS_CURTOS, atualizar_vencidos, nome_curto_sql, primeiro_dia_do_mes_sql,
                      refeicoes)

router = APIRouter(prefix="/api/painel", tags=["Comerciante"])
comerciante = exigir("ESTABELECIMENTO")

FOTO_POR_TIPO = {
    "PADARIA": "img/lojas/padaria-dona-flor.jpg", "MERCADO": "img/lojas/supermercado-economico.jpg",
    "RESTAURANTE": "img/lojas/restaurante-raizes.jpg", "HORTIFRUTI": "img/lojas/hortifruti-verde-vida.jpg",
    "CAFE": "img/lojas/cafe-mineiro.jpg", "OUTRO": "img/lojas/sabor-e-cia.jpg",
}

CAMPOS_LOJA = """
    id_estabelecimento, nome, cnpj, telefone, tipo, descricao, endereco, bairro, cidade, uf, cep,
    latitude, longitude, foto,
    TIME_FORMAT(horario_abertura, '%%H:%%i') AS horario_abertura,
    TIME_FORMAT(horario_fechamento, '%%H:%%i') AS horario_fechamento
"""


def minha_loja(usuario=Depends(comerciante), conn=Depends(get_db)) -> dict:
    """Dependência: a loja do comerciante logado.

    Se ele ainda não cadastrou a loja, responde 428 e o front leva para a
    tela de completar o cadastro.
    """
    loja = buscar_um(conn, f"SELECT {CAMPOS_LOJA} FROM estabelecimentos WHERE id_usuario = %s",
                     (usuario["id_usuario"],))
    if loja is None:
        raise HTTPException(status.HTTP_428_PRECONDITION_REQUIRED,
                            "Complete o cadastro da sua loja para usar o painel.")
    return loja


# ------------------------------------------------------------------ loja
@router.get("/estabelecimento")
def ver_loja(loja=Depends(minha_loja)):
    return loja


@router.post("/estabelecimento", status_code=status.HTTP_201_CREATED)
def cadastrar_loja(dados: DadosLoja, usuario=Depends(comerciante), conn=Depends(get_db)):
    """Tela "Completar cadastro": os dados da loja (RF03)."""
    if buscar_um(conn, "SELECT 1 AS existe FROM estabelecimentos WHERE id_usuario = %s", (usuario["id_usuario"],)):
        raise HTTPException(409, "Sua loja já está cadastrada.")
    try:
        inserir(conn, """
            INSERT INTO estabelecimentos (id_usuario, nome, cnpj, telefone, tipo, descricao, endereco, bairro,
                cidade, uf, cep, latitude, longitude, horario_abertura, horario_fechamento, foto)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (usuario["id_usuario"], dados.nome, dados.cnpj or None, dados.telefone, dados.tipo, dados.descricao,
              dados.endereco, dados.bairro, dados.cidade, (dados.uf or "").upper() or None, dados.cep,
              dados.latitude, dados.longitude, dados.horario_abertura, dados.horario_fechamento,
              FOTO_POR_TIPO[dados.tipo]))
    except pymysql.err.IntegrityError:
        conn.rollback()
        raise HTTPException(409, "Este CNPJ já está cadastrado em outra loja.")
    conn.commit()
    return minha_loja(usuario, conn)


@router.put("/estabelecimento")
def editar_loja(dados: DadosLoja, loja=Depends(minha_loja), conn=Depends(get_db)):
    try:
        executar(conn, """
            UPDATE estabelecimentos SET nome = %s, cnpj = %s, telefone = %s, tipo = %s, descricao = %s,
                endereco = %s, bairro = %s, cidade = %s, uf = %s, cep = %s, latitude = %s, longitude = %s,
                horario_abertura = %s, horario_fechamento = %s
            WHERE id_estabelecimento = %s
        """, (dados.nome, dados.cnpj or None, dados.telefone, dados.tipo, dados.descricao, dados.endereco,
              dados.bairro, dados.cidade, (dados.uf or "").upper() or None, dados.cep, dados.latitude,
              dados.longitude, dados.horario_abertura, dados.horario_fechamento, loja["id_estabelecimento"]))
    except pymysql.err.IntegrityError:
        conn.rollback()
        raise HTTPException(409, "Este CNPJ já está cadastrado em outra loja.")
    conn.commit()
    return buscar_um(conn, f"SELECT {CAMPOS_LOJA} FROM estabelecimentos WHERE id_estabelecimento = %s",
                     (loja["id_estabelecimento"],))


# ------------------------------------------------------------------ dashboard
@router.get("/resumo")
def resumo(loja=Depends(minha_loja), conn=Depends(get_db)):
    """Tela 5.6 (Dashboard): números do dia, vendas da semana e últimas reservas."""
    atualizar_vencidos(conn)
    id_loja = loja["id_estabelecimento"]
    numeros = buscar_um(conn, f"""
        SELECT
          (SELECT COUNT(*) FROM alimentos WHERE id_estabelecimento = %s AND status = 'DISPONIVEL'
              AND quantidade > 0 AND fim_retirada > NOW()) AS sacolas_ativas,
          (SELECT COUNT(*) FROM reservas r JOIN alimentos a ON a.id_alimento = r.id_alimento
              WHERE a.id_estabelecimento = %s AND r.status = 'PENDENTE') AS reservas_pendentes,
          (SELECT COALESCE(SUM(r.quantidade), 0) FROM reservas r JOIN alimentos a ON a.id_alimento = r.id_alimento
              WHERE a.id_estabelecimento = %s AND r.status <> 'CANCELADA'
              AND DATE(r.data_reserva) = CURDATE()) AS vendidas_hoje,
          (SELECT COALESCE(SUM(r.valor_pago), 0) FROM reservas r JOIN alimentos a ON a.id_alimento = r.id_alimento
              WHERE a.id_estabelecimento = %s AND r.status <> 'CANCELADA'
              AND r.data_reserva >= {primeiro_dia_do_mes_sql()}) AS receita_mes
    """, (id_loja,) * 4)

    por_dia = buscar_todos(conn, """
        SELECT DATE(r.data_reserva) AS dia, SUM(r.quantidade) AS quantidade
        FROM reservas r JOIN alimentos a ON a.id_alimento = r.id_alimento
        WHERE a.id_estabelecimento = %s AND r.status <> 'CANCELADA'
          AND r.data_reserva >= CURDATE() - INTERVAL 6 DAY
        GROUP BY DATE(r.data_reserva)
    """, (id_loja,))
    vendidos = {linha["dia"]: int(linha["quantidade"]) for linha in por_dia}
    hoje = date.today()
    semana = []
    for i in range(6, -1, -1):
        dia = hoje - timedelta(days=i)
        semana.append({"dia": dia, "rotulo": DIAS_CURTOS[dia.weekday()], "quantidade": vendidos.get(dia, 0)})

    ultimas = buscar_todos(conn, f"""
        SELECT r.id_reserva, r.codigo_retirada, r.status, r.quantidade, r.data_reserva,
               r.data_limite_retirada, r.data_retirada, a.nome AS sacola, {nome_curto_sql('u.nome')} AS cliente
        FROM reservas r
        JOIN alimentos a ON a.id_alimento = r.id_alimento
        JOIN usuarios u ON u.id_usuario = r.id_usuario
        WHERE a.id_estabelecimento = %s
        ORDER BY r.data_reserva DESC LIMIT 5
    """, (id_loja,))
    return {"loja": loja, **numeros, "vendas_7_dias": semana, "ultimas_reservas": ultimas}


# ------------------------------------------------------------------ sacolas
def _sacola_da_loja(conn, id_alimento, id_loja, travar=False):
    sacola = buscar_um(conn, "SELECT * FROM alimentos WHERE id_alimento = %s AND id_estabelecimento = %s"
                             + (" FOR UPDATE" if travar else ""), (id_alimento, id_loja))
    if sacola is None:
        raise HTTPException(404, "Sacola não encontrada na sua loja.")
    return sacola


def _datas_da_sacola(conn, dados: Sacola):
    inicio = datetime.combine(dados.data, dados.inicio_retirada)
    fim = datetime.combine(dados.data, dados.fim_retirada)
    validade = dados.validade or datetime.combine(dados.data, time(23, 59))
    if validade < fim:
        raise HTTPException(422, "A validade não pode acabar antes do fim da retirada.")
    if not buscar_um(conn, "SELECT id_categoria FROM categorias WHERE id_categoria = %s", (dados.id_categoria,)):
        raise HTTPException(422, "Escolha uma categoria da lista.")
    return inicio, fim, validade


def _no_futuro(conn, momento):
    return bool(buscar_um(conn, "SELECT %s > NOW() AS ok", (momento,))["ok"])


CAMPOS_SACOLA_PAINEL = """
    a.id_alimento, a.nome, a.descricao, a.id_categoria, c.nome AS categoria, a.quantidade, a.quantidade_inicial,
    (a.quantidade_inicial - a.quantidade) AS reservadas, a.preco_original, a.preco,
    ROUND((1 - a.preco / a.preco_original) * 100) AS desconto, a.peso_estimado_kg,
    COALESCE(a.foto, c.imagem) AS foto, a.validade, a.inicio_retirada, a.fim_retirada, a.status, a.data_cadastro,
    (SELECT COUNT(*) FROM reservas r WHERE r.id_alimento = a.id_alimento AND r.status = 'PENDENTE') AS reservas_pendentes
"""


@router.get("/sacolas")
def minhas_sacolas(periodo: Literal["ativas", "todas"] = "ativas",
                   loja=Depends(minha_loja), conn=Depends(get_db)):
    """Sacolas da loja. "ativas" = rascunhos e as que ainda estão no horário."""
    atualizar_vencidos(conn)
    if periodo == "ativas":
        filtro = "(a.status = 'RASCUNHO' OR (a.fim_retirada > NOW() AND a.status IN ('DISPONIVEL', 'RESERVADO')))"
    else:
        filtro = "a.data_cadastro >= NOW() - INTERVAL 30 DAY"
    return buscar_todos(conn, f"""
        SELECT {CAMPOS_SACOLA_PAINEL}
        FROM alimentos a JOIN categorias c ON c.id_categoria = a.id_categoria
        WHERE a.id_estabelecimento = %s AND {filtro}
        ORDER BY FIELD(a.status, 'DISPONIVEL', 'RESERVADO', 'RASCUNHO', 'VENCIDO', 'INDISPONIVEL'),
                 a.inicio_retirada DESC
    """, (loja["id_estabelecimento"],))


def _sacola_completa(conn, id_alimento):
    return buscar_um(conn, f"SELECT {CAMPOS_SACOLA_PAINEL} FROM alimentos a "
                           "JOIN categorias c ON c.id_categoria = a.id_categoria WHERE a.id_alimento = %s",
                     (id_alimento,))


@router.post("/sacolas", status_code=status.HTTP_201_CREATED)
def cadastrar_sacola(dados: Sacola, loja=Depends(minha_loja), conn=Depends(get_db)):
    """Tela 6.7: publica uma sacola ou salva como rascunho (RF04, RN03, RS04)."""
    inicio, fim, validade = _datas_da_sacola(conn, dados)
    if not dados.rascunho and not _no_futuro(conn, fim):
        raise HTTPException(422, "O horário de retirada já passou. Escolha um horário futuro.")
    id_alimento = inserir(conn, """
        INSERT INTO alimentos (id_estabelecimento, id_categoria, nome, descricao, quantidade, quantidade_inicial,
            preco_original, preco, peso_estimado_kg, foto, validade, inicio_retirada, fim_retirada, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (loja["id_estabelecimento"], dados.id_categoria, dados.nome, dados.descricao, dados.quantidade,
          dados.quantidade, dados.preco_original, dados.preco, dados.peso_estimado_kg, dados.foto or None,
          validade, inicio, fim, "RASCUNHO" if dados.rascunho else "DISPONIVEL"))
    conn.commit()
    return _sacola_completa(conn, id_alimento)


@router.put("/sacolas/{id_alimento}")
def editar_sacola(id_alimento: int, dados: Sacola, loja=Depends(minha_loja), conn=Depends(get_db)):
    """Edita a sacola, inclusive a quantidade disponível (RF10)."""
    conn.begin()
    sacola = _sacola_da_loja(conn, id_alimento, loja["id_estabelecimento"], travar=True)
    if sacola["status"] in ("VENCIDO", "INDISPONIVEL"):
        conn.rollback()
        raise HTTPException(409, "Esta sacola já foi encerrada e não pode ser editada.")
    inicio, fim, validade = _datas_da_sacola(conn, dados)
    if sacola["status"] != "RASCUNHO" and not _no_futuro(conn, fim):
        conn.rollback()
        raise HTTPException(422, "O horário de retirada já passou. Escolha um horário futuro.")

    reservadas = sacola["quantidade_inicial"] - sacola["quantidade"]  # sacolas já com dono
    novo_status = sacola["status"]
    if novo_status != "RASCUNHO":
        novo_status = "DISPONIVEL" if dados.quantidade > 0 else "RESERVADO"
    executar(conn, """
        UPDATE alimentos SET id_categoria = %s, nome = %s, descricao = %s, quantidade = %s, quantidade_inicial = %s,
            preco_original = %s, preco = %s, peso_estimado_kg = %s, foto = %s, validade = %s,
            inicio_retirada = %s, fim_retirada = %s, status = %s
        WHERE id_alimento = %s
    """, (dados.id_categoria, dados.nome, dados.descricao, dados.quantidade, reservadas + dados.quantidade,
          dados.preco_original, dados.preco, dados.peso_estimado_kg, dados.foto or sacola["foto"], validade,
          inicio, fim, novo_status, id_alimento))
    conn.commit()
    return _sacola_completa(conn, id_alimento)


@router.post("/sacolas/{id_alimento}/publicar")
def publicar_sacola(id_alimento: int, loja=Depends(minha_loja), conn=Depends(get_db)):
    sacola = _sacola_da_loja(conn, id_alimento, loja["id_estabelecimento"])
    if sacola["status"] != "RASCUNHO":
        raise HTTPException(409, "Só rascunhos podem ser publicados.")
    if not _no_futuro(conn, sacola["fim_retirada"]):
        raise HTTPException(422, "O horário de retirada deste rascunho já passou. Edite a data antes de publicar.")
    executar(conn, "UPDATE alimentos SET status = 'DISPONIVEL' WHERE id_alimento = %s", (id_alimento,))
    conn.commit()
    return _sacola_completa(conn, id_alimento)


@router.post("/sacolas/{id_alimento}/remover")
def remover_sacola(id_alimento: int, loja=Depends(minha_loja), conn=Depends(get_db)):
    """Tira a sacola do catálogo (RF11, RN08). Reservas já feitas continuam valendo."""
    sacola = _sacola_da_loja(conn, id_alimento, loja["id_estabelecimento"])
    if sacola["status"] in ("VENCIDO", "INDISPONIVEL"):
        raise HTTPException(409, "Esta sacola já está fora do catálogo.")
    executar(conn, "UPDATE alimentos SET status = 'INDISPONIVEL' WHERE id_alimento = %s", (id_alimento,))
    conn.commit()
    return _sacola_completa(conn, id_alimento)


# ------------------------------------------------------------------ pedidos
@router.get("/reservas")
def reservas_da_loja(
    status_reserva: Optional[Literal["PENDENTE", "RETIRADA", "CANCELADA", "NAO_COMPARECEU"]]
    = Query(default=None, alias="status"),
    periodo: Literal["hoje", "semana", "mes"] = "hoje",
    loja=Depends(minha_loja), conn=Depends(get_db),
):
    """Tela 6.8 (Gestão de pedidos). A loja só vê as reservas dos próprios alimentos (RN10)."""
    atualizar_vencidos(conn)
    id_loja = loja["id_estabelecimento"]
    if periodo == "hoje":
        filtro, params = "a.id_estabelecimento = %s AND DATE(r.data_limite_retirada) = CURDATE()", [id_loja]
    else:
        dias = {"semana": 6, "mes": 29}[periodo]
        filtro = "a.id_estabelecimento = %s AND DATE(r.data_limite_retirada) >= CURDATE() - INTERVAL %s DAY"
        params = [id_loja, dias]
    if status_reserva:
        filtro += " AND r.status = %s"
        params.append(status_reserva)
    itens = buscar_todos(conn, f"""
        SELECT r.id_reserva, r.codigo_retirada, r.status, r.quantidade, r.valor_pago, r.data_reserva,
               r.data_limite_retirada, r.data_retirada, a.id_alimento, a.nome AS sacola,
               a.inicio_retirada, a.fim_retirada, {nome_curto_sql('u.nome')} AS cliente
        FROM reservas r
        JOIN alimentos a ON a.id_alimento = r.id_alimento
        JOIN usuarios u ON u.id_usuario = r.id_usuario
        WHERE {filtro}
        ORDER BY (r.status = 'PENDENTE') DESC,
                 CASE WHEN r.status = 'PENDENTE' THEN a.inicio_retirada END,  -- aguardando: a próxima retirada primeiro
                 r.data_reserva DESC                                          -- o resto: as mais recentes primeiro
    """, params)
    contadores = buscar_um(conn, """
        SELECT COALESCE(SUM(r.status = 'PENDENTE'), 0) AS aguardando,
               COALESCE(SUM(r.status = 'RETIRADA' AND DATE(r.data_retirada) = CURDATE()), 0) AS retirados_hoje,
               COALESCE(SUM(CASE WHEN r.status = 'PENDENTE' THEN r.valor_pago END), 0) AS valor_em_reservas
        FROM reservas r JOIN alimentos a ON a.id_alimento = r.id_alimento
        WHERE a.id_estabelecimento = %s
    """, (id_loja,))
    return {**contadores, "itens": itens}


@router.post("/reservas/confirmar-retirada")
def confirmar_retirada(dados: ConfirmarRetirada, loja=Depends(minha_loja), conn=Depends(get_db)):
    """O comerciante digita o código que o cliente mostra e confirma a entrega."""
    atualizar_vencidos(conn)
    conn.begin()
    reserva = buscar_um(conn, f"""
        SELECT r.id_reserva, r.status, r.quantidade, r.data_retirada, a.nome AS sacola,
               {nome_curto_sql('u.nome')} AS cliente
        FROM reservas r
        JOIN alimentos a ON a.id_alimento = r.id_alimento
        JOIN usuarios u ON u.id_usuario = r.id_usuario
        WHERE r.codigo_retirada = %s AND a.id_estabelecimento = %s
        FOR UPDATE
    """, (dados.codigo, loja["id_estabelecimento"]))
    if reserva is None:
        conn.rollback()
        raise HTTPException(404, f"O código {dados.codigo} não está nas reservas da sua loja.")
    if reserva["status"] != "PENDENTE":
        conn.rollback()
        motivos = {
            "RETIRADA": "Esta reserva já foi retirada.",
            "CANCELADA": "Esta reserva foi cancelada pelo cliente.",
            "NAO_COMPARECEU": "O prazo de retirada desta reserva já acabou.",
        }
        raise HTTPException(409, motivos[reserva["status"]])
    executar(conn, "UPDATE reservas SET status = 'RETIRADA', data_retirada = NOW() WHERE id_reserva = %s",
             (reserva["id_reserva"],))
    conn.commit()
    reserva.update(buscar_um(conn, "SELECT status, data_retirada FROM reservas WHERE id_reserva = %s",
                             (reserva["id_reserva"],)))
    return {"mensagem": f"Retirada confirmada: {reserva['quantidade']}x {reserva['sacola']} para {reserva['cliente']}",
            "reserva": reserva}


# ------------------------------------------------------------------ relatórios
@router.get("/relatorios")
def relatorios(dias: int = Query(default=30, ge=7, le=90), loja=Depends(minha_loja), conn=Depends(get_db)):
    """Tela 6.9: resultados da loja no período."""
    atualizar_vencidos(conn)
    id_loja = loja["id_estabelecimento"]
    vendas = buscar_um(conn, """
        SELECT
          COALESCE(SUM(CASE WHEN r.data_reserva >= NOW() - INTERVAL %s DAY THEN r.valor_pago END), 0) AS receita,
          COALESCE(SUM(CASE WHEN r.data_reserva < NOW() - INTERVAL %s DAY THEN r.valor_pago END), 0) AS receita_anterior,
          COALESCE(SUM(CASE WHEN r.data_reserva >= NOW() - INTERVAL %s DAY THEN r.quantidade END), 0) AS sacolas_vendidas,
          COALESCE(SUM(CASE WHEN r.data_reserva >= NOW() - INTERVAL %s DAY AND r.status = 'RETIRADA'
                            THEN a.peso_estimado_kg * r.quantidade END), 0) AS kg_vendidos
        FROM reservas r JOIN alimentos a ON a.id_alimento = r.id_alimento
        WHERE a.id_estabelecimento = %s AND r.status <> 'CANCELADA'
          AND r.data_reserva >= NOW() - INTERVAL %s DAY
    """, (dias, dias, dias, dias, id_loja, dias * 2))
    doado = buscar_um(conn, """
        SELECT COALESCE(SUM(d.quantidade_kg), 0) AS kg
        FROM doacoes d JOIN ofertas_doacao o ON o.id_oferta = d.id_oferta
        WHERE o.id_estabelecimento = %s AND d.status = 'RECEBIDA'
          AND d.data_recebimento >= NOW() - INTERVAL %s DAY
    """, (id_loja, dias))
    oferta = buscar_um(conn, """
        SELECT COALESCE(SUM(quantidade_inicial), 0) AS oferecidas, COALESCE(SUM(quantidade), 0) AS sobraram
        FROM alimentos WHERE id_estabelecimento = %s AND status IN ('VENCIDO', 'RESERVADO')
          AND fim_retirada >= NOW() - INTERVAL %s DAY AND fim_retirada < NOW()
    """, (id_loja, dias))
    notas = buscar_um(conn, "SELECT ROUND(AVG(nota), 1) AS media, COUNT(*) AS total FROM avaliacoes "
                            "WHERE id_estabelecimento = %s", (id_loja,))

    por_dia = buscar_todos(conn, """
        SELECT DATE(r.data_reserva) AS dia, SUM(r.valor_pago) AS valor
        FROM reservas r JOIN alimentos a ON a.id_alimento = r.id_alimento
        WHERE a.id_estabelecimento = %s AND r.status <> 'CANCELADA'
          AND r.data_reserva >= CURDATE() - INTERVAL %s DAY
        GROUP BY DATE(r.data_reserva)
    """, (id_loja, dias - 1))
    valores = {linha["dia"]: linha["valor"] for linha in por_dia}
    hoje = date.today()
    receita_diaria = [{"dia": hoje - timedelta(days=i), "valor": valores.get(hoje - timedelta(days=i), 0)}
                      for i in range(dias - 1, -1, -1)]

    categorias = buscar_todos(conn, """
        SELECT c.nome AS categoria, SUM(r.quantidade) AS quantidade
        FROM reservas r
        JOIN alimentos a ON a.id_alimento = r.id_alimento
        JOIN categorias c ON c.id_categoria = a.id_categoria
        WHERE a.id_estabelecimento = %s AND r.status <> 'CANCELADA'
          AND r.data_reserva >= NOW() - INTERVAL %s DAY
        GROUP BY c.id_categoria ORDER BY quantidade DESC
    """, (id_loja, dias))
    total_categorias = sum(int(c["quantidade"]) for c in categorias) or 1
    for c in categorias:
        c["percentual"] = round(int(c["quantidade"]) / total_categorias * 100)

    avaliacoes = buscar_todos(conn, f"""
        SELECT v.nota, v.comentario, v.data_avaliacao, {nome_curto_sql('u.nome')} AS cliente
        FROM avaliacoes v JOIN usuarios u ON u.id_usuario = v.id_usuario
        WHERE v.id_estabelecimento = %s AND v.comentario IS NOT NULL
        ORDER BY v.data_avaliacao DESC LIMIT 3
    """, (id_loja,))

    receita, anterior = float(vendas["receita"]), float(vendas["receita_anterior"])
    kg = float(vendas["kg_vendidos"]) + float(doado["kg"])
    oferecidas = int(oferta["oferecidas"])
    return {
        "dias": dias,
        "receita": round(receita, 2),
        "variacao_receita": round((receita - anterior) / anterior * 100, 1) if anterior else None,
        "sacolas_vendidas": int(vendas["sacolas_vendidas"]),
        "kg_salvos": round(kg, 1),
        "kg_doados": round(float(doado["kg"]), 1),
        "refeicoes": refeicoes(kg),
        "aproveitamento": round((oferecidas - int(oferta["sobraram"])) / oferecidas * 100) if oferecidas else None,
        "nota_media": notas["media"],
        "total_avaliacoes": notas["total"],
        "receita_diaria": receita_diaria,
        "vendas_por_categoria": categorias,
        "avaliacoes_recentes": avaliacoes,
    }
