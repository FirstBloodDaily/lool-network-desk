export const TIMEZONE = "Europe/Athens" as const;
export const TIMEZONE_LABEL = "GMT+2" as const;
export const CURRENCY = "USD" as const;

export type ChannelSource = "youtube-analytics" | "csv";

export type Channel = {
  id: "oplol" | "eventvods";
  name: string;
  alias: string;
  youtubeChannelId: string;
  url: string;
  source: ChannelSource;
  color: string;
  monthlyOpexUsd: number;
  opexPeople: { name: string; amount: number }[];
  leagues: string[];
  networkCutPct: number;
};

/** Hard allowlist — never query or display other YouTube channels. */
export const CHANNELS: Channel[] = [
  {
    id: "oplol",
    name: "OPLOLReplay",
    alias: "OPLOLReplay",
    youtubeChannelId: "UC0RalGf69iYVBFteHInyJJg",
    url: "https://www.youtube.com/channel/UC0RalGf69iYVBFteHInyJJg/",
    source: "youtube-analytics",
    color: "#c9a34a",
    monthlyOpexUsd: 1050,
    opexPeople: [
      { name: "Daniel", amount: 250 },
      { name: "Vinicius", amount: 0 },
      { name: "Joel", amount: 550 },
      { name: "Helen", amount: 250 },
    ],
    leagues: ["First Stand", "LCK", "LEC", "LPL", "MSI", "Worlds"],
    networkCutPct: 10,
  },
  {
    id: "eventvods",
    name: "Loleventvods",
    alias: "Eventvods",
    youtubeChannelId: "UCQJT7rpynlR7SSdn3OyuI_Q",
    url: "https://www.youtube.com/channel/UCQJT7rpynlR7SSdn3OyuI_Q/",
    source: "csv",
    color: "#2e6b8a",
    monthlyOpexUsd: 500,
    opexPeople: [
      { name: "Ricardo", amount: 500 },
    ],
    leagues: ["First Stand", "LCK", "LEC", "LPL", "MSI", "Worlds"],
    networkCutPct: 0,
  },
];

export const OPLOL_YOUTUBE_ID = "UC0RalGf69iYVBFteHInyJJg";

export const CSV_CHANNEL_IDS = new Set(["eventvods"]);

export function channelById(id: string): Channel | undefined {
  return CHANNELS.find((c) => c.id === id);
}

export function channelByYoutubeId(yt: string): Channel | undefined {
  return CHANNELS.find((c) => c.youtubeChannelId === yt);
}

export function shortName(c: Channel): string {
  return c.alias || c.name;
}
