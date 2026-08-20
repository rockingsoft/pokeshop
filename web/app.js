const API_URL = 'http://localhost:8081';

const list = document.querySelector('#pokemon-list');
const status = document.querySelector('#status');
const traceList = document.querySelector('#trace-list');
const traceEmpty = document.querySelector('#trace-empty');

function setStatus(message, isError = false) {
  status.textContent = message;
  status.className = isError ? 'error' : '';
}

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) throw new Error(`API responded with ${response.status}`);
  const data = await response.json();
  const traceId = response.headers.get('X-Trace-Id');
  const spanId = response.headers.get('X-Span-Id');
  return { data, traceId, spanId };
}

async function loadPokemon() {
  setStatus('Loading…');
  try {
    const { data: { items = [] }, traceId, spanId } = await request('/pokemon?take=100&skip=0');
    list.replaceChildren(...items.map(renderPokemon));
    setStatus(`${items.length} Pokémon loaded.`);
    streamTrace(traceId, spanId, 'Refresh catalog');
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderPokemon(pokemon) {
  const card = document.createElement('article');
  const image = document.createElement('img');
  const name = document.createElement('h3');
  const type = document.createElement('p');
  image.src = pokemon.imageUrl || '';
  image.alt = pokemon.name;
  image.loading = 'lazy';
  name.textContent = pokemon.name;
  type.textContent = pokemon.type;
  card.append(image, name, type);
  return card;
}

function createPendingTrace(traceId, action) {
  if (!traceId || document.querySelector(`[data-trace-id="${traceId}"]`)) return null;
  traceEmpty.hidden = true;
  const card = document.createElement('article');
  card.className = 'trace-card pending';
  card.dataset.traceId = traceId;
  card.innerHTML = `
    <div class="trace-card-heading">
      <div><span class="trace-state">Streaming</span><h3></h3></div>
      <div class="trace-card-meta">
        <span class="trace-duration">Waiting for spans…</span>
        <button class="trace-toggle" type="button" aria-expanded="false">Show JSON</button>
      </div>
    </div>
    <div class="trace-details" hidden>
      <div class="trace-id">Trace ID: <code>${traceId}</code></div>
      <pre class="trace-json">{ "traceId": "${traceId}", "spans": [] }</pre>
    </div>`;
  card.querySelector('h3').textContent = action;
  const toggle = card.querySelector('.trace-toggle');
  const details = card.querySelector('.trace-details');
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    toggle.textContent = expanded ? 'Show JSON' : 'Hide JSON';
    details.hidden = expanded;
  });
  traceList.prepend(card);
  return card;
}

function traceparent(traceId, spanId) {
  return traceId && spanId ? `00-${traceId}-${spanId}-01` : '';
}

function streamTrace(traceId, spanId, action) {
  const card = createPendingTrace(traceId, action);
  if (!card) return;
  const parent = encodeURIComponent(traceparent(traceId, spanId));
  const source = new EventSource(`${API_URL}/events/traces/${traceId}?traceparent=${parent}`);
  let rendered = false;

  source.addEventListener('summary', event => {
    rendered = true;
    renderTrace(card, JSON.parse(event.data));
  });
  source.addEventListener('complete', async () => {
    source.close();
    await reconcileClosedStreams(card, traceId);
  });
  source.onerror = () => {
    source.close();
    if (rendered) return;
    card.classList.remove('pending');
    card.classList.add('unavailable');
    card.querySelector('.trace-state').textContent = 'Unavailable';
    card.querySelector('.trace-duration').textContent = 'SSE stream disconnected';
  };
}

async function reconcileClosedStreams(card, traceId) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const response = await fetch(`${API_URL}/traces/${traceId}/summary`);
      if (!response.ok) continue;
      const trace = await response.json();
      renderTrace(card, trace);
      const hasTraceStream = trace.spans.some(span => span.operationName.startsWith('GET /events/traces/'));
      if (hasTraceStream) return;
    } catch (_) {
      // Keep the last SSE snapshot visible if final reconciliation is unavailable.
    }
  }
}

function refreshWhenCreated(pokemonId, traceId, spanId, pokemonName = '') {
  const parent = encodeURIComponent(traceparent(traceId, spanId));
  const name = pokemonName ? `&name=${encodeURIComponent(pokemonName)}` : '';
  const source = new EventSource(`${API_URL}/events/pokemon/${pokemonId}?traceparent=${parent}${name}`);
  source.addEventListener('created', async () => {
    source.close();
    await loadPokemon();
  });
  source.addEventListener('timeout', () => source.close());
  source.onerror = () => source.close();
}

function renderTrace(card, trace) {
  card.classList.remove('pending');
  card.classList.toggle('failed', trace.status === 'error');
  card.querySelector('.trace-state').textContent = trace.status === 'error' ? 'Error' : 'Complete';
  card.querySelector('.trace-duration').textContent = `${Math.round(trace.durationMs)} ms · ${trace.spans.length} spans`;
  card.querySelector('.trace-json').textContent = JSON.stringify(trace, null, 2);
}

document.querySelector('#refresh').addEventListener('click', loadPokemon);

document.querySelector('#create-form').addEventListener('submit', async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const { data, traceId, spanId } = await request('/pokemon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, isFeatured: false }),
    });
    streamTrace(traceId, spanId, 'Create Pokémon');
    refreshWhenCreated(data.id, traceId, spanId);
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.querySelector('#import-form').addEventListener('submit', async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  if (!values.id) {
    setStatus('Choose a Pokémon from the suggestions.', true);
    return;
  }
  try {
    const { data, traceId, spanId } = await request('/pokemon/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(values.id), ignoreCache: true }),
    });
    streamTrace(traceId, spanId, 'Import from PokéAPI');
    refreshWhenCreated(data.id, traceId, spanId, pokemonSearch.value);
    setStatus('Import submitted. The catalog will refresh automatically.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.querySelector('#clear-traces').addEventListener('click', () => {
  traceList.replaceChildren();
  traceEmpty.hidden = false;
});

document.querySelectorAll('[data-tab]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(item => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
      document.querySelector(`#${item.dataset.tab}-panel`).hidden = !active;
    });
  });
});

const pokemonSearch = document.querySelector('#pokemon-search');
const pokemonId = document.querySelector('#pokemon-id');
const suggestions = document.querySelector('#pokemon-suggestions');
let pokeApiPokemon = [];

async function loadPokeApiPokemon() {
  if (pokeApiPokemon.length) return;
  const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=151');
  const { results } = await response.json();
  pokeApiPokemon = results.map(pokemon => {
    const id = Number(pokemon.url.split('/').filter(Boolean).at(-1));
    return {
      id,
      name: pokemon.name,
      image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
    };
  });
}

function renderSuggestions() {
  const query = pokemonSearch.value.trim().toLowerCase();
  const matches = pokeApiPokemon.filter(pokemon => !query || pokemon.name.includes(query)).slice(0, 6);
  suggestions.replaceChildren(...matches.map(pokemon => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'suggestion';
    option.setAttribute('role', 'option');
    option.innerHTML = `<img alt="" src="${pokemon.image}" /><span>${pokemon.name}</span><small>#${pokemon.id}</small>`;
    option.addEventListener('click', () => {
      pokemonSearch.value = pokemon.name;
      pokemonId.value = String(pokemon.id);
      suggestions.hidden = true;
    });
    return option;
  }));
  suggestions.hidden = matches.length === 0;
}

pokemonSearch.addEventListener('focus', async () => {
  try {
    await loadPokeApiPokemon();
    renderSuggestions();
  } catch (_) {
    setStatus('Could not load PokéAPI suggestions.', true);
  }
});

pokemonSearch.addEventListener('input', () => {
  pokemonId.value = '';
  renderSuggestions();
});

document.addEventListener('click', event => {
  if (!event.target.closest('.autocomplete')) suggestions.hidden = true;
});

loadPokemon();
