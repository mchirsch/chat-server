import { serve } from "./deps.ts";
import { getUsers, updateUser, addMessage, getMessages, getMessagesByChannel, getChannels, validateUser } from "./db.ts";
import { User, Message } from "./types.ts";

const port = Deno.env.get("PORT") ? parseInt(Deno.env.get("PORT")!) : 8000;

// In-memory token store... this is stateful, so not ideal for scalability / serverless
const tokenStore = new Map<string, { userId: number; expiry: number }>();

// Generate a random token
function generateToken(): string {
  return crypto.randomUUID(); // 36-char random UUID
}

// Middleware to verify token
function verifyToken(req: Request): number | Response {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response("Missing or invalid Authorization header", { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const tokenData = tokenStore.get(token);
  if (!tokenData) {
    return new Response("Invalid token", { status: 401 });
  }

  // Check if token is expired
  if (tokenData.expiry < Date.now()) {
    tokenStore.delete(token); // Remove expired token
    return new Response("Token expired", { status: 401 });
  }

  return tokenData.userId;
}

async function handler(req: Request): Promise<Response> {

  const url = new URL(req.url);
  const path = url.pathname;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // Allow all origins
  };

  // -------------------- Auth --------------------

  // POST /auth/login - Authenticate user and return token, user ID, and expiry
  if (req.method === "POST" && path === "/auth/login") {
    try {
      const { name, password } = await req.json();
      if (!name || !password) {
        return new Response("Missing name or password", { status: 400 });
      }
      const user = await validateUser(name, password);
      if (!user) {
        return new Response("Invalid credentials", { status: 401 });
      }
      const token = generateToken();
      const expiry = Date.now() + 3600 * 1000;
      tokenStore.set(token, { userId: user.id!, expiry });
      return new Response(JSON.stringify({ token, user_id: user.id!, expiry }), {
        status: 200,
        headers,
      });
    } catch (error) {
      return new Response((error as Error).message || "Server error", { status: 500 });
    }
  }

  // -------------------- Users --------------------

  // GET /users - Get all users
  if (req.method === "GET" && path === "/users") {
    try {
      const users = await getUsers();
      return new Response(JSON.stringify(users), {
        status: 200,
        headers,
      });
    } catch (error) {
      return new Response("Server error retrieving users", { status: 500 });
    }
  }

  // POST /users - Update user
  if (req.method === "POST" && path === "/users") {
    const userIdOrError = verifyToken(req);
    if (userIdOrError instanceof Response) {
      return userIdOrError; // 401 for invalid/missing token
    }
    const userId = userIdOrError;
    try {
      const body: Pick<User, 'name' | 'profile_picture_url'> = await req.json();
      if (!body.name || !body.profile_picture_url) {
        return new Response("Missing name or profile_picture_url", { status: 400 });
      }
      const updatedUser = await updateUser(userId, body);
      return new Response(JSON.stringify(updatedUser), {
        status: 200,
        headers,
      });
    } catch (error) {
      return new Response((error as Error).message === "User not found" ? "User not found" : "Server error", { status: (error as Error).message === "User not found" ? 404 : 500 });
    }
  }

  // -------------------- Messages --------------------

  // GET /messages - Get all messages
  if (req.method === "GET" && path === "/messages") {
    try {
      const messages = await getMessages();
      return new Response(JSON.stringify(messages), {
        status: 200,
        headers,
      });
    } catch (error) {
      return new Response("Server error retrieving messages", { status: 500 });
    }
  }

  // GET /messages/channel/:channel - Get messages for a specific channel
  if (req.method === "GET" && path.startsWith("/messages/channel/")) {
    try {
      const channel = path.split("/")[3];
      if (!channel) {
        return new Response("Channel not specified", { status: 400 });
      }
      const messages = await getMessagesByChannel(decodeURIComponent(channel));
      return new Response(JSON.stringify(messages), {
        status: 200,
        headers,
      });
    } catch (error) {
      return new Response("Server error retrieving channel messages", { status: 500 });
    }
  }

  // POST /messages - Add a message
  if (req.method === "POST" && path === "/messages") {
    const userIdOrError = verifyToken(req);
    if (userIdOrError instanceof Response) {
      return userIdOrError; // 401 for invalid/missing token
    }
    const userId = userIdOrError;
    try {
      const body: Pick<Message, 'body' | 'channel'> = await req.json();
      if (!body.body) {
        return new Response("Missing body", { status: 400 });
      }
      const message = await addMessage({ body: body.body, channel: body.channel, user_id: userId });
      return new Response(JSON.stringify(message), {
        status: 201,
        headers,
      });
    } catch (error) {
      return new Response((error as Error).message || "Server error", { status: 500 });
    }
  }

  // -------------------- Channels --------------------

  // GET /channels - Get list of channels
  if (req.method === "GET" && path === "/channels") {
    try {
      const channels = await getChannels();
      return new Response(JSON.stringify(channels), {
        status: 200,
        headers,
      });
    } catch (error) {
      return new Response("Server error retrieving channels", { status: 500 });
    }
  }

  return new Response("Not found", { status: 400 });
}

serve(handler, { port });

console.log(`Server running on port ${port}`);
