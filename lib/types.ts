export type DestinationType = "instagram" | "whatsapp" | "google_review" | "generic";
export type EventDestinationType = DestinationType | "unknown";

export type Profile = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  must_change_password: boolean;
  token_valid_after: number;
  created_at: string;
};

export type NfcLink = {
  id: number;
  owner_id: string;
  name: string;
  slug: string;
  destination_url: string;
  destination_type: DestinationType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  requires_configuration: boolean;
};

export type NfcLinkSummary = NfcLink & {
  total_taps: number;
  last_touched_at: string | null;
};

export type RedirectEvent = {
  id: number;
  nfc_link_id: number;
  destination_url: string;
  destination_type: EventDestinationType;
  created_at: string;
};

export type DestinationHistory = {
  id: number;
  nfc_link_id: number;
  destination_url: string;
  destination_type: EventDestinationType;
  created_at: string;
};

export type ActionState = { error?: string; success?: string; password?: string; email?: string };
