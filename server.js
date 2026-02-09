const http = require('http');
const https = require('https');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3004;

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function getJson(url, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'busca-cep-api/1.0' } },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let data = null;
          if (raw.length > 0) {
            try {
              data = JSON.parse(raw);
            } catch (err) {
              return reject(new Error('Invalid JSON response'));
            }
          }
          resolve({ status: res.statusCode || 0, data });
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Request timeout'));
    });
  });
}

function normalizeCep(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildNormalized(fields) {
  return {
    cep: fields.cep || null,
    logradouro: fields.logradouro ?? null,
    complemento: fields.complemento ?? null,
    bairro: fields.bairro ?? null,
    localidade: fields.localidade ?? null,
    uf: fields.uf ?? null,
    ibge: fields.ibge ?? null,
    gia: fields.gia ?? null,
    ddd: fields.ddd ?? null,
    siafi: fields.siafi ?? null,
    provider: fields.provider,
  };
}

async function fetchViaCEP(cep) {
  const { status, data } = await getJson(`https://viacep.com.br/ws/${cep}/json/`);
  if (status === 200 && data && !data.erro) {
    return buildNormalized({
      cep: normalizeCep(data.cep) || cep,
      logradouro: data.logradouro,
      complemento: data.complemento,
      bairro: data.bairro,
      localidade: data.localidade,
      uf: data.uf,
      ibge: data.ibge,
      gia: data.gia,
      ddd: data.ddd,
      siafi: data.siafi,
      provider: 'viacep',
    });
  }

  if (status === 200 && data && data.erro) {
    return null;
  }

  if (status === 400 || status === 404) {
    return null;
  }

  throw new Error(`ViaCEP status ${status}`);
}

async function fetchBrasilAPI(cep) {
  const { status, data } = await getJson(`https://brasilapi.com.br/api/cep/v1/${cep}`);
  if (status === 200 && data) {
    return buildNormalized({
      cep: normalizeCep(data.cep) || cep,
      logradouro: data.street,
      complemento: data.complement,
      bairro: data.neighborhood,
      localidade: data.city,
      uf: data.state,
      ibge: data.ibge,
      provider: 'brasilapi',
    });
  }

  if (status === 404) {
    return null;
  }

  throw new Error(`BrasilAPI status ${status}`);
}

async function fetchAwesomeAPI(cep) {
  const { status, data } = await getJson(`https://cep.awesomeapi.com.br/json/${cep}`);
  if (
    status === 200 &&
    data &&
    (data.status === undefined || data.status === 200)
  ) {
    return buildNormalized({
      cep: normalizeCep(data.cep) || cep,
      logradouro: data.address_name,
      complemento: data.address_type,
      bairro: data.district,
      localidade: data.city,
      uf: data.state,
      ibge: data.city_ibge,
      ddd: data.ddd,
      provider: 'awesomeapi',
    });
  }

  if (status === 404 || (data && data.status === 404)) {
    return null;
  }

  throw new Error(`AwesomeAPI status ${status}`);
}

const providers = [
  { name: 'viacep', fetch: fetchViaCEP },
  { name: 'brasilapi', fetch: fetchBrasilAPI },
  { name: 'awesomeapi', fetch: fetchAwesomeAPI },
];

async function lookupCep(cep) {
  let notFoundCount = 0;
  const errors = [];

  for (const provider of providers) {
    try {
      const result = await provider.fetch(cep);
      if (result) {
        return { result };
      }
      notFoundCount += 1;
    } catch (err) {
      errors.push({ provider: provider.name, message: err.message });
    }
  }

  if (notFoundCount === providers.length) {
    return { notFound: true };
  }

  return { error: true, errors };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = url.pathname.match(/^\/cep\/(\d{8})$/);

  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Metodo nao permitido' });
  }

  if (!match) {
    if (url.pathname.startsWith('/cep/')) {
      return sendJson(res, 400, {
        error: 'CEP invalido. Use 8 digitos, ex: 01001000',
      });
    }

    return sendJson(res, 404, { error: 'Rota nao encontrada' });
  }

  const cep = match[1];
  const { result, notFound, error, errors } = await lookupCep(cep);

  if (result) {
    return sendJson(res, 200, result);
  }

  if (notFound) {
    return sendJson(res, 404, { error: 'CEP nao encontrado' });
  }

  return sendJson(res, 502, {
    error: 'Falha ao consultar provedores de CEP',
    details: errors,
  });
});

server.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
