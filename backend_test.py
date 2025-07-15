#!/usr/bin/env python3
"""
SnowFriends Backend Testing Suite
Tests the multiplayer game backend system including authentication, WebSocket, and room management.
"""

import asyncio
import json
import requests
import websockets
import uuid
from datetime import datetime
import sys
import os

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except FileNotFoundError:
        pass
    return "http://localhost:8001"

BASE_URL = get_backend_url()
API_URL = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://') + "/api/ws"

print(f"Testing backend at: {API_URL}")
print(f"WebSocket URL: {WS_URL}")

class SnowFriendsBackendTester:
    def __init__(self):
        self.session_token = None
        self.user_data = None
        self.test_results = {
            "auth_system": False,
            "room_management": False,
            "websocket_system": False,
            "player_logic": False
        }
        
    def log_test(self, test_name, status, message=""):
        """Log test results"""
        status_symbol = "✅" if status else "❌"
        print(f"{status_symbol} {test_name}: {message}")
        
    async def test_emergent_auth_system(self):
        """Test the Emergent Authentication System"""
        print("\n=== Testing Emergent Authentication System ===")
        
        try:
            # Test 1: Login endpoint without session_id (should fail)
            print("Testing login without session_id...")
            response = requests.post(f"{API_URL}/auth/login", json={})
            if response.status_code == 422:  # Validation error expected
                self.log_test("Login validation", True, "Correctly rejects empty request")
            else:
                self.log_test("Login validation", False, f"Unexpected status: {response.status_code}")
                
            # Test 2: Login with invalid session_id (should fail)
            print("Testing login with invalid session_id...")
            response = requests.post(f"{API_URL}/auth/login", json={"session_id": "invalid_session"})
            if response.status_code == 401:
                self.log_test("Invalid session handling", True, "Correctly rejects invalid session")
            else:
                self.log_test("Invalid session handling", False, f"Status: {response.status_code}, Response: {response.text}")
                
            # Test 3: Test with mock session (this will fail with real Emergent API but tests the flow)
            print("Testing login flow structure...")
            response = requests.post(f"{API_URL}/auth/login", json={"session_id": "test_session_123"})
            
            # The endpoint should return 401 or 400 since we're using a fake session
            if response.status_code in [400, 401]:
                self.log_test("Auth endpoint structure", True, "Login endpoint is accessible and handles requests")
                self.test_results["auth_system"] = True
            else:
                self.log_test("Auth endpoint structure", False, f"Unexpected response: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            self.log_test("Auth system connectivity", False, f"Connection error: {str(e)}")
            return False
            
        return self.test_results["auth_system"]
    
    async def test_profile_endpoint(self):
        """Test the profile endpoint (requires auth)"""
        print("\n=== Testing Profile Endpoint ===")
        
        try:
            # Test without authorization header
            response = requests.get(f"{API_URL}/profile")
            if response.status_code == 403:  # Forbidden without auth
                self.log_test("Profile auth protection", True, "Correctly requires authentication")
            else:
                self.log_test("Profile auth protection", False, f"Status: {response.status_code}")
                
            # Test with invalid token
            headers = {"Authorization": "Bearer invalid_token"}
            response = requests.get(f"{API_URL}/profile", headers=headers)
            if response.status_code == 401:
                self.log_test("Profile token validation", True, "Correctly rejects invalid token")
            else:
                self.log_test("Profile token validation", False, f"Status: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            self.log_test("Profile endpoint", False, f"Connection error: {str(e)}")
            
    async def test_room_management(self):
        """Test Game Room Management"""
        print("\n=== Testing Game Room Management ===")
        
        try:
            # Test 1: Get rooms list (should work without auth)
            print("Testing room listing...")
            response = requests.get(f"{API_URL}/rooms")
            if response.status_code == 200:
                rooms = response.json()
                self.log_test("Room listing", True, f"Retrieved {len(rooms)} rooms")
                self.test_results["room_management"] = True
            else:
                self.log_test("Room listing", False, f"Status: {response.status_code}")
                
            # Test 2: Create room (requires auth - should fail without token)
            print("Testing room creation without auth...")
            response = requests.post(f"{API_URL}/rooms")
            if response.status_code == 403:
                self.log_test("Room creation auth", True, "Correctly requires authentication")
            else:
                self.log_test("Room creation auth", False, f"Status: {response.status_code}")
                
            # Test 3: Create room with invalid token
            print("Testing room creation with invalid token...")
            headers = {"Authorization": "Bearer invalid_token"}
            response = requests.post(f"{API_URL}/rooms", headers=headers)
            if response.status_code == 401:
                self.log_test("Room creation token validation", True, "Correctly validates token")
            else:
                self.log_test("Room creation token validation", False, f"Status: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            self.log_test("Room management", False, f"Connection error: {str(e)}")
            return False
            
        return self.test_results["room_management"]
    
    async def test_websocket_system(self):
        """Test WebSocket Multiplayer System"""
        print("\n=== Testing WebSocket Multiplayer System ===")
        
        try:
            # Generate test room ID
            room_id = str(uuid.uuid4())
            ws_url = f"{WS_URL}/{room_id}"
            
            print(f"Testing WebSocket connection to: {ws_url}")
            
            # Test WebSocket connection
            async with websockets.connect(ws_url) as websocket:
                self.log_test("WebSocket connection", True, "Successfully connected")
                
                # Test receiving initial messages
                try:
                    # Should receive player_joined message
                    message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data = json.loads(message)
                    
                    if data.get("type") == "player_joined":
                        self.log_test("Player join message", True, "Received player_joined event")
                        self.test_results["websocket_system"] = True
                    else:
                        self.log_test("Player join message", False, f"Unexpected message: {data}")
                        
                except asyncio.TimeoutError:
                    self.log_test("Initial WebSocket message", False, "No initial message received")
                    
                # Test sending player_update message
                player_update = {
                    "type": "player_update",
                    "position": {"x": 100, "y": 200}
                }
                await websocket.send(json.dumps(player_update))
                self.log_test("Send player update", True, "Sent player update message")
                
                # Test sending snowball_throw message
                snowball_throw = {
                    "type": "snowball_throw",
                    "position": {"x": 100, "y": 200},
                    "target": {"x": 300, "y": 400}
                }
                await websocket.send(json.dumps(snowball_throw))
                self.log_test("Send snowball throw", True, "Sent snowball throw message")
                
                # Test sending player_ready message
                player_ready = {
                    "type": "player_ready",
                    "ready": True
                }
                await websocket.send(json.dumps(player_ready))
                self.log_test("Send player ready", True, "Sent player ready message")
                
                # Try to receive responses
                try:
                    for i in range(3):  # Try to receive up to 3 messages
                        message = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                        data = json.loads(message)
                        self.log_test(f"WebSocket response {i+1}", True, f"Type: {data.get('type')}")
                except asyncio.TimeoutError:
                    self.log_test("WebSocket responses", True, "No more messages (expected)")
                    
        except websockets.exceptions.WebSocketException as e:
            self.log_test("WebSocket connection", False, f"WebSocket error: {str(e)}")
            return False
        except Exception as e:
            self.log_test("WebSocket system", False, f"Error: {str(e)}")
            return False
            
        return self.test_results["websocket_system"]
    
    async def test_player_logic(self):
        """Test Player Movement and Game Logic through WebSocket"""
        print("\n=== Testing Player Movement and Game Logic ===")
        
        try:
            room_id = str(uuid.uuid4())
            ws_url = f"{WS_URL}/{room_id}"
            
            # Test with two simulated players
            async def simulate_player(player_name):
                async with websockets.connect(ws_url) as websocket:
                    # Wait for join message
                    join_msg = await websocket.recv()
                    join_data = json.loads(join_msg)
                    
                    if join_data.get("type") == "player_joined":
                        self.log_test(f"{player_name} joined", True, "Player successfully joined room")
                        
                        # Send ready status
                        await websocket.send(json.dumps({
                            "type": "player_ready",
                            "ready": True
                        }))
                        
                        # Send some movement updates
                        for i in range(3):
                            await websocket.send(json.dumps({
                                "type": "player_update",
                                "position": {"x": 100 + i * 50, "y": 200 + i * 30}
                            }))
                            await asyncio.sleep(0.1)
                            
                        # Send snowball throw
                        await websocket.send(json.dumps({
                            "type": "snowball_throw",
                            "position": {"x": 250, "y": 290},
                            "target": {"x": 400, "y": 300}
                        }))
                        
                        return True
                    return False
            
            # Run two players concurrently
            results = await asyncio.gather(
                simulate_player("Player1"),
                simulate_player("Player2"),
                return_exceptions=True
            )
            
            success_count = sum(1 for r in results if r is True)
            if success_count >= 1:
                self.log_test("Multi-player simulation", True, f"{success_count}/2 players succeeded")
                self.test_results["player_logic"] = True
            else:
                self.log_test("Multi-player simulation", False, "No players succeeded")
                
        except Exception as e:
            self.log_test("Player logic test", False, f"Error: {str(e)}")
            return False
            
        return self.test_results["player_logic"]
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print("🎮 Starting SnowFriends Backend Tests 🎮")
        print("=" * 50)
        
        # Test each system
        await self.test_emergent_auth_system()
        await self.test_profile_endpoint()
        await self.test_room_management()
        await self.test_websocket_system()
        await self.test_player_logic()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        total_tests = len(self.test_results)
        passed_tests = sum(self.test_results.values())
        
        for test_name, result in self.test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name.replace('_', ' ').title()}")
            
        print(f"\nOverall: {passed_tests}/{total_tests} systems working")
        
        if passed_tests == total_tests:
            print("🎉 All backend systems are working!")
            return True
        else:
            print("⚠️  Some backend systems need attention")
            return False

async def main():
    """Main test runner"""
    tester = SnowFriendsBackendTester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())