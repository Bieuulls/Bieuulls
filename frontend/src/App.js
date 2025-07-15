import React, { useState, useEffect, useRef, useContext, createContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState(localStorage.getItem('sessionToken'));

  useEffect(() => {
    if (sessionToken) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [sessionToken]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API}/profile`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (sessionId) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { session_id: sessionId });
      setUser(response.data.user);
      setSessionToken(response.data.session_token);
      localStorage.setItem('sessionToken', response.data.session_token);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setSessionToken(null);
    localStorage.removeItem('sessionToken');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Home/Landing Page
const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogin = () => {
    const redirectUrl = encodeURIComponent(window.location.origin + '/profile');
    window.location.href = `https://auth.emergentagent.com/?redirect=${redirectUrl}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-300">
      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1704409479477-09e5770e03a9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHx3aW50ZXIlMjB2aWxsYWdlfGVufDB8fHxibHVlfDE3NTI1OTc4MjR8MA&ixlib=rb-4.1.0&q=85)'
          }}
        />
        
        <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
          <h1 className="text-6xl font-bold text-blue-900 mb-6">
            ❄️ SnowFriends: Batalha de Neve
          </h1>
          <p className="text-xl text-blue-700 mb-8 max-w-2xl mx-auto">
            Divirta-se com seus amigos em batalhas de neve épicas! Jogue em time, 
            congele adversários e desongele aliados neste mundo de inverno mágico.
          </p>
          
          <div className="flex gap-4 justify-center">
            {user ? (
              <button
                onClick={() => navigate('/lobby')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-xl font-semibold transition-colors"
              >
                Entrar no Jogo
              </button>
            ) : (
              <button
                onClick={handleLogin}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-xl font-semibold transition-colors"
              >
                Fazer Login / Cadastrar
              </button>
            )}
          </div>
          
          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6">
              <div className="text-4xl mb-4">🎮</div>
              <h3 className="text-xl font-semibold text-blue-900 mb-2">Multiplayer</h3>
              <p className="text-blue-700">Até 16 jogadores em batalhas épicas de neve</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6">
              <div className="text-4xl mb-4">❄️</div>
              <h3 className="text-xl font-semibold text-blue-900 mb-2">Sem Violência</h3>
              <p className="text-blue-700">Congele temporariamente, desongele aliados</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6">
              <div className="text-4xl mb-4">🎨</div>
              <h3 className="text-xl font-semibold text-blue-900 mb-2">Personalização</h3>
              <p className="text-blue-700">Personalize seu avatar e desbloqueie itens</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Profile Page (handles auth redirect)
const Profile = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('session_id=')) {
      const sessionId = hash.split('session_id=')[1];
      login(sessionId).then(success => {
        if (success) {
          navigate('/lobby');
        } else {
          navigate('/');
        }
      });
    } else {
      navigate('/');
    }
  }, [login, navigate]);

  return (
    <div className="min-h-screen bg-blue-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-blue-700 text-xl">Fazendo login...</p>
      </div>
    </div>
  );
};

// Lobby Page
const Lobby = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await axios.get(`${API}/rooms`);
      setRooms(response.data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    try {
      const response = await axios.post(`${API}/rooms`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` }
      });
      navigate(`/game/${response.data.room_id}`);
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const joinRoom = (roomId) => {
    navigate(`/game/${roomId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-blue-900">SnowFriends</h1>
            <span className="text-blue-600">Lobby</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <img 
                src={user?.picture || 'https://via.placeholder.com/40'} 
                alt={user?.name}
                className="w-10 h-10 rounded-full"
              />
              <span className="text-blue-900">{user?.name}</span>
            </div>
            <button
              onClick={logout}
              className="text-blue-600 hover:text-blue-800"
            >
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Create Room */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-4">Criar Nova Sala</h2>
              <button
                onClick={createRoom}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🎮 Criar Sala
              </button>
            </div>

            {/* Available Rooms */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-4">Salas Disponíveis</h2>
              {rooms.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Nenhuma sala disponível. Crie uma nova sala para começar!
                </p>
              ) : (
                <div className="space-y-3">
                  {rooms.map(room => (
                    <div key={room.id} className="border rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-blue-900">{room.name}</h3>
                        <p className="text-sm text-gray-600">
                          {room.players}/{room.max_players} jogadores • {room.map} • {room.game_state}
                        </p>
                      </div>
                      <button
                        onClick={() => joinRoom(room.id)}
                        disabled={room.players >= room.max_players}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                      >
                        Entrar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Player Stats */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-4">Estatísticas</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Nível:</span>
                  <span className="font-semibold text-blue-900">{user?.level || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Vitórias:</span>
                  <span className="font-semibold text-green-600">{user?.wins || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Derrotas:</span>
                  <span className="font-semibold text-red-600">{user?.losses || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Moedas:</span>
                  <span className="font-semibold text-yellow-600">{user?.coins || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-4">Classes</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏃</span>
                  <span className="text-blue-900">Corredor - Velocidade</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🛡️</span>
                  <span className="text-blue-900">Tanque - Resistência</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔨</span>
                  <span className="text-blue-900">Construtor - Barreiras</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👁️</span>
                  <span className="text-blue-900">Scout - Visão</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Game Component
const Game = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const [gameState, setGameState] = useState('loading');
  const [players, setPlayers] = useState({});
  const [myPosition, setMyPosition] = useState({ x: 400, y: 300 });
  const [ready, setReady] = useState(false);
  const [roomId, setRoomId] = useState(null);

  useEffect(() => {
    const path = window.location.pathname;
    const id = path.split('/').pop();
    setRoomId(id);
    
    if (id) {
      connectWebSocket(id);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = (roomId) => {
    const wsUrl = `${BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/api/ws/${roomId}`;
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('Connected to WebSocket');
      setGameState('lobby');
    };

    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket connection closed');
      setGameState('disconnected');
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setGameState('error');
    };
  };

  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'player_joined':
        setPlayers(message.room_state.players || {});
        break;
      case 'player_left':
        setPlayers(message.room_state.players || {});
        break;
      case 'player_update':
        setPlayers(prev => ({
          ...prev,
          [message.user_id]: {
            ...prev[message.user_id],
            position: message.position
          }
        }));
        break;
      case 'player_ready':
        setPlayers(prev => ({
          ...prev,
          [message.user_id]: {
            ...prev[message.user_id],
            ready: message.ready
          }
        }));
        break;
      case 'game_start':
        setGameState('playing');
        break;
      case 'snowball_throw':
        // Handle snowball animation
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  useEffect(() => {
    if (gameState === 'playing') {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      const gameLoop = () => {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid pattern
        ctx.strokeStyle = '#b3e5fc';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 50) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 50) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
        
        // Draw players
        Object.entries(players).forEach(([playerId, player]) => {
          const pos = player.position;
          if (pos) {
            // Draw player circle
            ctx.fillStyle = player.frozen ? '#a5b4fc' : '#3b82f6';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw player name
            ctx.fillStyle = '#1e40af';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(playerId.substr(0, 8), pos.x, pos.y - 20);
          }
        });
        
        requestAnimationFrame(gameLoop);
      };
      
      gameLoop();
    }
  }, [gameState, players]);

  const handleCanvasClick = (event) => {
    if (gameState !== 'playing') return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Update position
    setMyPosition({ x, y });
    
    // Send position update
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'player_update',
        position: { x, y }
      }));
    }
  };

  const handleThrowSnowball = (event) => {
    if (gameState !== 'playing') return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'snowball_throw',
        position: myPosition,
        target: { x, y }
      }));
    }
  };

  const toggleReady = () => {
    const newReady = !ready;
    setReady(newReady);
    
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'player_ready',
        ready: newReady
      }));
    }
  };

  if (gameState === 'loading') {
    return (
      <div className="min-h-screen bg-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-700 text-xl">Conectando ao jogo...</p>
        </div>
      </div>
    );
  }

  if (gameState === 'error' || gameState === 'disconnected') {
    return (
      <div className="min-h-screen bg-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-blue-700 text-xl mb-4">Erro de conexão</p>
          <button
            onClick={() => navigate('/lobby')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Voltar ao Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-100">
      {/* Game Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/lobby')}
              className="text-blue-600 hover:text-blue-800"
            >
              ← Voltar
            </button>
            <h1 className="text-2xl font-bold text-blue-900">SnowFriends</h1>
            <span className="text-blue-600">Sala: {roomId?.substr(0, 8)}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-blue-900">Jogadores: {Object.keys(players).length}</span>
            {gameState === 'lobby' && (
              <button
                onClick={toggleReady}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  ready
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                }`}
              >
                {ready ? 'Pronto!' : 'Não Pronto'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 p-4">
        {gameState === 'lobby' ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-4">Lobby da Sala</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {Object.entries(players).map(([playerId, player]) => (
                  <div key={playerId} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      {playerId.substr(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-blue-900">{playerId.substr(0, 8)}</div>
                      <div className="text-sm text-gray-600">{player.character_class}</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm ${
                      player.ready ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {player.ready ? 'Pronto' : 'Aguardando'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="mb-4 text-center">
                <p className="text-blue-700">Clique para mover • Clique direito para atirar bola de neve</p>
              </div>
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                onClick={handleCanvasClick}
                onContextMenu={handleThrowSnowball}
                className="border border-blue-200 rounded-lg mx-auto block cursor-crosshair"
                style={{ backgroundColor: '#f0f9ff' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-blue-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/" replace />;
};

// Main App Component
function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/lobby" element={
              <ProtectedRoute>
                <Lobby />
              </ProtectedRoute>
            } />
            <Route path="/game/:roomId" element={
              <ProtectedRoute>
                <Game />
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;