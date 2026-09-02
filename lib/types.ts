export type DailyPoint = {
  date: string;
  views: number | null;
  revenue: number | null;
  rpm: number | null;
  opex?: number | null;
  net?: number | null;
};

export type ChannelBlock = {
  channelId: string;
  youtubeChannelId: string;
  source: "live" | "csv" | "none";
  ok: boolean;
  series: DailyPoint[];
  note: string | null;
  error: string | null;
  file?: string | null;
  uploadedAt?: string | null;
  fetchedAt?: string | null;
};

export type RangeResolved = {
  key: string;
  start: string;
  end: string;
  label: string;
  timezone: string;
};

export type MetricsResponse = {
  ok: boolean;
  error: string | null;
  range: RangeResolved | null;
  byChannel: Record<string, ChannelBlock>;
};
