import fetch from 'node-fetch';

const { POKE_API_BASE_URL = '' } = process.env;

type TRawPokemon = {
  name: string;
  types: Array<{
    type: {
      name: string;
    };
  }>;
  sprites: {
    front_default: string;
  };
};

export type TPokemon = {
  name: string;
  type: string;
  imageUrl: string;
};

class PokeAPIService {
  private readonly baseRoute: string = '/pokemon';
  private readonly baseUrl: string = `${POKE_API_BASE_URL}${this.baseRoute}`;

  async getPokemon(id: string): Promise<TPokemon> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'GET',
    });
    const pokemon = (await response.json()) as TRawPokemon;
    const { name, types, sprites } = pokemon;

    return {
      name,
      type: types.map(({ type }) => type.name).join(','),
      imageUrl: sprites.front_default,
    };
  }
}

export default PokeAPIService;
