# Busca CEP API

API simples em Node.js puro para consultar CEP com fallback entre provedores publicos.

## Requisitos

- Node.js 18+

## Como executar

```bash
npm start
```

Ou:

```bash
node server.js
```

A API sobe em `http://localhost:3004` (ou porta definida em `PORT`).

## Endpoint

`GET /cep/:numeroCEP`

- `numeroCEP` deve ter 8 digitos (ex: `01001000`).
- A API tenta, nesta ordem: ViaCEP, BrasilAPI, AwesomeAPI.
- Se um falhar, tenta o proximo.

## Endpoint multiplo

`GET /cep/:numeroCEP/multiple`

- Consulta todos os provedores em paralelo e retorna o resultado completo.
- Sempre retorna `200` com o resumo de cada provedor.

Exemplo:

```bash
curl http://localhost:3004/cep/01001000/multiple
```

## Health check

`GET /health`

- Testa a saude de cada provedor em uma unica rota.
- Retorna `200` se todos estiverem ok, `503` se algum falhar.
- CEP de teste padrao: `01001000` (pode sobrescrever por query ou `HEALTH_TEST_CEP`).

Exemplo:

```bash
curl "http://localhost:3004/health"
```

Com CEP customizado:

```bash
curl "http://localhost:3004/health?cep=01001000"
```

## Exemplo

```bash
curl http://localhost:3004/cep/01001000
```

Resposta de sucesso (200):

```json
{
  "cep": "01001000",
  "logradouro": "Praca da Se",
  "complemento": "lado impar",
  "bairro": "Se",
  "localidade": "Sao Paulo",
  "uf": "SP",
  "ibge": "3550308",
  "gia": "1004",
  "ddd": "11",
  "siafi": "7107",
  "provider": "viacep"
}
```

## Erros

CEP invalido (400):

```json
{
  "error": "CEP invalido. Use 8 digitos, ex: 01001000"
}
```

CEP nao encontrado (404):

```json
{
  "error": "CEP nao encontrado"
}
```

Falha nos provedores (502):

```json
{
  "error": "Falha ao consultar provedores de CEP",
  "details": [
    { "provider": "viacep", "message": "ViaCEP status 500" }
  ]
}
```
