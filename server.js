const http = require('http');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3004;
const TIMEOUT_MS = 4000;

// --- Helper Functions ---

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function normalizeCep(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildResponse(fields) {
  return {
    cep: normalizeCep(fields.cep),
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

// --- API Client Wrapper ---

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'User-Agent': 'busca-cep-api/2.0', ...options.headers },
    });
    
    // Convert 404 or 400 errors directly into thrown errors so Promise.any ignores them
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Providers ---

const providers = {
  async viacep(cep) {
    const data = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`);
    if (data.erro) throw new Error('ViaCEP: Not Found');

    return buildResponse({
      cep: data.cep,
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
  },

  async brasilapi(cep) {
    const data = await fetchJson(`https://brasilapi.com.br/api/cep/v1/${cep}`);
    
    return buildResponse({
      cep: data.cep,
      logradouro: data.street,
      complemento: data.complement,
      bairro: data.neighborhood,
      localidade: data.city,
      uf: data.state,
      ibge: data.ibge,
      provider: 'brasilapi',
    });
  },

  async awesomeapi(cep) {
    const data = await fetchJson(`https://cep.awesomeapi.com.br/json/${cep}`);
    if (data.status === 404) throw new Error('AwesomeAPI: Not Found');

    return buildResponse({
      cep: data.cep,
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
};

// --- Logic ---

async function lookupCep(cep) {
  // Create an array of promises calling all providers simultaneously
  const promises = Object.values(providers).map(providerFn => providerFn(cep));

  try {
    // Promise.any resolves as soon as the FIRST promise succeeds.
    // It ignores errors unless ALL promises fail.
    const result = await Promise.any(promises);
    return { result };
  } catch (aggregateError) {
    // If we are here, ALL providers failed or returned 404
    // Check if the errors are specifically "Not Found" or network errors
    const allErrors = aggregateError.errors.map(e => e.message);
    
    // Simple heuristic: If all failed, we treat as 404 for the user
    // or 502 if it was a network mess. Simulating the original logic:
    return { 
      error: true, 
      details: allErrors 
    };
  }
}

// --- Server ---

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Route Check
  const match = url.pathname.match(/^\/cep\/(\d{8})$/);
  if (!match) {
    if (url.pathname.startsWith('/cep/')) {
      return sendJson(res, 400, { error: 'Invalid CEP format. Use 8 digits.' });
    }
    return sendJson(res, 404, { error: 'Route not found' });
  }

  // Execution
  const cep = match[1];
  const { result, error, details } = await lookupCep(cep);

  if (result) {
    return sendJson(res, 200, result);
  }

  // If we had an error, we assume 404 if it's a lookup failure, 
  // or 502 if providers are down.
  // For simplicity based on original code logic:
  return sendJson(res, 404, { 
    error: 'CEP not found or providers unavailable',
    details 
  });
});

server.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT} (Node ${process.version})`);
});