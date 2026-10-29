import { MemberLocation } from '../types';
import { Projection, projectPoint } from './projection';

export interface Cluster {
  id: string;
  city: string | null;
  country: string | null;
  lon: number;
  lat: number;
  x: number;
  y: number;
  members: MemberLocation[];
  /** cuántos de este grupo estuvieron activos en los últimos 5 minutos */
  online: number;
}

/**
 * Agrupa a los miembros por ubicación.
 *
 * En una comunidad real casi cada miembro ocupa un punto único y las ciudades
 * más cargadas apenas suman unos pocos: la mancha de un mapa saturado no viene
 * de tener demasiados datos, viene del tamaño del pin. Por eso NO se usa
 * un cluster genérico que colapsa por distancia de pantalla: agrupar por ciudad
 * conserva la textura real y solo funde lo que de verdad comparte
 * lugar.
 */
export function buildClusters(members: MemberLocation[], p: Projection): Cluster[] {
  const byPlace = new Map<string, Cluster>();
  const now = Date.now();

  for (const m of members) {
    if (m.location_lat == null || m.location_lng == null) continue;

    // La clave prefiere la ciudad; si falta, cae a la coordenada redondeada
    // (~1km) para no fundir dos lugares distintos que solo comparten país.
    const key =
      m.location_city && m.location_country
        ? `${m.location_city}|${m.location_country}`
        : `${m.location_lat.toFixed(2)}|${m.location_lng.toFixed(2)}`;

    let c = byPlace.get(key);
    if (!c) {
      const { x, y } = projectPoint(m.location_lng, m.location_lat, p);
      c = {
        id: key,
        city: m.location_city,
        country: m.location_country,
        lon: m.location_lng,
        lat: m.location_lat,
        x,
        y,
        members: [],
        online: 0,
      };
      byPlace.set(key, c);
    }
    c.members.push(m);
    if (m.last_seen && now - new Date(m.last_seen).getTime() < 5 * 60 * 1000) c.online += 1;
  }

  // Los grupos chicos se pintan al final para que queden ENCIMA de los grandes:
  // si no, un punto de 1 persona desaparece bajo el resplandor de Madrid.
  return [...byPlace.values()].sort((a, b) => b.members.length - a.members.length);
}

export interface CountryTally {
  count: number;
  cities: number;
}

/**
 * Conteo por país. La geometría viene de Natural Earth con nombres en inglés y
 * los perfiles guardan el país en español, así que hace falta un puente. Solo
 * se mapean los países donde hay comunidad; el resto queda en sombra, que es
 * exactamente lo que el diseño quiere.
 */
export const COUNTRY_ALIASES: Record<string, string> = {
  México: 'Mexico',
  España: 'Spain',
  Colombia: 'Colombia',
  Argentina: 'Argentina',
  'Estados Unidos de América': 'United States of America',
  'Estados Unidos': 'United States of America',
  Chile: 'Chile',
  Perú: 'Peru',
  Ecuador: 'Ecuador',
  Paraguay: 'Paraguay',
  'Costa Rica': 'Costa Rica',
  Italia: 'Italy',
  'Reino Unido': 'United Kingdom',
  Uruguay: 'Uruguay',
  Bolivia: 'Bolivia',
  Venezuela: 'Venezuela',
  Guatemala: 'Guatemala',
  Panamá: 'Panama',
  Honduras: 'Honduras',
  Nicaragua: 'Nicaragua',
  'El Salvador': 'El Salvador',
  'República Dominicana': 'Dominican Republic',
  Cuba: 'Cuba',
  'Puerto Rico': 'Puerto Rico',
  Brasil: 'Brazil',
  Canadá: 'Canada',
  Francia: 'France',
  Alemania: 'Germany',
  Portugal: 'Portugal',
  Países_Bajos: 'Netherlands',
  'Países Bajos': 'Netherlands',
  Bélgica: 'Belgium',
  Suiza: 'Switzerland',
  Austria: 'Austria',
  Irlanda: 'Ireland',
  Suecia: 'Sweden',
  Noruega: 'Norway',
  Dinamarca: 'Denmark',
  Polonia: 'Poland',
  Rumania: 'Romania',
  Grecia: 'Greece',
  Australia: 'Australia',
  'Nueva Zelanda': 'New Zealand',
  Japón: 'Japan',
  China: 'China',
  India: 'India',
  Israel: 'Israel',
  'Emiratos Árabes Unidos': 'United Arab Emirates',
  Marruecos: 'Morocco',
  Egipto: 'Egypt',
  Sudáfrica: 'South Africa',
  Filipinas: 'Philippines',
  Indonesia: 'Indonesia',
  Tailandia: 'Thailand',
  Turquía: 'Turkey',
  Rusia: 'Russia',
  Andorra: 'Andorra',
};

export function tallyByCountry(members: MemberLocation[]): Map<string, CountryTally> {
  const tally = new Map<string, CountryTally>();
  const citiesSeen = new Map<string, Set<string>>();

  for (const m of members) {
    if (!m.location_country) continue;
    const name = COUNTRY_ALIASES[m.location_country] ?? m.location_country;
    const t = tally.get(name) ?? { count: 0, cities: 0 };
    t.count += 1;
    tally.set(name, t);

    const set = citiesSeen.get(name) ?? new Set<string>();
    if (m.location_city) set.add(m.location_city);
    citiesSeen.set(name, set);
  }

  for (const [name, t] of tally) t.cities = citiesSeen.get(name)?.size ?? 0;
  return tally;
}

/** Nombre en español del país, para rotular el mapa en el idioma de la casa. */
const ES_BY_EN = new Map(
  Object.entries(COUNTRY_ALIASES).map(([es, en]) => [en, es])
);
export const countryNameES = (englishName: string): string =>
  ES_BY_EN.get(englishName) ?? englishName;
