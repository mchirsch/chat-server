import { serve } from "./deps.ts";
import { getUsers, updateUser, addMessage, getMessages, getMessagesByChannel, getChannels, validateUser } from "./db.ts";
import { User, Message } from "./types.ts";

const port = Deno.env.get("PORT") ? parseInt(Deno.env.get("PORT")!) : 8000;

// In-memory token store (stateful, not ideal for serverless)
const tokenStore = new Map<string, { userId: number; expiry: number }>();

// Helper function to create responses with CORS headers
function createResponse(body: string | object, status: number): Response {
  const headers = {
    "Content-Type": typeof body === "string" ? "text/plain" : "application/json",
    "Access-Control-Allow-Origin": "*",
  };
  return new Response(typeof body === "object" ? JSON.stringify(body) : body, { status, headers });
}

// Generate a random token
function generateToken(): string {
  return crypto.randomUUID();
}

// Verify token
function verifyToken(req: Request): number | Response {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return createResponse("Missing or invalid Authorization header", 401);
  }
  const token = authHeader.replace("Bearer ", "");
  const tokenData = tokenStore.get(token);
  if (!tokenData) {
    return createResponse("Invalid token", 401);
  }
  if (tokenData.expiry < Date.now()) {
    tokenStore.delete(token);
    return createResponse("Token expired", 401);
  }
  return tokenData.userId;
}

// Clear out expired tokens every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (data.expiry < now) {
      tokenStore.delete(token);
    }
  }
}, 10 * 60 * 1000);

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle OPTIONS preflight for CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  // POST /auth/login
  if (req.method === "POST" && path === "/auth/login") {
    try {
      const { name, password } = await req.json();
      if (!name || !password) {
        return createResponse("Missing name or password", 400);
      }
      const user = await validateUser(name, password);
      if (!user) {
        return createResponse("Invalid credentials", 401);
      }
      const token = generateToken();
      const expiry = Date.now() + 10 * 60 * 1000; // 10 min expiry
      tokenStore.set(token, { userId: user.id!, expiry });
      return createResponse({ token, user_id: user.id!, expiry }, 200);
    } catch (error) {
      return createResponse((error as Error).message || "Server error", 500);
    }
  }

  // GET /users
  if (req.method === "GET" && path === "/users") {
    try {
      const users = await getUsers();
      return createResponse(users, 200);
    } catch (error) {
      return createResponse("Server error retrieving users", 500);
    }
  }

  // POST /users
  if (req.method === "POST" && path === "/users") {
    const userIdOrError = verifyToken(req);
    if (userIdOrError instanceof Response) {
      return userIdOrError; // Already has CORS via createResponse
    }
    const userId = userIdOrError;
    try {
      const body: Pick<User, 'name' | 'profile_picture_url'> = await req.json();
      if (!body.name || !body.profile_picture_url) {
        return createResponse("Missing name or profile_picture_url", 400);
      }
      const updatedUser = await updateUser(userId, body);
      return createResponse(updatedUser, 200);
    } catch (error) {
      return createResponse(
        (error as Error).message === "User not found" ? "User not found" : "Server error",
        (error as Error).message === "User not found" ? 404 : 500
      );
    }
  }

  // GET /messages
  if (req.method === "GET" && path === "/messages") {
    try {
      const messages = await getMessages();
      return createResponse(messages, 200);
    } catch (error) {
      return createResponse("Server error retrieving messages", 500);
    }
  }

  // GET /messages/channel/:channel
  if (req.method === "GET" && path.startsWith("/messages/channel/")) {
    try {
      const channel = path.split("/")[3];
      if (!channel) {
        return createResponse("Channel not specified", 400);
      }
      const messages = await getMessagesByChannel(decodeURIComponent(channel));
      return createResponse(messages, 200);
    } catch (error) {
      return createResponse("Server error retrieving channel messages", 500);
    }
  }

  // POST /messages
  if (req.method === "POST" && path === "/messages") {
    const userIdOrError = verifyToken(req);
    if (userIdOrError instanceof Response) {
      return userIdOrError; // Already has CORS via createResponse
    }
    const userId = userIdOrError;
    try {
      const body = await req.json() as Partial<Message>;
      if (!body.body) {
        return createResponse("Missing body", 400);
      }
      const message = await addMessage({ ...body, user_id: userId } as Message);
      return createResponse(message, 201);
    } catch (error) {
      return createResponse((error as Error).message || "Server error", 500);
    }
  }

  // GET /channels
  if (req.method === "GET" && path === "/channels") {
    try {
      const channels = await getChannels();
      return createResponse(channels, 200);
    } catch (error) {
      return createResponse("Server error retrieving channels", 500);
    }
  }

  // GET /
  if (req.method === "GET" && path === "/") {
    return createResponse({ status: "OK", message: "Welcome to the Chat Server API", version: "1.0.0" }, 200);
  }

  return createResponse("Not found", 404);
}

serve(handler, { port });
console.log(`Server running on port ${port}`);
