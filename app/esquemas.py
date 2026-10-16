"""Formatos dos dados que a API recebe (Pydantic).

Cada classe descreve um JSON de entrada. O FastAPI confere o JSON contra a
classe antes de chamar a rota: campo faltando, texto curto demais ou número
negativo voltam como erro 422 sem a rota nem rodar (RNF08).
"""

import re
from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, ValidationInfo, field_validator

EMAIL_VALIDO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TIPOS_LOJA = Literal["PADARIA", "MERCADO", "RESTAURANTE", "HORTIFRUTI", "CAFE", "OUTRO"]


# ---------------------------------------------------------------- contas
class Cadastro(BaseModel):
    nome: str = Field(min_length=3, max_length=100)
    email: str = Field(max_length=150)
    senha: str = Field(min_length=6, max_length=72)  # o bcrypt só usa os 72 primeiros bytes
    telefone: Optional[str] = Field(default=None, max_length=20)
    tipo: Literal["COMUM", "ESTABELECIMENTO", "ONG"]

    @field_validator("nome")
    @classmethod
    def limpar_nome(cls, v):
        return " ".join(v.split())

    @field_validator("email")
    @classmethod
    def validar_email(cls, v):
        v = v.strip().lower()
        if not EMAIL_VALIDO.match(v):
            raise ValueError("Informe um e-mail válido, como nome@exemplo.com.")
        return v


class Login(BaseModel):
    email: str = Field(max_length=150)
    senha: str = Field(max_length=72)

    @field_validator("email")
    @classmethod
    def normalizar_email(cls, v):
        return v.strip().lower()


# ---------------------------------------------------------------- perfis
class Endereco(BaseModel):
    endereco: str = Field(min_length=5, max_length=200)
    bairro: Optional[str] = Field(default=None, max_length=100)
    cidade: str = Field(min_length=2, max_length=100)
    uf: Optional[str] = Field(default=None, min_length=2, max_length=2)
    cep: Optional[str] = Field(default=None, max_length=10)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class DadosLoja(Endereco):
    nome: str = Field(min_length=3, max_length=150)
    cnpj: Optional[str] = Field(default=None, max_length=18)
    telefone: Optional[str] = Field(default=None, max_length=20)
    tipo: TIPOS_LOJA = "OUTRO"
    descricao: Optional[str] = Field(default=None, max_length=255)
    horario_abertura: Optional[time] = None
    horario_fechamento: Optional[time] = None


class DadosOng(Endereco):
    nome: str = Field(min_length=3, max_length=150)
    cnpj: Optional[str] = Field(default=None, max_length=18)
    telefone: Optional[str] = Field(default=None, max_length=20)
    responsavel: Optional[str] = Field(default=None, max_length=100)


# ---------------------------------------------------------------- sacolas
class Sacola(BaseModel):
    """Os campos da tela 6.7 (Cadastrar Sacola)."""

    nome: str = Field(min_length=3, max_length=150)
    id_categoria: int
    descricao: Optional[str] = Field(default=None, max_length=500)
    preco_original: Decimal = Field(gt=0, le=9999, decimal_places=2)
    preco: Decimal = Field(gt=0, le=9999, decimal_places=2)
    quantidade: int = Field(ge=1, le=100)
    peso_estimado_kg: Decimal = Field(default=Decimal("1.00"), gt=0, le=50, decimal_places=2)
    data: date
    inicio_retirada: time
    fim_retirada: time
    validade: Optional[datetime] = None  # se vier vazio, vale até o fim do dia da retirada
    foto: Optional[str] = Field(default=None, max_length=255)
    rascunho: bool = False

    @field_validator("foto")
    @classmethod
    def validar_foto(cls, v):
        # Só aceitamos as imagens do próprio site. Um texto livre aqui iria
        # parar dentro de <img src="..."> no navegador de outras pessoas.
        if v and not re.fullmatch(r"img/[a-z0-9/_-]+\.(jpg|jpeg|png|webp)", v):
            raise ValueError("Escolha uma das imagens do Refood (caminho começando com img/).")
        return v or None

    # Regras que comparam dois campos. Ficam no segundo campo de cada par para
    # o erro voltar com o nome dele ("preco", "fim_retirada") e o front
    # destacar o campo certo. info.data tem os campos já validados antes.
    @field_validator("preco")
    @classmethod
    def preco_menor_que_original(cls, v, info: ValidationInfo):
        original = info.data.get("preco_original")
        if original is not None and v > original:
            raise ValueError("O preço Refood não pode ser maior que o preço original.")
        return v

    @field_validator("fim_retirada")
    @classmethod
    def fim_depois_do_inicio(cls, v, info: ValidationInfo):
        inicio = info.data.get("inicio_retirada")
        if inicio is not None and v <= inicio:
            raise ValueError("O fim da retirada precisa ser depois do início.")
        return v


# ---------------------------------------------------------------- reservas
class NovaReserva(BaseModel):
    id_alimento: int
    quantidade: int = Field(default=1, ge=1, le=5)
    forma_pagamento: Literal["CARTAO", "PIX"] = "PIX"


class NovaAvaliacao(BaseModel):
    nota: int = Field(ge=1, le=5)
    comentario: Optional[str] = Field(default=None, max_length=500)


class ConfirmarRetirada(BaseModel):
    codigo: str = Field(min_length=4, max_length=12)

    @field_validator("codigo")
    @classmethod
    def normalizar_codigo(cls, v):
        v = v.strip().upper().lstrip("#")
        return v if v.startswith("RF-") else f"RF-{v}"


# ---------------------------------------------------------------- doações
class NovaOfertaDoacao(BaseModel):
    tipo_alimento: str = Field(min_length=3, max_length=100)
    quantidade_kg: Decimal = Field(gt=0, le=1000, decimal_places=2)
    disponivel_ate: datetime
    observacoes: Optional[str] = Field(default=None, max_length=300)


class NovaSolicitacao(BaseModel):
    id_oferta: int
    quantidade_kg: Decimal = Field(gt=0, le=1000, decimal_places=2)
    data_retirada: datetime
    observacoes: Optional[str] = Field(default=None, max_length=500)
