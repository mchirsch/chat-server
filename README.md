## Database

```
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL, -- In production, hash passwords!
  profile_picture_url VARCHAR(255)
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  body TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  attachments VARCHAR(255)[], -- Array of URLs for attachments
  in_reply_to INTEGER REFERENCES messages(id), -- Self-referencing for replies
  channel VARCHAR(50), -- Hashtag, e.g., '#general'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Run the Server

```
export DATABASE_URL="<postgres connection string here>"
deno run --allow-net --allow-env server.ts
```

## Try it Out

http://ec2-44-250-68-143.us-west-2.compute.amazonaws.com:8000/messages

# Chat API — REST Documentation

**Base URL:**  
`http://ec2-44-250-68-143.us-west-2.compute.amazonaws.com:8000`

**Authentication:**  
Bearer token (returned by `POST /auth/login`)  
Header:
```
Authorization: Bearer <token>
```

---

## Auth

### `POST /auth/login`
Authenticate a user and receive an access token.

**Request Body**
```json
{
  "name": "alice",
  "password": "secret123"
}
```

**Success Response (200)**
```json
{
  "token": "uuid-token-string",
  "user_id": 1,
  "expiry": 1735157899123
}
```

**Errors**
- `400` — Missing name or password  
- `401` — Invalid credentials  
- `500` — Server error

---

## Users

### `GET /users`
Retrieve all users.

**Success Response (200)**
```json
[
  {
    "id": 1,
    "name": "alice",
    "profile_picture_url": "https://example.com/alice.jpg"
  }
]
```

**Errors**
- `500` — Server error retrieving users

---

### `POST /users`
Update the currently authenticated user.

**Headers**
```
Authorization: Bearer <token>
```

**Request Body**
```json
{
  "name": "new_name",
  "profile_picture_url": "https://example.com/new.jpg"
}
```

**Success Response (200)**
```json
{
  "id": 1,
  "name": "new_name",
  "profile_picture_url": "https://example.com/new.jpg"
}
```

**Errors**
- `400` — Missing `name` or `profile_picture_url`  
- `401` — Missing or invalid token  
- `404` — User not found  
- `500` — Server error

---

## Messages

### `GET /messages`
Retrieve all messages.

**Success Response (200)**
```json
[
  {
    "id": 12,
    "body": "Hello world!",
    "user_id": 1,
    "attachments": ["https://example.com/new.jpg"],
    "in_reply_to": 1,
    "channel": "general",
    "created_at": "2025-10-24T19:43:12Z"
  }
]
```

**Errors**
- `500` — Server error retrieving messages

---

### `GET /messages/channel/{channel}`
Retrieve messages for a specific channel.

**Example:**  
`GET /messages/channel/%23general`

**Success Response (200)**
```json
[
  {
    "id": 12,
    "body": "Hello world!",
    "user_id": 1,
    "attachments": ["https://example.com/new.jpg"],
    "in_reply_to": 1,
    "channel": "general",
    "created_at": "2025-10-24T19:43:12Z"
  }
]
```

**Errors**
- `400` — Channel not specified  
- `500` — Server error retrieving channel messages

---

### `POST /messages`
Create a new message.

**Headers**
```
Authorization: Bearer <token>
```

**Request Body**
```json
{
    "body": "Hello world!",
    "attachments": ["https://example.com/new.jpg"],
    "in_reply_to": 1,
    "channel": "general"
}
```

**Success Response (201)**
```json
{
    "id": 12,
    "body": "Hello world!",
    "user_id": 1,
    "attachments": ["https://example.com/new.jpg"],
    "in_reply_to": 1,
    "channel": "general",
    "created_at": "2025-10-24T19:43:12Z"
}
```

**Errors**
- `400` — Missing `body`  
- `401` — Missing or invalid token  
- `500` — Server error

---

## Channels

### `GET /channels`
Retrieve list of available channels.

**Success Response (200)**
```json
[
  { "channel": "general" },
  { "channel": "random" }
]
```

**Errors**
- `500` — Server error retrieving channels

---

## Notes

- Tokens expire after **1 hour** (expiry is a millisecond timestamp).  
- Token store is **in-memory**; restarting the server clears all tokens.  
- Current implementation stores passwords in plain text — **do not** use this in production; hash passwords (bcrypt or similar) before storing.

---
