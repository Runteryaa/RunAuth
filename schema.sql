CREATE TABLE runauth_users (
    id VARCHAR2(255) PRIMARY KEY,
    email VARCHAR2(255) UNIQUE NOT NULL,
    password_hash VARCHAR2(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE runauth_sessions (
    id VARCHAR2(255) PRIMARY KEY,
    user_id VARCHAR2(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_session FOREIGN KEY (user_id) REFERENCES runauth_users(id) ON DELETE CASCADE
);

CREATE TABLE runauth_apps (
    client_id VARCHAR2(255) PRIMARY KEY,
    client_secret VARCHAR2(255) NOT NULL,
    app_name VARCHAR2(100) NOT NULL,
    redirect_uri VARCHAR2(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
