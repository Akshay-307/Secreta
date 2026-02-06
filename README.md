# Secreta - End-to-End Encrypted Chat

A secure, privacy-first messaging application with true end-to-end encryption. Your messages are encrypted on your device before being sent, and only the intended recipient can decrypt them.

## 🔐 Security Features

- **End-to-End Encryption**: Messages encrypted with AES-256-GCM
- **ECDH Key Exchange**: P-256 curve for secure key agreement
- **Forward Secrecy**: Ephemeral keys generated per message
- **Local Key Storage**: Private keys stored in IndexedDB, never leave your browser
- **Zero Server Knowledge**: Server only sees encrypted blobs

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### 1. Start MongoDB

```bash
# If using local MongoDB
mongod
```

### 2. Start the Server

```bash
cd server
npm install
npm run dev
```

Server runs on `http://localhost:3001`

### 3. Start the Client

```bash
cd client
npm install
npm run dev
```

Client runs on `http://localhost:5173`

## 📁 Project Structure

```
SECRET/
├── server/                 # Backend
│   ├── src/
│   │   ├── config/        # Database config
│   │   ├── models/        # MongoDB schemas
│   │   ├── routes/        # API endpoints
│   │   ├── middleware/    # Auth middleware
│   │   ├── socket/        # Real-time handlers
│   │   └── index.js       # Entry point
│   └── .env               # Environment vars
│
└── client/                 # Frontend
    └── src/
        ├── crypto/        # 🔐 Encryption modules
        ├── api/           # API & Socket client
        ├── context/       # React context
        ├── pages/         # Page components
        └── components/    # UI components
```

## 🔒 Cryptographic Flow

1. **Registration**: ECDH key pair generated in browser, public key sent to server
2. **Message Send**: 
   - Generate ephemeral ECDH key pair
   - Derive shared secret with recipient's public key
   - Encrypt message with AES-256-GCM
   - Send encrypted payload
3. **Message Receive**:
   - Use stored private key + sender's ephemeral public key
   - Derive same shared secret
   - Decrypt message

## 🛡️ Security Guarantees

| What | How |
|------|-----|
| Confidentiality | AES-256-GCM symmetric encryption |
| Key Exchange | ECDH with P-256 (NIST standard) |
| Forward Secrecy | New ephemeral key per message |
| Authentication | JWT + bcrypt password hashing |
| Integrity | GCM authenticated encryption |

## ⚠️ Important Notes

- Private keys are stored in your browser's IndexedDB
- Clearing browser data will delete your keys (you'll need to generate new ones)
- Messages are stored encrypted on the server - they cannot be recovered if keys are lost
