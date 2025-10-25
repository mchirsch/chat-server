export interface User {
  id?: number; // Optional for creation (auto-generated)
  name: string;
  profile_picture_url: string;
}

export interface Message {
  id?: number; // Optional for creation
  body: string;
  user_id: number;
  attachments?: string[];
  in_reply_to?: number | null;
  channel?: string;
  created_at?: string;
}
