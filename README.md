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

## Endpoints

### `GET /cep/:numeroCEP`

- `numeroCEP` deve ter 8 digitos (ex: `01001000`).
- A API tenta, nesta ordem: ViaCEP, BrasilAPI, AwesomeAPI.
- Se um falhar, tenta o proximo.

### `GET /cep/:numeroCEP/multiple`

- Consulta todos os provedores em paralelo e retorna o resultado completo.
- Retorna `200` quando o CEP eh valido, mesmo que algum provedor falhe.
- Falhas sao reportadas por provedor em `providers[].ok` e `providers[].error`.
- Retorna `400` se o CEP nao tiver 8 digitos.

Exemplo:

```bash
curl http://localhost:3004/cep/01001000/multiple
```

Esse comando consulta todos os provedores e retorna um array com o resultado de cada um.

Estrutura da resposta (tipos):

```json
{
  "cep": "string (8 digitos)",
  "providers": [
    {
      "provider": "string (viacep | brasilapi | awesomeapi)",
      "ok": "boolean",
      "data": {
        "cep": "string | null",
        "logradouro": "string | null",
        "complemento": "string | null",
        "bairro": "string | null",
        "localidade": "string | null",
        "uf": "string | null",
        "ibge": "string | null",
        "gia": "string | null",
        "ddd": "string | null",
        "siafi": "string | null",
        "provider": "string"
      },
      "error": "string | null"
    }
  ]
}
```

Exemplo de resposta (provedor com falha):

```json
{
  "cep": "01001000",
  "providers": [
    {
      "provider": "viacep",
      "ok": true,
      "data": {
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
      },
      "error": null
    },
    {
      "provider": "brasilapi",
      "ok": true,
      "data": {
        "cep": "01001000",
        "logradouro": "Praca da Se",
        "complemento": null,
        "bairro": "Se",
        "localidade": "Sao Paulo",
        "uf": "SP",
        "ibge": "3550308",
        "gia": null,
        "ddd": null,
        "siafi": null,
        "provider": "brasilapi"
      },
      "error": null
    },
    {
      "provider": "awesomeapi",
      "ok": false,
      "data": null,
      "error": "CEP nao encontrado no provedor"
    }
  ]
}
```

Exemplo de erro (CEP invalido):

```json
{
  "error": "CEP invalido. Use 8 digitos, ex: 01001000"
}
```

### `GET /health`

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

Resposta com falha (503):

```json
{
  "status": "degraded",
  "cepTest": "01001000",
  "providers": [
    {
      "provider": "viacep",
      "url": "https://viacep.com.br/ws/01001000/json/",
      "ok": false,
      "responseTimeMs": 5012,
      "error": "Timeout ao consultar provedor"
    }
  ]
}
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

## Erros gerais

Estrutura (com `details` opcional):

```json
{
  "error": "string",
  "details": [
    { "provider": "string", "message": "string" }
  ]
}
```

O campo `details` aparece apenas quando ha falha nos provedores.

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

Metodo nao permitido (405):

```json
{
  "error": "Metodo nao permitido"
}
```

Rota nao encontrada (404):

```json
{
  "error": "Rota nao encontrada"
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
