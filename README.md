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
deno run --allow-net --allow-env server.ts
```

