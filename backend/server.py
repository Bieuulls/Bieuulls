from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import json
import asyncio
import requests
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="SnowFriends: Batalha de Neve API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.game_rooms: Dict[str, Dict[str, Any]] = {}
        self.user_rooms: Dict[str, str] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.user_rooms:
            room_id = self.user_rooms[user_id]
            self.leave_room(user_id, room_id)

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)

    async def broadcast_to_room(self, message: str, room_id: str):
        if room_id in self.game_rooms:
            for user_id in self.game_rooms[room_id]["players"]:
                if user_id in self.active_connections:
                    await self.active_connections[user_id].send_text(message)

    def join_room(self, user_id: str, room_id: str):
        if room_id not in self.game_rooms:
            self.game_rooms[room_id] = {
                "players": {},
                "game_state": "lobby",
                "map": "vila_congelada",
                "created_at": datetime.utcnow(),
                "max_players": 16
            }
        
        if len(self.game_rooms[room_id]["players"]) < self.game_rooms[room_id]["max_players"]:
            self.game_rooms[room_id]["players"][user_id] = {
                "ready": False,
                "character_class": "corredor",
                "position": {"x": 400, "y": 300},
                "health": 100,
                "frozen": False,
                "score": 0
            }
            self.user_rooms[user_id] = room_id
            return True
        return False

    def leave_room(self, user_id: str, room_id: str):
        if room_id in self.game_rooms and user_id in self.game_rooms[room_id]["players"]:
            del self.game_rooms[room_id]["players"][user_id]
            if user_id in self.user_rooms:
                del self.user_rooms[user_id]
            
            # Remove empty rooms
            if not self.game_rooms[room_id]["players"]:
                del self.game_rooms[room_id]

manager = ConnectionManager()

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    level: int = 1
    coins: int = 0
    wins: int = 0
    losses: int = 0
    customizations: Dict[str, Any] = Field(default_factory=dict)

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CharacterClass(str, Enum):
    CORREDOR = "corredor"
    TANQUE = "tanque"
    CONSTRUTOR = "construtor"
    SCOUT = "scout"

class GameRoom(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    players: Dict[str, Any] = Field(default_factory=dict)
    game_state: str = "lobby"
    map: str = "vila_congelada"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    max_players: int = 16

class PlayerUpdate(BaseModel):
    position: Dict[str, float]
    action: Optional[str] = None
    target: Optional[Dict[str, float]] = None

class AuthRequest(BaseModel):
    session_id: str

class ProfileResponse(BaseModel):
    user: User
    session_token: str

# Authentication functions
async def verify_session_token(authorization: HTTPAuthorizationCredentials = Depends(security)):
    token = authorization.credentials
    session = await db.sessions.find_one({"session_token": token})
    
    if not session or datetime.utcnow() > session["expires_at"]:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

# Routes
@api_router.post("/auth/login", response_model=ProfileResponse)
async def login(auth_request: AuthRequest):
    """Login using Emergent auth session ID"""
    try:
        # Call Emergent auth API
        response = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": auth_request.session_id}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session ID")
        
        auth_data = response.json()
        
        # Check if user exists
        user = await db.users.find_one({"email": auth_data["email"]})
        
        if not user:
            # Create new user
            user_data = User(
                email=auth_data["email"],
                name=auth_data["name"],
                picture=auth_data.get("picture")
            )
            await db.users.insert_one(user_data.dict())
            user = user_data.dict()
        
        # Create session
        session_data = Session(
            user_id=user["id"],
            session_token=auth_data["session_token"],
            expires_at=datetime.utcnow() + timedelta(days=7)
        )
        await db.sessions.insert_one(session_data.dict())
        
        return ProfileResponse(user=User(**user), session_token=auth_data["session_token"])
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/profile", response_model=User)
async def get_profile(user: dict = Depends(verify_session_token)):
    return User(**user)

@api_router.get("/rooms")
async def get_rooms():
    """Get list of available game rooms"""
    rooms = []
    for room_id, room_data in manager.game_rooms.items():
        rooms.append({
            "id": room_id,
            "name": f"Sala {room_id[:8]}",
            "players": len(room_data["players"]),
            "max_players": room_data["max_players"],
            "game_state": room_data["game_state"],
            "map": room_data["map"]
        })
    return rooms

@api_router.post("/rooms")
async def create_room(user: dict = Depends(verify_session_token)):
    """Create a new game room"""
    room_id = str(uuid.uuid4())
    manager.game_rooms[room_id] = {
        "players": {},
        "game_state": "lobby",
        "map": "vila_congelada",
        "created_at": datetime.utcnow(),
        "max_players": 16
    }
    
    return {"room_id": room_id, "message": "Room created successfully"}

@api_router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    # Simple WebSocket connection for now (will add auth later)
    user_id = str(uuid.uuid4())  # Generate temp user ID
    
    await manager.connect(websocket, user_id)
    
    # Join room
    if manager.join_room(user_id, room_id):
        await manager.broadcast_to_room(
            json.dumps({
                "type": "player_joined",
                "user_id": user_id,
                "room_state": manager.game_rooms[room_id]
            }),
            room_id
        )
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message["type"] == "player_update":
                if room_id in manager.game_rooms and user_id in manager.game_rooms[room_id]["players"]:
                    manager.game_rooms[room_id]["players"][user_id]["position"] = message["position"]
                    
                    # Broadcast to all players in room
                    await manager.broadcast_to_room(
                        json.dumps({
                            "type": "player_update",
                            "user_id": user_id,
                            "position": message["position"]
                        }),
                        room_id
                    )
            
            elif message["type"] == "snowball_throw":
                # Handle snowball throwing
                await manager.broadcast_to_room(
                    json.dumps({
                        "type": "snowball_throw",
                        "user_id": user_id,
                        "position": message["position"],
                        "target": message["target"]
                    }),
                    room_id
                )
            
            elif message["type"] == "player_ready":
                if room_id in manager.game_rooms and user_id in manager.game_rooms[room_id]["players"]:
                    manager.game_rooms[room_id]["players"][user_id]["ready"] = message["ready"]
                    
                    await manager.broadcast_to_room(
                        json.dumps({
                            "type": "player_ready",
                            "user_id": user_id,
                            "ready": message["ready"],
                            "room_state": manager.game_rooms[room_id]
                        }),
                        room_id
                    )
                    
                    # Check if all players are ready
                    all_ready = all(
                        player_data["ready"] 
                        for player_data in manager.game_rooms[room_id]["players"].values()
                    )
                    
                    if all_ready and len(manager.game_rooms[room_id]["players"]) >= 2:
                        manager.game_rooms[room_id]["game_state"] = "playing"
                        await manager.broadcast_to_room(
                            json.dumps({
                                "type": "game_start",
                                "room_state": manager.game_rooms[room_id]
                            }),
                            room_id
                        )
            
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await manager.broadcast_to_room(
            json.dumps({
                "type": "player_left",
                "user_id": user_id,
                "room_state": manager.game_rooms.get(room_id, {})
            }),
            room_id
        )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()