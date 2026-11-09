import type { Album, Artist, Playlist, Thumb, Track } from "../types";

/** Generates a flat, colored square cover as an SVG data URI (no external assets). */
export function svgCover(color: string, seed: number): Thumb[] {
  const r = 18 + (seed % 5) * 6;
  const cx = 30 + ((seed * 37) % 40);
  const cy = 30 + ((seed * 53) % 40);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="${color}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.2"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r / 3}" fill="rgba(255,255,255,.18)"/>` +
    `</svg>`;
  return [{ url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, w: 544, h: 544 }];
}

const PALETTE = [
  "#3C3489",
  "#085041",
  "#72243E",
  "#633806",
  "#0C447C",
  "#712B13",
  "#26215C",
  "#04342C",
  "#4B1528",
  "#444441",
];

type Seed = { artist: string; albums: { title: string; year: string; songs: string[] }[] };

const SEEDS: Seed[] = [
  {
    artist: "Noite Clara",
    albums: [
      {
        title: "Neon",
        year: "2025",
        songs: [
          "Luzes da cidade",
          "Horizonte",
          "Avenida",
          "Madrugada",
          "Céu aberto",
          "Último trem",
        ],
      },
      {
        title: "Reflexos",
        year: "2023",
        songs: ["Espelho d'água", "Noite adentro", "Vidro fosco", "Primeira luz"],
      },
    ],
  },
  {
    artist: "Ventania",
    albums: [
      {
        title: "Maré",
        year: "2024",
        songs: ["Maré baixa", "Corrida", "Sal", "Vento sul", "Areia quente"],
      },
      { title: "Rajadas", year: "2022", songs: ["Rajada", "Tempestade calma", "Farol"] },
    ],
  },
  {
    artist: "Polaris",
    albums: [
      {
        title: "Órbita",
        year: "2025",
        songs: ["Céu de vidro", "Silêncio azul", "Gravidade", "Satélite", "Constelação"],
      },
    ],
  },
  {
    artist: "Areia Fina",
    albums: [
      { title: "Deserto", year: "2026", songs: ["Fio da meada", "Miragem", "Dunas", "Oásis"] },
    ],
  },
  {
    artist: "Lua Cheia",
    albums: [
      {
        title: "Fases",
        year: "2024",
        songs: ["Crescente", "Minguante", "Eclipse", "Noite longa", "Maré alta"],
      },
    ],
  },
  {
    artist: "Os Ecos",
    albums: [
      { title: "Repetição", year: "2021", songs: ["Eco", "Volta", "Ressoar", "Grave", "Agudo"] },
    ],
  },
  {
    artist: "Aurora Sul",
    albums: [
      { title: "Amanhecer", year: "2025", songs: ["Manhã", "Orvalho", "Raio de sol", "Despertar"] },
    ],
  },
  {
    artist: "Distância",
    albums: [
      {
        title: "Quilômetros",
        year: "2023",
        songs: ["Estrada", "Mapa", "Saudade", "Chegada", "Partida"],
      },
    ],
  },
];

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

export const artists: Artist[] = [];
export const albums: Album[] = [];
export const tracks: Track[] = [];

SEEDS.forEach((seed, ai) => {
  const artistId = `ar-${slug(seed.artist)}`;
  const ref = { id: artistId, name: seed.artist };
  const artistAlbums: Album[] = seed.albums.map((al, bi) => {
    const albumId = `al-${slug(al.title)}`;
    const color = PALETTE[(ai * 3 + bi) % PALETTE.length];
    const thumbs = svgCover(color, ai * 7 + bi);
    const albumTracks: Track[] = al.songs.map((title, ti) => ({
      id: `tr-${slug(title)}`,
      title,
      artists: [ref],
      album: { id: albumId, title: al.title },
      durationMs: (150 + ((ai * 31 + ti * 17) % 120)) * 1000,
      thumbs,
    }));
    tracks.push(...albumTracks);
    const album: Album = {
      id: albumId,
      title: al.title,
      artists: [ref],
      year: al.year,
      kind: "album",
      thumbs,
      tracks: albumTracks,
    };
    albums.push(album);
    return album;
  });
  artists.push({
    id: artistId,
    name: seed.artist,
    subtitle: `${(ai + 1) * 137} mil ouvintes mensais`,
    thumbs: svgCover(PALETTE[(ai * 2 + 5) % PALETTE.length], ai + 40),
    topTracks: artistAlbums.flatMap((a) => a.tracks).slice(0, 10),
    albums: artistAlbums,
    singles: [],
    related: [],
  });
});

artists.forEach((a, i) => {
  a.related = [1, 2, 3].map((d) => artists[(i + d) % artists.length]);
});

const pick = (ids: number[]) => ids.map((i) => tracks[i % tracks.length]);

export const playlists: Playlist[] = [
  {
    id: "pl-mix-1",
    title: "Mix diário 1",
    author: "Musicfree",
    thumbs: svgCover("#3C3489", 91),
    tracks: pick([0, 6, 11, 2, 19, 25, 7, 14]),
  },
  {
    id: "pl-mix-2",
    title: "Mix diário 2",
    author: "Musicfree",
    thumbs: svgCover("#085041", 92),
    tracks: pick([10, 15, 22, 3, 28, 33, 9]),
  },
  {
    id: "pl-descobertas",
    title: "Descobertas",
    author: "Musicfree",
    thumbs: svgCover("#72243E", 93),
    tracks: pick([30, 24, 18, 12, 36, 5, 27]),
  },
  {
    id: "pl-foco",
    title: "Foco total",
    author: "Musicfree",
    thumbs: svgCover("#0C447C", 94),
    tracks: pick([16, 17, 20, 21, 34, 35]),
  },
  {
    id: "pl-relax",
    title: "Fim de tarde",
    author: "Musicfree",
    thumbs: svgCover("#633806", 95),
    tracks: pick([1, 4, 8, 13, 23, 29, 31]),
  },
  {
    id: "pl-treino",
    title: "Treino pesado",
    author: "Musicfree",
    thumbs: svgCover("#712B13", 96),
    tracks: pick([11, 26, 32, 37, 2, 19]),
  },
];

export const moods = ["Relax", "Animado", "Foco", "Treino", "Brasil", "Festa"];
