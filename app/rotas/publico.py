"""Rotas abertas, que não exigem login: catálogo, mapa e páginas das lojas."""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app import config
from app.database import buscar_todos, buscar_um, conectar, get_db
from app.util import distancia_sql, nome_curto_sql, refeicoes

router = APIRouter(prefix="/api", tags=["Público"])

# As condições que fazem uma sacola aparecer no catálogo (RN04, RN06, RS03, RS04)
SACOLA_DISPONIVEL = (
    "a.status = 'DISPONIVEL' AND a.quantidade > 0 "
    "AND a.fim_retirada > NOW() AND a.validade > NOW()"
)

# Campos de uma sacola, já com a loja e a categoria. O %s, %s da distância
# recebe longitude e latitude de quem está buscando.
CAMPOS_SACOLA = f"""
    a.id_alimento, a.nome, a.descricao, a.quantidade, a.quantidade_inicial,
    a.preco_original, a.preco, ROUND((1 - a.preco / a.preco_original) * 100) AS desconto,
    a.peso_estimado_kg, COALESCE(a.foto, c.imagem) AS foto,
    a.inicio_retirada, a.fim_retirada, a.validade, a.status, a.data_cadastro,
    c.id_categoria, c.nome AS categoria,
    e.id_estabelecimento, e.nome AS estabelecimento, e.tipo AS tipo_estabelecimento,
    e.endereco, e.bairro, e.cidade, e.latitude, e.longitude,
    {distancia_sql('e')} AS distancia_m
"""

JUNCAO_SACOLA = """
    FROM alimentos a
    JOIN estabelecimentos e ON e.id_estabelecimento = a.id_estabelecimento
    JOIN categorias c ON c.id_categoria = a.id_categoria
"""

ORDENACOES = {
    "proximo": "distancia_m, a.fim_retirada",
    "preco": "a.preco, distancia_m",
    "desconto": "desconto DESC, distancia_m",
    "termina": "a.fim_retirada, distancia_m",
}


def _ponto(lat, lng):
    """Localização de quem busca; sem ela, usamos o centro de Pinheiros."""
    if lat is None or lng is None:
        return config.LOCAL_PADRAO
    return lat, lng


@router.get("/health", tags=["Sistema"])
def health():
    """Confere se a API e o banco estão de pé."""
    try:
        conn = conectar()
        buscar_um(conn, "SELECT 1 AS ok")
        conn.close()
    except Exception:
        return JSONResponse({"status": "erro", "banco": "fora do ar"}, status_code=503)
    return {"status": "ok", "banco": "ok"}


@router.get("/impacto")
def impacto(conn=Depends(get_db)):
    """Os números da página inicial: "A revolução sustentável já começou"."""
    vendas = buscar_um(conn, """
        SELECT COALESCE(SUM(a.peso_estimado_kg * r.quantidade), 0) AS kg,
               COALESCE(SUM((a.preco_original - a.preco) * r.quantidade), 0) AS economia
        FROM reservas r JOIN alimentos a ON a.id_alimento = r.id_alimento
        WHERE r.status = 'RETIRADA'
    """)
    doado = buscar_um(conn, "SELECT COALESCE(SUM(quantidade_kg), 0) AS kg FROM doacoes WHERE status = 'RECEBIDA'")
    lojas = buscar_um(conn, "SELECT COUNT(*) AS total FROM estabelecimentos")
    return {
        "kg_salvos": round(float(vendas["kg"]) + float(doado["kg"]), 1),
        "refeicoes_doadas": refeicoes(doado["kg"]),
        "economia_consumidores": vendas["economia"],
        "lojas_parceiras": lojas["total"],
    }


@router.get("/categorias")
def listar_categorias(conn=Depends(get_db)):
    return buscar_todos(conn, "SELECT id_categoria, nome, descricao, imagem FROM categorias ORDER BY id_categoria")


@router.get("/sacolas")
def catalogo(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    raio_km: Optional[float] = Query(default=None, gt=0, le=50),
    categoria: Optional[int] = None,
    estabelecimento: Optional[int] = None,
    busca: Optional[str] = Query(default=None, max_length=60),
    preco_max: Optional[float] = Query(default=None, gt=0),
    disponivel_agora: bool = False,
    ordem: Literal["proximo", "preco", "desconto", "termina"] = "proximo",
    limite: int = Query(default=12, ge=1, le=50),
    pagina: int = Query(default=1, ge=1),
    conn=Depends(get_db),
):
    """Catálogo de sacolas com busca e filtros (RF05, RF06, RF07)."""
    lat, lng = _ponto(lat, lng)
    filtros, params = [SACOLA_DISPONIVEL], []
    if categoria:
        filtros.append("a.id_categoria = %s")
        params.append(categoria)
    if estabelecimento:
        filtros.append("a.id_estabelecimento = %s")
        params.append(estabelecimento)
    if busca:
        filtros.append("(a.nome LIKE %s OR e.nome LIKE %s OR c.nome LIKE %s OR e.bairro LIKE %s)")
        params += [f"%{busca.strip()}%"] * 4
    if preco_max:
        filtros.append("a.preco <= %s")
        params.append(preco_max)
    if disponivel_agora:
        filtros.append("NOW() BETWEEN a.inicio_retirada AND a.fim_retirada")
    if raio_km:
        filtros.append(f"{distancia_sql('e')} <= %s")
        params += [lng, lat, raio_km * 1000]
    where = " AND ".join(filtros)

    total = buscar_um(conn, f"SELECT COUNT(*) AS total {JUNCAO_SACOLA} WHERE {where}", params)["total"]
    itens = buscar_todos(
        conn,
        f"SELECT {CAMPOS_SACOLA} {JUNCAO_SACOLA} WHERE {where} "
        f"ORDER BY {ORDENACOES[ordem]} LIMIT %s OFFSET %s",
        [lng, lat] + params + [limite, (pagina - 1) * limite],
    )
    return {"total": total, "pagina": pagina, "limite": limite, "itens": itens}


@router.get("/sacolas/{id_alimento}")
def detalhe_sacola(id_alimento: int, lat: Optional[float] = None, lng: Optional[float] = None,
                   conn=Depends(get_db)):
    lat, lng = _ponto(lat, lng)
    sacola = buscar_um(conn, f"""
        SELECT {CAMPOS_SACOLA}, e.telefone, e.foto AS foto_estabelecimento,
               ({SACOLA_DISPONIVEL}) AS disponivel,
               (SELECT ROUND(AVG(nota), 1) FROM avaliacoes v WHERE v.id_estabelecimento = e.id_estabelecimento) AS nota_media,
               (SELECT COUNT(*) FROM avaliacoes v WHERE v.id_estabelecimento = e.id_estabelecimento) AS total_avaliacoes
        {JUNCAO_SACOLA}
        WHERE a.id_alimento = %s AND a.status <> 'RASCUNHO'
    """, (lng, lat, id_alimento))
    if sacola is None:
        raise HTTPException(404, "Sacola não encontrada.")
    sacola["disponivel"] = bool(sacola["disponivel"])
    return sacola


@router.get("/estabelecimentos")
def mapa_estabelecimentos(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    raio_km: Optional[float] = Query(default=None, gt=0, le=50),
    tipo: Optional[str] = None,
    busca: Optional[str] = Query(default=None, max_length=60),
    conn=Depends(get_db),
):
    """Lojas para o mapa interativo, com quantas sacolas cada uma tem agora."""
    lat, lng = _ponto(lat, lng)
    filtros, params = ["1 = 1"], []
    if tipo:
        filtros.append("e.tipo = %s")
        params.append(tipo.upper())
    if busca:
        # tipo e descrição entram na busca: "hortifruti" acha o Mercado Sabor da Terra
        filtros.append("(e.nome LIKE %s OR e.bairro LIKE %s OR e.endereco LIKE %s OR e.tipo LIKE %s "
                       "OR e.descricao LIKE %s)")
        params += [f"%{busca.strip()}%"] * 5
    if raio_km:
        filtros.append(f"{distancia_sql('e')} <= %s")
        params += [lng, lat, raio_km * 1000]

    return buscar_todos(conn, f"""
        SELECT e.id_estabelecimento, e.nome, e.tipo, e.descricao, e.endereco, e.bairro, e.cidade,
               e.latitude, e.longitude, e.foto,
               TIME_FORMAT(e.horario_abertura, '%%H:%%i') AS horario_abertura,
               TIME_FORMAT(e.horario_fechamento, '%%H:%%i') AS horario_fechamento,
               {distancia_sql('e')} AS distancia_m,
               COALESCE(av.media, 0) AS nota_media, COALESCE(av.total, 0) AS total_avaliacoes,
               COALESCE(s.sacolas, 0) AS sacolas_disponiveis, COALESCE(s.unidades, 0) AS unidades_disponiveis,
               p.proximo_inicio, p.proximo_fim
        FROM estabelecimentos e
        LEFT JOIN (SELECT id_estabelecimento, ROUND(AVG(nota), 1) AS media, COUNT(*) AS total
                   FROM avaliacoes GROUP BY id_estabelecimento) av
               ON av.id_estabelecimento = e.id_estabelecimento
        LEFT JOIN (SELECT a.id_estabelecimento, COUNT(*) AS sacolas, SUM(a.quantidade) AS unidades
                   FROM alimentos a WHERE {SACOLA_DISPONIVEL} GROUP BY a.id_estabelecimento) s
               ON s.id_estabelecimento = e.id_estabelecimento
        LEFT JOIN (SELECT a.id_estabelecimento, a.inicio_retirada AS proximo_inicio, a.fim_retirada AS proximo_fim,
                          ROW_NUMBER() OVER (PARTITION BY a.id_estabelecimento ORDER BY a.inicio_retirada) AS n
                   FROM alimentos a WHERE {SACOLA_DISPONIVEL}) p
               ON p.id_estabelecimento = e.id_estabelecimento AND p.n = 1
        WHERE {" AND ".join(filtros)}
        ORDER BY distancia_m
    """, [lng, lat] + params)


@router.get("/estabelecimentos/{id_estabelecimento}")
def pagina_estabelecimento(id_estabelecimento: int, lat: Optional[float] = None,
                           lng: Optional[float] = None, conn=Depends(get_db)):
    """Tela 5.7: dados da loja, sacolas disponíveis agora e avaliações."""
    lat, lng = _ponto(lat, lng)
    loja = buscar_um(conn, f"""
        SELECT e.id_estabelecimento, e.nome, e.tipo, e.descricao, e.telefone, e.endereco, e.bairro,
               e.cidade, e.uf, e.latitude, e.longitude, e.foto,
               TIME_FORMAT(e.horario_abertura, '%%H:%%i') AS horario_abertura,
               TIME_FORMAT(e.horario_fechamento, '%%H:%%i') AS horario_fechamento,
               {distancia_sql('e')} AS distancia_m,
               (SELECT ROUND(AVG(nota), 1) FROM avaliacoes v WHERE v.id_estabelecimento = e.id_estabelecimento) AS nota_media,
               (SELECT COUNT(*) FROM avaliacoes v WHERE v.id_estabelecimento = e.id_estabelecimento) AS total_avaliacoes
        FROM estabelecimentos e WHERE e.id_estabelecimento = %s
    """, (lng, lat, id_estabelecimento))
    if loja is None:
        raise HTTPException(404, "Estabelecimento não encontrado.")

    loja["sacolas"] = buscar_todos(conn, f"""
        SELECT {CAMPOS_SACOLA} {JUNCAO_SACOLA}
        WHERE {SACOLA_DISPONIVEL} AND a.id_estabelecimento = %s
        ORDER BY a.inicio_retirada
    """, (lng, lat, id_estabelecimento))
    loja["avaliacoes"] = buscar_todos(conn, f"""
        SELECT v.nota, v.comentario, v.data_avaliacao, {nome_curto_sql('u.nome')} AS cliente
        FROM avaliacoes v JOIN usuarios u ON u.id_usuario = v.id_usuario
        WHERE v.id_estabelecimento = %s AND v.comentario IS NOT NULL
        ORDER BY v.data_avaliacao DESC LIMIT 6
    """, (id_estabelecimento,))
    return loja
