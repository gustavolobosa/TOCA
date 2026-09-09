export type NfcLink = {
  id: number;
  owner_id: string;
  name: string;
  slug: string;
  destination_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type NfcLinkSummary = NfcLink & {
  total_taps: number;
  last_touched_at: string | null;
};
