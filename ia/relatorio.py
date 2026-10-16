"""Relatório do modelo de previsão de sobras, para o documento da disciplina.

Uso: python -m ia.relatorio

Treina o mesmo modelo que a API usa (ia/previsao.py), mede o erro e salva em
docs/ia/:
  - sobra_por_dia.png: quanto sobra em média em cada dia da semana,
    o que aconteceu de verdade x o que o modelo prevê;
  - pesos_do_modelo.png: quanto cada dia e cada categoria somam ou tiram
    da taxa de sobra (os coeficientes da regressão);
  - RESULTADO.md: os números, em texto.
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # gera arquivos de imagem sem abrir janela
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

from app.database import conectar  # noqa: E402
from ia.previsao import COLUNAS, DIAS, carregar_historico, treinar  # noqa: E402

PASTA = Path(__file__).resolve().parent.parent / "docs" / "ia"
VERDE, LARANJA, CINZA = "#2d6a4f", "#f4a261", "#8a9496"


def main():
    conn = conectar()
    df = carregar_historico(conn)
    conn.close()
    modelo, metricas, inicio = treinar(df)
    df = df.assign(dias_corridos=(df["dia"] - inicio).dt.days)
    df["previsto"] = np.clip(modelo.predict(df[COLUNAS]), 0, 1)
    PASTA.mkdir(parents=True, exist_ok=True)

    # 1. Taxa de sobra por dia da semana: real x previsto
    por_dia = df.groupby("dia_semana")[["taxa_sobra", "previsto"]].mean() * 100
    rotulos = [d.split("-")[0].capitalize() for d in DIAS]
    x = np.arange(7)
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.bar(x - 0.2, por_dia["taxa_sobra"], 0.4, label="Real (histórico)", color=VERDE)
    ax.bar(x + 0.2, por_dia["previsto"], 0.4, label="Previsto pelo modelo", color=LARANJA)
    ax.set_xticks(x, rotulos)
    ax.set_ylabel("% das sacolas que sobraram")
    ax.set_title("Sobra média por dia da semana")
    ax.legend(frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(PASTA / "sobra_por_dia.png", dpi=150)
    plt.close(fig)

    # 2. Pesos da regressão (coeficientes) de dia da semana e categoria
    preparo = modelo.named_steps["preparo"]
    nomes = preparo.get_feature_names_out()
    coef = modelo.named_steps["regressao"].coef_
    categorias = dict(zip(df["id_categoria"], df["categoria"]))
    pesos = []
    for nome, valor in zip(nomes, coef):
        if nome.startswith("categorias__dia_semana_"):
            pesos.append((DIAS[int(nome.rsplit("_", 1)[1])].split("-")[0].capitalize(), valor))
        elif nome.startswith("categorias__id_categoria_"):
            pesos.append((categorias[int(nome.rsplit("_", 1)[1])], valor))
    # one-hot: o que importa é a diferença entre os pesos, então centralizamos cada grupo
    media_dias = np.mean([v for n, v in pesos[:7]])
    media_cat = np.mean([v for n, v in pesos[7:]])
    pesos = [(n, (v - (media_dias if i < 7 else media_cat)) * 100) for i, (n, v) in enumerate(pesos)]
    fig, ax = plt.subplots(figsize=(8, 5))
    nomes_p, valores = zip(*pesos)
    cores = [VERDE if v < 0 else LARANJA for v in valores]
    ax.barh(range(len(valores)), valores, color=cores)
    ax.set_yticks(range(len(valores)), nomes_p)
    ax.axvline(0, color=CINZA, linewidth=1)
    ax.axhline(6.5, color=CINZA, linewidth=0.5, linestyle="--")
    ax.invert_yaxis()
    ax.set_xlabel("pontos percentuais de sobra (acima ou abaixo da média)")
    ax.set_title("O que o modelo aprendeu")
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(PASTA / "pesos_do_modelo.png", dpi=150)
    plt.close(fig)

    tendencia = coef[-1] * 100 * 30  # efeito de "dias_corridos" em 30 dias
    texto = f"""# Resultado do modelo de previsão de sobras

Gerado por `python -m ia.relatorio`.

- Modelo: {metricas['tipo']}
- Sacolas analisadas: {metricas['amostras']}
- R² nos dados de teste: {metricas['r2']} (de 0 a 1; quanto da variação da sobra o modelo explica)
- Erro médio: {metricas['erro_medio_pontos']} pontos percentuais (em média, a previsão fica a essa distância da sobra real: se sobraram 30%, o modelo costuma dizer algo entre {30 - metricas['erro_medio_pontos']:.0f}% e {30 + metricas['erro_medio_pontos']:.0f}%)
- Tendência: a cada 30 dias a sobra muda {tendencia:+.1f} pontos percentuais

## Sobra média por dia da semana

| Dia | Real | Previsto |
|---|---|---|
""" + "\n".join(f"| {rotulos[i]} | {por_dia['taxa_sobra'].iloc[i]:.0f}% | {por_dia['previsto'].iloc[i]:.0f}% |"
                for i in range(7)) + """

![Sobra por dia](sobra_por_dia.png)

![Pesos do modelo](pesos_do_modelo.png)

Os dados são do histórico gerado por `ia/gerar_historico.py` (12 semanas
simuladas). Com dados reais das lojas, basta rodar este script de novo:
o modelo é treinado a partir do que estiver no banco (RNF28).
"""
    (PASTA / "RESULTADO.md").write_text(texto, encoding="utf-8")
    print(f"R² {metricas['r2']} | erro médio {metricas['erro_medio_pontos']} pontos | "
          f"{metricas['amostras']} sacolas. Arquivos em {PASTA}")


if __name__ == "__main__":
    main()
