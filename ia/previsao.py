"""Previsão de sobras com regressão linear (RF15, RF16, RN13, RN14, RNF28, RNF29).

A pergunta que o modelo responde: "de cada sacola que esta loja oferecer,
que fração deve sobrar?". Ele aprende com todas as sacolas que já passaram
do horário, olhando quatro coisas:

    dia da semana  -> segunda costuma sobrar mais que sábado?
    categoria      -> padaria sobra mais que refeição?
    loja           -> cada loja tem seu ritmo
    dias corridos  -> a plataforma está crescendo e sobrando menos?

As três primeiras são categorias (não números), então viram colunas de 0 e
1 com o OneHotEncoder. A regressão linear soma um peso para cada coluna.
Depois a fração prevista é multiplicada pelo número de sacolas que a loja
costuma oferecer naquele dia, e vira "sacolas que devem sobrar".

O resultado é sempre uma ESTIMATIVA (RN14): o próprio retorno mostra o erro
médio do modelo medido em dados que ele não viu no treino.
"""

import time as relogio
from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from app.database import buscar_todos

DIAS = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]
COLUNAS_CATEGORICAS = ["dia_semana", "id_categoria", "id_estabelecimento"]
COLUNAS = COLUNAS_CATEGORICAS + ["dias_corridos"]
MINIMO_DE_AMOSTRAS = 40
VALIDADE_DO_MODELO_S = 15 * 60  # retreina no máximo a cada 15 minutos

_cache = {"treinado_em": 0.0, "modelo": None, "metricas": None, "inicio": None}


def carregar_historico(conn) -> pd.DataFrame:
    """Uma linha por sacola encerrada, com a fração que sobrou."""
    linhas = buscar_todos(conn, """
        SELECT a.id_estabelecimento, a.id_categoria, c.nome AS categoria,
               WEEKDAY(a.fim_retirada) AS dia_semana, DATE(a.fim_retirada) AS dia,
               a.quantidade_inicial, a.quantidade AS sobra, a.peso_estimado_kg
        FROM alimentos a JOIN categorias c ON c.id_categoria = a.id_categoria
        WHERE a.fim_retirada < NOW() AND a.status IN ('VENCIDO', 'RESERVADO') AND a.quantidade_inicial > 0
    """)
    df = pd.DataFrame(linhas)
    if df.empty:
        return df
    df["dia"] = pd.to_datetime(df["dia"])
    for coluna in ("quantidade_inicial", "sobra", "peso_estimado_kg"):
        df[coluna] = df[coluna].astype(float)
    df["taxa_sobra"] = df["sobra"] / df["quantidade_inicial"]
    return df


def treinar(df: pd.DataFrame):
    """Treina a regressão e mede o erro em 20% dos dados guardados para teste."""
    inicio = df["dia"].min()
    df = df.assign(dias_corridos=(df["dia"] - inicio).dt.days)
    preparo = ColumnTransformer(
        [("categorias", OneHotEncoder(handle_unknown="ignore"), COLUNAS_CATEGORICAS)],
        remainder="passthrough",  # dias_corridos entra como número
    )
    modelo = Pipeline([("preparo", preparo), ("regressao", LinearRegression())])

    X, y = df[COLUNAS], df["taxa_sobra"]
    X_treino, X_teste, y_treino, y_teste = train_test_split(X, y, test_size=0.2, random_state=42)
    modelo.fit(X_treino, y_treino)
    previsto = np.clip(modelo.predict(X_teste), 0, 1)
    metricas = {
        "tipo": "Regressão linear (scikit-learn)",
        "amostras": int(len(df)),
        "r2": round(float(r2_score(y_teste, previsto)), 2),
        "erro_medio_pontos": round(float(mean_absolute_error(y_teste, previsto)) * 100, 1),
    }
    modelo.fit(X, y)  # depois de medir, treina de novo com tudo
    return modelo, metricas, inicio


def _modelo(conn):
    agora = relogio.time()
    if _cache["modelo"] is None or agora - _cache["treinado_em"] > VALIDADE_DO_MODELO_S:
        df = carregar_historico(conn)
        if len(df) < MINIMO_DE_AMOSTRAS:
            return None, df
        _cache["modelo"], _cache["metricas"], _cache["inicio"] = treinar(df)
        _cache["treinado_em"] = agora
        _cache["historico"] = df
    return _cache["modelo"], _cache["historico"]


def prever_sobras(conn, id_estabelecimento: int, dias: int = 7) -> dict:
    """Previsão para os próximos dias de uma loja, no formato que o painel mostra."""
    aviso = ("Estimativa feita por um modelo estatístico com o histórico da plataforma. "
             "Use como referência, não como garantia.")
    modelo, historico = _modelo(conn)
    if modelo is None:
        return {"suficiente": False, "aviso": "Ainda não há histórico suficiente para prever sobras.", "dias": []}

    da_loja = historico[historico["id_estabelecimento"] == id_estabelecimento]
    recentes = da_loja[da_loja["dia"] >= da_loja["dia"].max() - pd.Timedelta(days=28)] if len(da_loja) else da_loja
    if recentes.empty:
        return {"suficiente": False, "aviso": "Sua loja ainda não tem sacolas encerradas para prever.", "dias": []}

    # Quanto a loja costuma oferecer de cada categoria, por dia da semana
    semanas = max(1, round((recentes["dia"].max() - recentes["dia"].min()).days / 7))
    oferta = (recentes.groupby(["id_categoria", "categoria", "dia_semana"])
              .agg(unidades=("quantidade_inicial", "sum"), peso=("peso_estimado_kg", "mean"))
              .reset_index())
    oferta["unidades"] = oferta["unidades"] / semanas

    resultado = []
    hoje = date.today()
    for i in range(1, dias + 1):
        dia = hoje + timedelta(days=i)
        do_dia = oferta[oferta["dia_semana"] == dia.weekday()]
        por_categoria = []
        if not do_dia.empty:
            entrada = pd.DataFrame({
                "dia_semana": dia.weekday(),
                "id_categoria": do_dia["id_categoria"].values,
                "id_estabelecimento": id_estabelecimento,
                "dias_corridos": (pd.Timestamp(dia) - _cache["inicio"]).days,
            })[COLUNAS]
            taxas = np.clip(modelo.predict(entrada), 0, 1)
            for (_, linha), taxa in zip(do_dia.iterrows(), taxas):
                sobra = taxa * linha["unidades"]
                por_categoria.append({
                    "categoria": linha["categoria"],
                    "oferta_media": round(float(linha["unidades"]), 1),
                    "taxa_sobra": round(float(taxa) * 100),
                    "sacolas": round(float(sobra), 1),
                    "kg": round(float(sobra * linha["peso"]), 1),
                })
        por_categoria.sort(key=lambda c: c["sacolas"], reverse=True)
        resultado.append({
            "data": dia,
            "dia_semana": DIAS[dia.weekday()],
            "sacolas": round(sum(c["sacolas"] for c in por_categoria), 1),
            "kg": round(sum(c["kg"] for c in por_categoria), 1),
            "por_categoria": por_categoria,
        })

    pior = max(resultado, key=lambda d: d["sacolas"])
    sugestao = None
    if pior["sacolas"] >= 1 and pior["por_categoria"]:
        cat = pior["por_categoria"][0]
        sugestao = (f"Na {pior['dia_semana']} ({pior['data']:%d/%m}) devem sobrar cerca de "
                    f"{pior['sacolas']:.0f} sacolas, principalmente de {cat['categoria'].lower()}. "
                    "Ofereça menos unidades nesse dia ou cadastre a sobra como doação.")
    return {
        "suficiente": True,
        "aviso": aviso,
        "modelo": _cache["metricas"],
        "dias": resultado,
        "maior_sobra": {"data": pior["data"], "dia_semana": pior["dia_semana"], "sacolas": pior["sacolas"]},
        "sugestao": sugestao,
    }
