# Whop 3D Shooter Game - Setup Guide

This is a multiplayer 3D shooting game built for Whop platform integration with iframe embedding and authentication.

## Features

- **Whop Authentication**: Seamless integration with Whop's JWT authentication system
- **Experience View**: Configured at `/experiences/[experienceId]` for iframe embedding
- **2-Player Multiplayer**: Room-based matchmaking with WebSocket real-time sync
- **3D Graphics**: Built with Three.js and React Three Fiber
- **First-Person Shooter**: WASD movement, mouse aim, click to shoot
- **Health System**: Visual health bars and damage tracking
- **Match System**: First to eliminate opponent wins

## Whop App Configuration

### 1. Create Whop App

1. Go to [Whop Developer Dashboard](https://whop.com/dashboard/developer)
2. Click "Create app" and name your app
3. Copy the `WHOP_API_KEY` from Environment variables section
4. Copy the `WHOP_APP_ID` (the app ID visible in the dashboard)

### 2. Configure Hosting Settings

In the Hosting section of your Whop app:

1. **Base URL**: Set to your Replit deployment URL (e.g., `https://your-repl.replit.app`)
2. **Experience View Path**: Set to `/experiences/[experienceId]`
3. Enable "Experience View" in the app views

### 3. Set Environment Variables

Add these environment variables to your Replit secrets:

```
WHOP_API_KEY=your_whop_api_key_here
WHOP_APP_ID=your_whop_app_id_here
```

## Local Development

### Install Dependencies

```bash
npm install
```

### Set Environment Variables

Create a `.env` file or use Replit secrets:

```
WHOP_API_KEY=your_api_key
WHOP_APP_ID=your_app_id
```

### Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5000`

### Testing Locally with Whop

To test the Whop integration locally:

1. Install your app in Whop
2. Use Whop's dev proxy to test locally (see [Whop dev proxy docs](https://docs.whop.com/developer/guides/dev-proxy))
3. Access the experience view through Whop's interface

## How to Play

### Controls

- **WASD** - Move around the arena
- **Mouse** - Aim your weapon
- **Left Click** - Shoot
- **Objective** - Eliminate your opponent to win!

### Gameplay Flow

1. **Lobby**: Create a new room or join an existing one
2. **Waiting**: Wait for the second player to join
3. **Playing**: Battle in the 3D arena until one player is eliminated
4. **Game Over**: View match statistics and play again or return to lobby

## Architecture

### Client-Side

- **React** with TypeScript
- **Three.js** for 3D graphics via React Three Fiber
- **Zustand** for state management
- **Wouter** for routing
- **Tailwind CSS** for UI styling

### Server-Side

- **Express.js** for HTTP server
- **WebSocket (ws)** for real-time multiplayer
- **Whop SDK** for authentication and access control

### Key Components

- `ExperiencePage` - Main entry point with authentication check
- `Game` - Game orchestrator with keyboard controls
- `Lobby` - Room listing and creation
- `GameScene` - 3D canvas and game rendering
- `LocalPlayer` - Controlled player with movement and shooting
- `RemotePlayer` - Other players in the room
- `GameHUD` - Health bars and game UI overlay
- `GameServer` - WebSocket server handling multiplayer logic

## API Endpoints

- `POST /api/verify-token` - Verify Whop user token
- `POST /api/check-access` - Check user access to experience
- `GET /api/health` - Health check endpoint

## WebSocket Events

### Client → Server

- `authenticate` - Authenticate with Whop token
- `create_room` - Create a new game room
- `join_room` - Join an existing room
- `leave_room` - Leave current room
- `player_update` - Update player position/rotation
- `shoot` - Fire a bullet
- `hit` - Report bullet hit on player
- `start_game` - Start a new game

### Server → Client

- `authenticated` - Authentication successful
- `rooms_list` - List of available rooms
- `room_joined` - Joined a room
- `player_joined` - Another player joined
- `player_left` - Player left room
- `game_started` - Game started
- `player_moved` - Player position update
- `bullet_fired` - Bullet created
- `player_damaged` - Player took damage
- `player_killed` - Player eliminated
- `game_ended` - Match finished

## Deployment

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

### Publishing to Whop

1. Deploy your app to Replit (or any hosting provider)
2. Update the Base URL in Whop app settings
3. Install the app to your Whop community
4. Users can access the game through the experience view

## Troubleshooting

### Authentication Issues

- Ensure `WHOP_API_KEY` and `WHOP_APP_ID` are set correctly
- Check that the token is being passed in the `x-whop-user-token` header
- Verify the experience ID matches your Whop configuration

### WebSocket Connection Issues

- Check that WebSocket endpoint `/ws/game` is accessible
- Verify CORS headers are properly configured
- Ensure the protocol (ws/wss) matches your deployment (http/https)

### Game Not Loading

- Check browser console for errors
- Verify all dependencies are installed
- Ensure the server is running on port 5000

## Support

For Whop-specific issues, refer to:
- [Whop Developer Documentation](https://docs.whop.com/developer)
- [Whop Authentication Guide](https://docs.whop.com/developer/guides/authentication)
- [Whop App Views Guide](https://docs.whop.com/developer/guides/app-views)
