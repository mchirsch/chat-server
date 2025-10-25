import { neon } from "./deps.ts";
import { User, Message } from "./types.ts";

const databaseUrl = Deno.env.get('DATABASE_URL')!;
const sql = neon(databaseUrl);

// -------------------- Users --------------------

export async function validateUser(name: string, password: string): Promise<User | null> {
  try {
    const result = await sql`SELECT id, name, profile_picture_url FROM users WHERE name = ${name} AND password = ${password}`;
    return result[0] || null;
  } catch (error) {
    console.error("DB error in validateUser:", error);
    return null;
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const result = await sql`SELECT id, name, profile_picture_url FROM users`;
    return result as User[];
  } catch (error) {
    console.error("DB error in getUsers:", error);
    throw error;
  }
}

export async function updateUser(id: number, updates: Pick<User, 'name' | 'profile_picture_url'>): Promise<User> {
  const { name, profile_picture_url } = updates;
  try {
    const result = await sql`
      UPDATE users
      SET name = ${name}, profile_picture_url = ${profile_picture_url}
      WHERE id = ${id}
      RETURNING id, name, profile_picture_url
    `;
    if (result.length === 0) {
      throw new Error("User not found");
    }
    return result[0] as User;
  } catch (error) {
    if ((error as Error).message.includes("User not found")) {
      throw error;
    }
    console.error("DB error in updateUser:", error);
    throw new Error("Server error updating user");
  }
}

// -------------------- Messages --------------------

export async function getMessages(): Promise<Message[]> {
  try {
    const result = await sql`SELECT * FROM messages ORDER BY created_at DESC`;
    return result as Message[];
  } catch (error) {
    console.error("DB error in getMessages:", error);
    throw error;
  }
}

export async function getMessagesByChannel(channel: string): Promise<Message[]> {
  try {
    const result = await sql`SELECT * FROM messages WHERE channel = ${channel} ORDER BY created_at DESC`;
    return result as Message[];
  } catch (error) {
    console.error("DB error in getMessagesByChannel:", error);
    throw error;
  }
}

export async function addMessage(message: Message): Promise<Message> {
  try {
    const result = await sql`
      INSERT INTO messages (body, user_id, attachments, in_reply_to, channel)
      VALUES (${message.body}, ${message.user_id}, ${JSON.stringify(message.attachments || [])}, ${message.in_reply_to || null}, ${message.channel || 'general'})
      RETURNING *
    `;
    return result[0] as Message;
  } catch (error) {
    console.error("DB error in addMessage:", error);
    throw error;
  }
}

// -------------------- Channels --------------------

export async function getChannels(): Promise<string[]> {
  try {
    const result = await sql`SELECT DISTINCT channel FROM messages WHERE channel IS NOT NULL`;
    return result.map((row: { channel: string }) => row.channel);
  } catch (error) {
    console.error("DB error in getChannels:", error);
    throw error;
  }
}
