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

  const updateUser = (newUserData) => {
    setUser(newUserData);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser }}>
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

// Shop Component
const Shop = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShopItems();
  }, []);

  const fetchShopItems = async () => {
    try {
      const response = await axios.get(`${API}/shop`);
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching shop items:', error);
    } finally {
      setLoading(false);
    }
  };

  const purchaseItem = async (itemId) => {
    try {
      await axios.post(`${API}/shop/purchase`, { item_id: itemId }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` }
      });
      
      // Refresh user profile
      const profileResponse = await axios.get(`${API}/profile`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` }
      });
      updateUser(profileResponse.data);
      
      alert('Item comprado com sucesso!');
    } catch (error) {
      console.error('Error purchasing item:', error);
      alert('Erro ao comprar item: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const getItemTypeIcon = (type) => {
    switch (type) {
      case 'hat': return '🧢';
      case 'coat': return '🧥';
      case 'backpack': return '🎒';
      default: return '📦';
    }
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
            <button
              onClick={() => navigate('/lobby')}
              className="text-blue-600 hover:text-blue-800"
            >
              ← Voltar
            </button>
            <h1 className="text-2xl font-bold text-blue-900">Loja</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🪙</span>
              <span className="text-blue-900 font-semibold">{user?.coins || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Shop Items */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-center">
                <div className="text-6xl mb-4">{getItemTypeIcon(item.type)}</div>
                <h3 className="text-xl font-semibold text-blue-900 mb-2">{item.name}</h3>
                <p className="text-gray-600 mb-4">{item.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-blue-600">{item.price} 🪙</span>
                  <button
                    onClick={() => purchaseItem(item.id)}
                    disabled={user?.coins < item.price}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    Comprar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Leaderboard Component
const Leaderboard = () => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get(`${API}/leaderboard`);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
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
            <button
              onClick={() => navigate('/lobby')}
              className="text-blue-600 hover:text-blue-800"
            >
              ← Voltar
            </button>
            <h1 className="text-2xl font-bold text-blue-900">Ranking</h1>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-6">🏆 Top 10 Jogadores</h2>
          <div className="space-y-4">
            {leaderboard.map((player, index) => (
              <div key={player.id} className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">#{index + 1}</div>
                <img 
                  src={player.picture || 'https://via.placeholder.com/50'} 
                  alt={player.name}
                  className="w-12 h-12 rounded-full"
                />
                <div className="flex-1">
                  <div className="font-semibold text-blue-900">{player.name}</div>
                  <div className="text-sm text-gray-600">Nível {player.level}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">{player.wins} vitórias</div>
                  <div className="text-sm text-gray-600">{player.matches_played} partidas</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Lobby Page
const Lobby = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [maps, setMaps] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRooms();
    fetchMaps();
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

  const fetchMaps = async () => {
    try {
      const response = await axios.get(`${API}/maps`);
      setMaps(response.data);
    } catch (error) {
      console.error('Error fetching maps:', error);
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
            <button
              onClick={() => navigate('/shop')}
              className="text-blue-600 hover:text-blue-800"
            >
              🛒 Loja
            </button>
            <button
              onClick={() => navigate('/leaderboard')}
              className="text-blue-600 hover:text-blue-800"
            >
              🏆 Ranking
            </button>
            <div className="flex items-center gap-2">
              <img 
                src={user?.picture || 'https://via.placeholder.com/40'} 
                alt={user?.name}
                className="w-10 h-10 rounded-full"
              />
              <div>
                <div className="text-blue-900 font-semibold">{user?.name}</div>
                <div className="text-sm text-gray-600">{user?.coins || 0} 🪙</div>
              </div>
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
          {/* Game Section */}
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
                          {room.players}/{room.max_players} jogadores • {room.map_name} • {room.game_state}
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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Player Stats */}
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
                  <span className="text-gray-600">Rank:</span>
                  <span className="font-semibold text-purple-600">{user?.rank || 'Novato'}</span>
                </div>
              </div>
            </div>

            {/* Character Classes */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-4">Classes</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏃</span>
                  <div>
                    <div className="text-blue-900 font-semibold">Corredor</div>
                    <div className="text-sm text-gray-600">Velocidade +50%</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🛡️</span>
                  <div>
                    <div className="text-blue-900 font-semibold">Tanque</div>
                    <div className="text-sm text-gray-600">Resistência +100%</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔨</span>
                  <div>
                    <div className="text-blue-900 font-semibold">Construtor</div>
                    <div className="text-sm text-gray-600">Pode criar barreiras</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👁️</span>
                  <div>
                    <div className="text-blue-900 font-semibold">Scout</div>
                    <div className="text-sm text-gray-600">Visão +75%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Maps */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-4">Mapas</h2>
              <div className="space-y-3">
                {Object.entries(maps).map(([key, map]) => (
                  <div key={key} className="border rounded-lg p-3">
                    <h3 className="font-semibold text-blue-900">{map.name}</h3>
                    <p className="text-sm text-gray-600">{map.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Game Component with HTTP Polling fallback
const Game = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const pollingRef = useRef(null);
  const [gameState, setGameState] = useState('loading');
  const [connectionMethod, setConnectionMethod] = useState('websocket');
  const [players, setPlayers] = useState({});
  const [currentMap, setCurrentMap] = useState('vila_congelada');
  const [myPosition, setMyPosition] = useState({ x: 400, y: 300 });
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [ready, setReady] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [snowballs, setSnowballs] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [selectedNpc, setSelectedNpc] = useState(null);
  const [npcDialogue, setNpcDialogue] = useState('');

  useEffect(() => {
    const path = window.location.pathname;
    const id = path.split('/').pop();
    setRoomId(id);
    
    if (id) {
      fetchNpcs();
      connectToGame(id);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const fetchNpcs = async () => {
    try {
      const response = await axios.get(`${API}/npcs`);
      setNpcs(Object.values(response.data));
    } catch (error) {
      console.error('Error fetching NPCs:', error);
    }
  };

  const connectToGame = (roomId) => {
    // Try WebSocket first
    connectWebSocket(roomId);
    
    // Fallback to HTTP polling after 3 seconds if WebSocket fails
    setTimeout(() => {
      if (gameState === 'loading') {
        console.log('WebSocket failed, falling back to HTTP polling');
        connectHttpPolling(roomId);
      }
    }, 3000);
  };

  const connectWebSocket = (roomId) => {
    const wsUrl = `${BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/api/ws/${roomId}`;
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('Connected to WebSocket');
      setGameState('lobby');
      setConnectionMethod('websocket');
    };

    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleGameMessage(message);
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket connection closed');
      if (gameState !== 'loading') {
        connectHttpPolling(roomId);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (gameState === 'loading') {
        connectHttpPolling(roomId);
      }
    };
  };

  const connectHttpPolling = async (roomId) => {
    try {
      // Join room via HTTP
      await axios.post(`${API}/rooms/${roomId}/join`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` }
      });
      
      setGameState('lobby');
      setConnectionMethod('http');
      
      // Start polling for room state
      pollingRef.current = setInterval(async () => {
        try {
          const response = await axios.get(`${API}/rooms/${roomId}/state`);
          const roomState = response.data;
          setPlayers(roomState.players || {});
          setCurrentMap(roomState.map || 'vila_congelada');
          
          if (roomState.game_state === 'playing' && gameState !== 'playing') {
            setGameState('playing');
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 1000);
      
    } catch (error) {
      console.error('HTTP connection error:', error);
      setGameState('error');
    }
  };

  const handleGameMessage = (message) => {
    switch (message.type) {
      case 'player_joined':
        setPlayers(message.room_state.players || {});
        setMyPlayerId(message.user_id);
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
        setPlayers(message.room_state.players || {});
        break;
      case 'snowball_throw':
        handleSnowballThrow(message);
        break;
      case 'player_hit':
        setPlayers(prev => ({
          ...prev,
          [message.target_id]: {
            ...prev[message.target_id],
            health: message.target_health,
            frozen: message.frozen
          }
        }));
        break;
      case 'player_unfrozen':
        setPlayers(prev => ({
          ...prev,
          [message.target_id]: {
            ...prev[message.target_id],
            frozen: false,
            health: 100
          }
        }));
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const handleSnowballThrow = (message) => {
    const newSnowball = {
      id: Date.now(),
      startPos: message.position,
      endPos: message.target,
      progress: 0
    };
    
    setSnowballs(prev => [...prev, newSnowball]);
    
    // Remove snowball after animation
    setTimeout(() => {
      setSnowballs(prev => prev.filter(sb => sb.id !== newSnowball.id));
    }, 1000);
  };

  const sendMessage = (message) => {
    if (connectionMethod === 'websocket' && wsRef.current) {
      wsRef.current.send(JSON.stringify(message));
    } else if (connectionMethod === 'http') {
      // Handle HTTP updates
      if (message.type === 'player_update') {
        axios.post(`${API}/rooms/${roomId}/update`, {
          position: message.position
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` }
        });
      }
    }
  };

  const talkToNpc = async (npcId) => {
    try {
      const response = await axios.post(`${API}/npc/talk/${npcId}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` }
      });
      
      setSelectedNpc(response.data.npc_name);
      setNpcDialogue(response.data.dialogue);
      
      // Clear dialogue after 5 seconds
      setTimeout(() => {
        setSelectedNpc(null);
        setNpcDialogue('');
      }, 5000);
    } catch (error) {
      console.error('Error talking to NPC:', error);
    }
  };

  // Game rendering
  useEffect(() => {
    if (gameState === 'playing') {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      const gameLoop = () => {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw winter background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#e0f2fe');
        gradient.addColorStop(1, '#bae6fd');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw snowflakes
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 20; i++) {
          const x = (Date.now() * 0.1 + i * 123) % canvas.width;
          const y = (Date.now() * 0.05 + i * 456) % canvas.height;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        
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
        
        // Draw NPCs
        npcs.forEach(npc => {
          ctx.fillStyle = '#8b5cf6';
          ctx.beginPath();
          ctx.arc(npc.position.x, npc.position.y, 20, 0, Math.PI * 2);
          ctx.fill();
          
          // NPC name
          ctx.fillStyle = '#1e40af';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(npc.name, npc.position.x, npc.position.y - 30);
        });
        
        // Draw players
        Object.entries(players).forEach(([playerId, player]) => {
          const pos = player.position;
          if (pos) {
            // Player circle
            ctx.fillStyle = player.frozen ? '#a5b4fc' : 
                           player.team === 'blue' ? '#3b82f6' : '#ef4444';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
            ctx.fill();
            
            // Player name
            ctx.fillStyle = '#1e40af';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(player.name || playerId.substr(0, 8), pos.x, pos.y - 20);
            
            // Health bar
            if (player.health < 100) {
              ctx.fillStyle = '#ef4444';
              ctx.fillRect(pos.x - 15, pos.y + 20, 30, 5);
              ctx.fillStyle = '#22c55e';
              ctx.fillRect(pos.x - 15, pos.y + 20, (player.health / 100) * 30, 5);
            }
          }
        });
        
        // Draw snowballs
        snowballs.forEach(snowball => {
          const progress = Math.min(snowball.progress + 0.05, 1);
          snowball.progress = progress;
          
          const x = snowball.startPos.x + (snowball.endPos.x - snowball.startPos.x) * progress;
          const y = snowball.startPos.y + (snowball.endPos.y - snowball.startPos.y) * progress;
          
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
        
        requestAnimationFrame(gameLoop);
      };
      
      gameLoop();
    }
  }, [gameState, players, snowballs, npcs]);

  const handleCanvasClick = (event) => {
    if (gameState !== 'playing') return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if clicking on NPC
    const clickedNpc = npcs.find(npc => {
      const distance = Math.sqrt(
        Math.pow(x - npc.position.x, 2) + Math.pow(y - npc.position.y, 2)
      );
      return distance < 25;
    });
    
    if (clickedNpc) {
      talkToNpc(clickedNpc.name.toLowerCase().replace(/\s+/g, '_'));
      return;
    }
    
    // Update position
    setMyPosition({ x, y });
    
    // Send position update
    sendMessage({
      type: 'player_update',
      position: { x, y }
    });
  };

  const handleThrowSnowball = (event) => {
    if (gameState !== 'playing') return;
    
    event.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    sendMessage({
      type: 'snowball_throw',
      position: myPosition,
      target: { x, y }
    });
  };

  const toggleReady = () => {
    const newReady = !ready;
    setReady(newReady);
    
    sendMessage({
      type: 'player_ready',
      ready: newReady
    });
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

  if (gameState === 'error') {
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
            <span className="text-sm text-gray-500">({connectionMethod})</span>
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
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      player.team === 'blue' ? 'bg-blue-600' : 'bg-red-600'
                    }`}>
                      {player.name?.charAt(0) || playerId.substr(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-blue-900">{player.name || playerId.substr(0, 8)}</div>
                      <div className="text-sm text-gray-600">{player.character_class} • {player.team}</div>
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
            <div className="bg-white rounded-lg shadow-sm p-4 relative">
              <div className="mb-4 text-center">
                <p className="text-blue-700">Clique para mover • Clique direito para atirar bola de neve • Clique nos NPCs para conversar</p>
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
              
              {/* NPC Dialogue */}
              {selectedNpc && npcDialogue && (
                <div className="absolute top-16 left-4 right-4 bg-white border-2 border-blue-200 rounded-lg p-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">💬</span>
                    <span className="font-semibold text-blue-900">{selectedNpc}</span>
                  </div>
                  <p className="text-gray-700">{npcDialogue}</p>
                </div>
              )}
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
            <Route path="/shop" element={
              <ProtectedRoute>
                <Shop />
              </ProtectedRoute>
            } />
            <Route path="/leaderboard" element={
              <ProtectedRoute>
                <Leaderboard />
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