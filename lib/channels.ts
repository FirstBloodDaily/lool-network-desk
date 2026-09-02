export const TIMEZONE = "Europe/Athens" as const;
export const TIMEZONE_LABEL = "GMT+2" as const;
export const CURRENCY = "USD" as const;

export type ChannelSource = "youtube-analytics" | "csv";

export type Channel = {
  id: "oplol" | "eventvods" | "onivia";
  name: string;
  alias: string;
  youtubeChannelId: string;
  url: string;
  source: ChannelSource;
  color: string;
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
  },
  {
    id: "eventvods",
    name: "Loleventvods",
    alias: "Eventvods",
    youtubeChannelId: "UCQJT7rpynlR7SSdn3OyuI_Q",
    url: "https://www.youtube.com/channel/UCQJT7rpynlR7SSdn3OyuI_Q/",
    source: "csv",
    color: "#7a9a88",
  },
  {
    id: "onivia",
    name: "Onivia",
    alias: "Onivia",
    youtubeChannelId: "UCPhab209KEicqPJFAk9IZEA",
    url: "https://www.youtube.com/channel/UCPhab209KEicqPJFAk9IZEA/",
    source: "csv",
    color: "#9fb3a6",
  },
];

export const OPLOL_YOUTUBE_ID = "UC0RalGf69iYVBFteHInyJJg";

export const CSV_CHANNEL_IDS = new Set(["eventvods", "onivia"]);

export function channelById(id: string): Channel | undefined {
  return CHANNELS.find((c) => c.id === id);
}

export function channelByYoutubeId(yt: string): Channel | undefined {
  return CHANNELS.find((c) => c.youtubeChannelId === yt);
}

export function shortName(c: Channel): string {
  return c.alias || c.name;
}
