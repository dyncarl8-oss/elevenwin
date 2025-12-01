# Whop 3D Multiplayer Shooter Game

## Overview

This is a multiplayer 3D first-person shooter game built for the Whop platform. The application provides an iframe-embeddable experience view that integrates with Whop's authentication system, allowing users to play 2-player matches in a 3D arena environment. Players compete in real-time combat with WASD movement, mouse-aim controls, and multiple weapon types, with the first player to eliminate their opponent winning the match.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Rendering:**
- React with TypeScript as the core UI framework
- Vite as the build tool and development server
- React Three Fiber (@react-three/fiber) for 3D rendering using Three.js
- React Three Drei (@react-three/drei) for helper components and controls
- WebGL-based 3D graphics with shader support via vite-plugin-glsl

**State Management:**
- Zustand for global game state management (useGameStore)
- Real-time state synchronization via WebSocket
- Session token storage in sessionStorage

**UI Component System:**
- Radix UI primitives for accessible component building blocks
- Tailwind CSS for styling with custom design tokens
- shadcn/ui component patterns
- Class Variance Authority (CVA) for component variant management

**Routing:**
- Wouter for client-side routing
- Single primary route: `/experiences/:experienceId` for Whop iframe embedding
- Wildcard route support for nested paths

**3D Game Components:**
- First-person camera controls with pointer lock
- WASD keyboard movement system
- Mouse-based aiming and shooting
- Weapon viewmodel rendering
- Health system with visual feedback
- Crosshair overlay
- Arena environment with walls and cover objects
- Bullet physics and collision detection

### Backend Architecture

**Server Framework:**
- Express.js for HTTP server
- Node.js with ES modules
- TypeScript for type safety
- Separate development (tsx) and production (esbuild bundled) entry points

**Real-time Communication:**
- WebSocket server (ws library) for game state synchronization
- Custom GameServer class managing rooms and player connections
- Binary protocol for efficient real-time updates
- Room-based matchmaking (2 players per room)

**Authentication & Authorization:**
- Whop SDK integration for JWT token verification
- Session token generation using jsonwebtoken
- Development mode fallback for local testing without Whop
- Token verification middleware on WebSocket connections

**Game Server Architecture:**
- Room-based architecture with max 2 players per room
- Game phases: lobby → waiting → playing → finished
- Server-authoritative bullet collision detection
- Player position and rotation interpolation
- Health tracking and damage calculation
- Match statistics collection

**API Endpoints:**
- POST `/api/verify-token` - Verify Whop user tokens
- POST `/api/check-access` - Check user access to experiences and create session tokens
- WebSocket `/ws/game` - Real-time game communication

### Data Storage Solutions

**Database:**
- PostgreSQL via Drizzle ORM
- Connection pooling with node-postgres (pg)
- Schema-first approach with TypeScript types

**Database Schema:**
- `users` table - User authentication (currently unused, may be deprecated)
- `matches` table - Match history with winner, room, duration, and experience tracking
- `match_players` table - Per-player match statistics (kills, deaths, damage, accuracy)

**Data Access Layer:**
- IStorage interface for abstraction
- MemStorage in-memory implementation for development
- Database-backed storage for production
- Methods for user CRUD, match creation, and statistics retrieval

**State Persistence:**
- Match results stored in database
- Player statistics aggregated from match history
- Session tokens stored client-side in sessionStorage

### External Dependencies

**Whop Platform Integration:**
- Whop SDK (@whop/sdk) for authentication and access control
- Environment variables: WHOP_API_KEY, WHOP_APP_ID
- JWT token verification for user identity
- Access level checking for experience resources
- Iframe embedding at `/experiences/[experienceId]` path

**Database Service:**
- Neon Database (@neondatabase/serverless) for PostgreSQL hosting
- DATABASE_URL environment variable for connection
- Drizzle Kit for schema migrations

**3D Graphics Dependencies:**
- Three.js for WebGL rendering
- React Three Fiber ecosystem for React integration
- React Three Postprocessing for visual effects
- GLSL shader support

**Development Tools:**
- Replit integration for hosting and deployment
- Runtime error overlay for development debugging
- Hot module replacement via Vite

**UI Libraries:**
- Radix UI component primitives (30+ component packages)
- Tailwind CSS for utility-first styling
- Lucide React for icons
- Inter font via @fontsource

**Build & Development:**
- TypeScript compiler for type checking
- esbuild for production bundling
- Vite for development server and client bundling
- PostCSS with Tailwind and Autoprefixer