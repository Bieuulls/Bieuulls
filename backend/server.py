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
import random

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

# Game Maps
GAME_MAPS = {
    "vila_congelada": {
        "name": "Vila Congelada",
        "description": "Ruas com bonecos de neve e cabanas acolhedoras",
        "spawn_points": [
            {"x": 100, "y": 100, "team": "blue"},
            {"x": 700, "y": 100, "team": "blue"},
            {"x": 100, "y": 500, "team": "red"},
            {"x": 700, "y": 500, "team": "red"}
        ],
        "obstacles": [
            {"x": 200, "y": 200, "width": 50, "height": 50, "type": "snowman"},
            {"x": 600, "y": 300, "width": 100, "height": 80, "type": "cabin"}
        ],
        "power_ups": [
            {"x": 400, "y": 300, "type": "speed_boost"},
            {"x": 300, "y": 400, "type": "shield"}
        ]
    },
    "parque_nevasca": {
        "name": "Parque da Nevasca",
        "description": "Lagos congelados e trilhas escorregadias",
        "spawn_points": [
            {"x": 50, "y": 50, "team": "blue"},
            {"x": 750, "y": 50, "team": "blue"},
            {"x": 50, "y": 550, "team": "red"},
            {"x": 750, "y": 550, "team": "red"}
        ],
        "obstacles": [
            {"x": 150, "y": 150, "width": 200, "height": 100, "type": "frozen_lake"},
            {"x": 450, "y": 350, "width": 150, "height": 150, "type": "ice_sculpture"}
        ],
        "power_ups": [
            {"x": 200, "y": 300, "type": "freeze_boost"},
            {"x": 600, "y": 200, "type": "snow_ammunition"}
        ]
    },
    "castelo_gelo": {
        "name": "Castelo de Gelo",
        "description": "Corredores com muralhas de cristal",
        "spawn_points": [
            {"x": 80, "y": 80, "team": "blue"},
            {"x": 720, "y": 80, "team": "blue"},
            {"x": 80, "y": 520, "team": "red"},
            {"x": 720, "y": 520, "team": "red"}
        ],
        "obstacles": [
            {"x": 300, "y": 100, "width": 200, "height": 50, "type": "ice_wall"},
            {"x": 300, "y": 450, "width": 200, "height": 50, "type": "ice_wall"},
            {"x": 400, "y": 250, "width": 100, "height": 100, "type": "crystal_tower"}
        ],
        "power_ups": [
            {"x": 400, "y": 150, "type": "crystal_power"},
            {"x": 150, "y": 300, "type": "wall_builder"}
        ]
    }
}

# NPCs with predefined dialogues
NPCS = {
    "winter_guide": {
        "name": "Guia do Inverno",
        "position": {"x": 50, "y": 50},
        "sprite": "winter_guide",
        "dialogues": [
            "Bem-vindos ao SnowFriends! Aqui vocês podem se divertir com batalhas de neve seguras!",
            "Lembrem-se: o objetivo é congelar temporariamente, não machucar!",
            "Trabalhem em equipe para descongelar seus aliados!",
            "Explorem diferentes mapas para descobrir estratégias únicas!"
        ]
    },
    "shop_keeper": {
        "name": "Lojista das Neves",
        "position": {"x": 750, "y": 50},
        "sprite": "shop_keeper",
        "dialogues": [
            "Olá! Quer personalizar seu personagem? Tenho ótimas opções!",
            "Gorros, casacos e mochilas esperando por você!",
            "Cada vitória te dá moedas para comprar novos itens!",
            "Que tal um visual único para se destacar nas batalhas?"
        ]
    },
    "trainer": {
        "name": "Treinador de Neve",
        "position": {"x": 400, "y": 550},
        "sprite": "trainer",
        "dialogues": [
            "Quer melhorar suas habilidades? Posso te dar algumas dicas!",
            "Classes diferentes têm estratégias diferentes!",
            "Corredores são ótimos para resgatar aliados congelados!",
            "Tanques podem resistir a mais ataques antes de congelar!"
        ]
    }
}

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.game_rooms: Dict[str, Dict[str, Any]] = {}
        self.user_rooms: Dict[str, str] = {}
        self.game_states: Dict[str, Dict[str, Any]] = {}

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
            try:
                await self.active_connections[user_id].send_text(message)
            except:
                self.disconnect(user_id)

    async def broadcast_to_room(self, message: str, room_id: str):
        if room_id in self.game_rooms:
            for user_id in list(self.game_rooms[room_id]["players"].keys()):
                if user_id in self.active_connections:
                    try:
                        await self.active_connections[user_id].send_text(message)
                    except:
                        self.disconnect(user_id)

    def join_room(self, user_id: str, room_id: str, user_name: str = None):
        if room_id not in self.game_rooms:
            self.game_rooms[room_id] = {
                "players": {},
                "game_state": "lobby",
                "map": "vila_congelada",
                "created_at": datetime.utcnow(),
                "max_players": 16,
                "match_duration": 300,  # 5 minutes
                "score": {"blue": 0, "red": 0}
            }
        
        if len(self.game_rooms[room_id]["players"]) < self.game_rooms[room_id]["max_players"]:
            # Assign team (alternating)
            teams = ["blue", "red"]
            team = teams[len(self.game_rooms[room_id]["players"]) % 2]
            
            # Get spawn point for team
            map_data = GAME_MAPS[self.game_rooms[room_id]["map"]]
            spawn_points = [sp for sp in map_data["spawn_points"] if sp["team"] == team]
            spawn_point = random.choice(spawn_points)
            
            self.game_rooms[room_id]["players"][user_id] = {
                "name": user_name or f"Player_{user_id[:8]}",
                "ready": False,
                "character_class": "corredor",
                "team": team,
                "position": {"x": spawn_point["x"], "y": spawn_point["y"]},
                "health": 100,
                "frozen": False,
                "frozen_time": 0,
                "score": 0,
                "customization": {
                    "hat": "basic",
                    "coat": "blue",
                    "backpack": "none"
                },
                "power_ups": []
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

    def update_game_state(self, room_id: str):
        if room_id not in self.game_rooms:
            return
        
        room = self.game_rooms[room_id]
        
        # Update frozen players
        for player_id, player in room["players"].items():
            if player["frozen"] and player["frozen_time"] > 0:
                player["frozen_time"] -= 1
                if player["frozen_time"] <= 0:
                    player["frozen"] = False
                    player["health"] = 100
        
        # Check win conditions
        if room["game_state"] == "playing":
            blue_frozen = sum(1 for p in room["players"].values() if p["team"] == "blue" and p["frozen"])
            red_frozen = sum(1 for p in room["players"].values() if p["team"] == "red" and p["frozen"])
            
            blue_total = sum(1 for p in room["players"].values() if p["team"] == "blue")
            red_total = sum(1 for p in room["players"].values() if p["team"] == "red")
            
            if blue_total > 0 and blue_frozen == blue_total:
                room["game_state"] = "finished"
                room["winner"] = "red"
            elif red_total > 0 and red_frozen == red_total:
                room["game_state"] = "finished"
                room["winner"] = "blue"

manager = ConnectionManager()

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    level: int = 1
    experience: int = 0
    coins: int = 100
    wins: int = 0
    losses: int = 0
    matches_played: int = 0
    total_freezes: int = 0
    total_unfreezes: int = 0
    rank: str = "Novato"
    customizations: Dict[str, Any] = Field(default_factory=dict)
    achievements: List[str] = Field(default_factory=list)

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

class ShopItem(BaseModel):
    id: str
    name: str
    type: str  # hat, coat, backpack
    price: int
    description: str
    image_url: str

class PurchaseRequest(BaseModel):
    item_id: str

# Shop items
SHOP_ITEMS = [
    ShopItem(id="hat_001", name="Gorro Vermelho", type="hat", price=50, description="Um gorro vermelho acolhedor", image_url=""),
    ShopItem(id="hat_002", name="Gorro com Pompom", type="hat", price=75, description="Gorro com pompom fofo", image_url=""),
    ShopItem(id="coat_001", name="Casaco Azul", type="coat", price=100, description="Casaco azul resistente", image_url=""),
    ShopItem(id="coat_002", name="Casaco Listrado", type="coat", price=150, description="Casaco com listras coloridas", image_url=""),
    ShopItem(id="backpack_001", name="Mochila Básica", type="backpack", price=80, description="Mochila para carregar bolas de neve", image_url=""),
    ShopItem(id="backpack_002", name="Mochila Deluxe", type="backpack", price=200, description="Mochila com capacidade extra", image_url="")
]

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
                picture=auth_data.get("picture"),
                customizations={
                    "hat": "basic",
                    "coat": "blue",
                    "backpack": "none"
                }
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
            "map": room_data["map"],
            "map_name": GAME_MAPS[room_data["map"]]["name"]
        })
    return rooms

@api_router.post("/rooms")
async def create_room(user: dict = Depends(verify_session_token)):
    """Create a new game room"""
    room_id = str(uuid.uuid4())
    return {"room_id": room_id, "message": "Room created successfully"}

@api_router.get("/maps")
async def get_maps():
    """Get available game maps"""
    return GAME_MAPS

@api_router.get("/shop")
async def get_shop_items():
    """Get shop items"""
    return SHOP_ITEMS

@api_router.post("/shop/purchase")
async def purchase_item(purchase: PurchaseRequest, user: dict = Depends(verify_session_token)):
    """Purchase an item from the shop"""
    # Find the item
    item = next((item for item in SHOP_ITEMS if item.id == purchase.item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Check if user has enough coins
    if user["coins"] < item.price:
        raise HTTPException(status_code=400, detail="Insufficient coins")
    
    # Update user's coins and add item
    new_coins = user["coins"] - item.price
    user_customizations = user.get("customizations", {})
    user_customizations[item.type] = item.id
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"coins": new_coins, "customizations": user_customizations}}
    )
    
    return {"message": "Item purchased successfully", "remaining_coins": new_coins}

@api_router.get("/leaderboard")
async def get_leaderboard():
    """Get leaderboard"""
    users = await db.users.find().sort("wins", -1).limit(10).to_list(10)
    return users

@api_router.get("/npcs")
async def get_npcs():
    """Get NPC information"""
    return NPCS

@api_router.post("/npc/talk/{npc_id}")
async def talk_to_npc(npc_id: str, user: dict = Depends(verify_session_token)):
    """Talk to an NPC"""
    if npc_id not in NPCS:
        raise HTTPException(status_code=404, detail="NPC not found")
    
    npc = NPCS[npc_id]
    dialogue = random.choice(npc["dialogues"])
    
    return {
        "npc_name": npc["name"],
        "dialogue": dialogue,
        "npc_sprite": npc["sprite"]
    }

# HTTP Polling endpoint for real-time updates (WebSocket fallback)
@api_router.get("/rooms/{room_id}/state")
async def get_room_state(room_id: str):
    """Get current room state (WebSocket fallback)"""
    if room_id not in manager.game_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return manager.game_rooms[room_id]

@api_router.post("/rooms/{room_id}/join")
async def join_room_http(room_id: str, user: dict = Depends(verify_session_token)):
    """Join a room via HTTP (WebSocket fallback)"""
    if manager.join_room(user["id"], room_id, user["name"]):
        return {"message": "Joined room successfully", "room_state": manager.game_rooms[room_id]}
    else:
        raise HTTPException(status_code=400, detail="Room is full")

@api_router.post("/rooms/{room_id}/update")
async def update_player_http(room_id: str, update: PlayerUpdate, user: dict = Depends(verify_session_token)):
    """Update player position via HTTP (WebSocket fallback)"""
    if room_id in manager.game_rooms and user["id"] in manager.game_rooms[room_id]["players"]:
        manager.game_rooms[room_id]["players"][user["id"]]["position"] = update.position
        return {"message": "Position updated"}
    else:
        raise HTTPException(status_code=404, detail="Player not in room")

@api_router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
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
            
            elif message["type"] == "player_hit":
                # Handle player being hit by snowball
                if room_id in manager.game_rooms and message["target_id"] in manager.game_rooms[room_id]["players"]:
                    target_player = manager.game_rooms[room_id]["players"][message["target_id"]]
                    
                    if not target_player["frozen"]:
                        target_player["health"] -= 25
                        
                        if target_player["health"] <= 0:
                            target_player["frozen"] = True
                            target_player["frozen_time"] = 180  # 3 minutes
                            target_player["health"] = 0
                            
                            # Award points to attacker
                            if user_id in manager.game_rooms[room_id]["players"]:
                                manager.game_rooms[room_id]["players"][user_id]["score"] += 10
                        
                        await manager.broadcast_to_room(
                            json.dumps({
                                "type": "player_hit",
                                "attacker_id": user_id,
                                "target_id": message["target_id"],
                                "target_health": target_player["health"],
                                "frozen": target_player["frozen"]
                            }),
                            room_id
                        )
            
            elif message["type"] == "player_unfreeze":
                # Handle player unfreezing ally
                if room_id in manager.game_rooms and message["target_id"] in manager.game_rooms[room_id]["players"]:
                    target_player = manager.game_rooms[room_id]["players"][message["target_id"]]
                    ally_player = manager.game_rooms[room_id]["players"][user_id]
                    
                    if (target_player["frozen"] and 
                        target_player["team"] == ally_player["team"]):
                        
                        target_player["frozen"] = False
                        target_player["frozen_time"] = 0
                        target_player["health"] = 100
                        
                        # Award points to unfreezer
                        ally_player["score"] += 5
                        
                        await manager.broadcast_to_room(
                            json.dumps({
                                "type": "player_unfrozen",
                                "unfreezer_id": user_id,
                                "target_id": message["target_id"]
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

# Background task to update game states
async def game_state_updater():
    while True:
        for room_id in list(manager.game_rooms.keys()):
            manager.update_game_state(room_id)
        await asyncio.sleep(1)

# Start background task
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(game_state_updater())

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