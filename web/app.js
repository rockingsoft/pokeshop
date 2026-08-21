const API_URL = 'http://localhost:8081';

const list = document.querySelector('#pokemon-list');
const status = document.querySelector('#status');

function setStatus(message, isError = false) {
  status.textContent = message;
  status.className = isError ? 'error' : '';
}

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) throw new Error(`API responded with ${response.status}`);
  return response.json();
}

async function loadPokemon() {
  setStatus('Loading…');
  try {
    const { items = [] } = await request('/pokemon?take=100&skip=0');
    list.replaceChildren(...items.map(renderPokemon));
    setStatus(`${items.length} Pokémon loaded.`);
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

function refreshWhenCreated(pokemonId, pokemonName = '') {
  const name = pokemonName ? `?name=${encodeURIComponent(pokemonName)}` : '';
  const source = new EventSource(`${API_URL}/events/pokemon/${pokemonId}${name}`);
  source.addEventListener('created', async () => {
    source.close();
    await loadPokemon();
  });
  source.addEventListener('timeout', () => source.close());
  source.onerror = () => source.close();
}

document.querySelector('#refresh').addEventListener('click', loadPokemon);

document.querySelector('#create-form').addEventListener('submit', async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const data = await request('/pokemon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, isFeatured: false }),
    });
    refreshWhenCreated(data.id);
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
    const data = await request('/pokemon/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(values.id), ignoreCache: true }),
    });
    refreshWhenCreated(data.id, pokemonSearch.value);
    setStatus('Import submitted. The catalog will refresh automatically.');
  } catch (error) {
    setStatus(error.message, true);
  }
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
