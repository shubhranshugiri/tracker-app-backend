import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import os from 'os';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

import { connectDB, isDbConnected } from './db/connect.js';
import { Vehicle } from './models/Vehicle.js';
import { User } from './models/User.js';
import { Alert } from './models/Alert.js';
import { TollPlaza } from './models/TollPlaza.js';
import { SupplyHub } from './models/SupplyHub.js';
import authRouter from './routes/auth.js';

const app = express();
const PORT = process.env.PORT || 5001;
const OWNTRACHS_AUTH_TOKEN = process.env.OWNTRACHS_AUTH_TOKEN || '';

// Connect to MongoDB Atlas (auto-seeds default Admin and collections if empty)
connectDB();

// Dynamic CORS for local & Netlify deployments
const allowedOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes('*')) return callback(null, true);
    const isAllowed = allowedOrigins.some(o => {
      if (o.includes('*')) {
        const regex = new RegExp('^' + o.replace(/\*/g, '.*') + '$');
        return regex.test(origin);
      }
      return o === origin;
    });
    if (isAllowed || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('netlify.app')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount Authentication & Authorization API Router
app.use('/api/auth', authRouter);

// Root & Healthcheck endpoints for Cloud Deployment (Vercel, Netlify, Render)
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'FleetPro Live GPS Tracker Backend API',
    version: '4.0.0',
    dbConnected: isDbConnected,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.round(process.uptime()),
    dbConnected: isDbConnected,
    timestamp: new Date().toISOString()
  });
});

// Server & WebSocket Setup (Safe initialization for serverless & dedicated servers)
const server = http.createServer(app);
let wss = null;

if (!process.env.VERCEL && !process.env.NETLIFY) {
  try {
    wss = new WebSocketServer({ server });
  } catch (err) {
    console.warn('[WebSocket Init Warning]:', err.message);
  }
}

// Helper to broadcast to all connected WebSocket clients
function broadcast(message) {
  if (!wss || !wss.clients) return;
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Get local IPv4 addresses for mobile app configuration
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ interface: name, address: net.address });
      }
    }
  }
  return addresses;
}

// Toll Plazas Database for Supply Routes
export const TOLL_PLAZAS = [
  {
    id: 'toll-khalapur',
    name: 'Khalapur Toll Plaza',
    highway: 'Mumbai - Pune Expressway',
    lat: 18.8475,
    lon: 73.2842,
    rates: { car: 320, lcv: 495, truck: 680, multiAxle: 1070 },
    fastagActive: true,
    avgWaitTimeMin: 2,
  },
  {
    id: 'toll-talegaon',
    name: 'Talegaon Toll Plaza',
    highway: 'Mumbai - Pune Expressway (Pune End)',
    lat: 18.7314,
    lon: 73.6872,
    rates: { car: 215, lcv: 340, truck: 460, multiAxle: 710 },
    fastagActive: true,
    avgWaitTimeMin: 1.5,
  },
  {
    id: 'toll-vashi',
    name: 'Vashi Creek Toll Plaza',
    highway: 'Sion - Panvel Expressway',
    lat: 19.0628,
    lon: 72.9845,
    rates: { car: 45, lcv: 70, truck: 105, multiAxle: 160 },
    fastagActive: true,
    avgWaitTimeMin: 3,
  },
  {
    id: 'toll-padgha',
    name: 'Padgha Toll Plaza',
    highway: 'NH-160 (Mumbai - Nashik Corridor)',
    lat: 19.3496,
    lon: 73.1895,
    rates: { car: 110, lcv: 175, truck: 245, multiAxle: 390 },
    fastagActive: true,
    avgWaitTimeMin: 2,
  },
  {
    id: 'toll-charoti',
    name: 'Charoti Toll Plaza',
    highway: 'NH-48 (Mumbai - Ahmedabad Corridor)',
    lat: 19.9142,
    lon: 72.8841,
    rates: { car: 125, lcv: 190, truck: 285, multiAxle: 440 },
    fastagActive: true,
    avgWaitTimeMin: 2.5,
  },
  {
    id: 'toll-khed-shivapur',
    name: 'Khed Shivapur Toll Plaza',
    highway: 'NH-48 (Pune - Bangalore Corridor)',
    lat: 18.3582,
    lon: 73.8471,
    rates: { car: 105, lcv: 165, truck: 230, multiAxle: 360 },
    fastagActive: true,
    avgWaitTimeMin: 3.5,
  }
];

// Key Supply Hubs / Geofences
export const SUPPLY_HUBS = [
  {
    id: 'hub-jnpt',
    name: 'JNPT Port Container Terminal',
    type: 'port',
    city: 'Navi Mumbai',
    lat: 18.9498,
    lon: 72.9510,
    radiusMeters: 2500,
    capacity: '20,000 TEU',
    dockCount: 32,
  },
  {
    id: 'hub-bhiwandi',
    name: 'Bhiwandi Mega Logistics Park',
    type: 'central_warehouse',
    city: 'Thane / Bhiwandi',
    lat: 19.2967,
    lon: 73.0631,
    radiusMeters: 3000,
    capacity: '1,500,000 Sq.Ft',
    dockCount: 84,
  },
  {
    id: 'hub-chakan',
    name: 'Chakan MIDC Auto Supply Hub',
    type: 'industrial_plant',
    city: 'Pune',
    lat: 18.7612,
    lon: 73.8344,
    radiusMeters: 2800,
    capacity: 'Manufacturing & Heavy Assembly',
    dockCount: 45,
  },
  {
    id: 'hub-vapi',
    name: 'Vapi Industrial Chemical Hub',
    type: 'chemical_logistics',
    city: 'Gujarat Border',
    lat: 20.3713,
    lon: 72.9106,
    radiusMeters: 2000,
    capacity: 'Bulk Liquid & Hazardous Cargo',
    dockCount: 20,
  }
];

// Fleet Vehicles Store - User's Real Phone (L1) is the primary tracked unit
let vehicles = {
  'L1': {
    id: 'L1',
    trackerId: 'L1',
    name: '📱 My Live Phone (L1 - Realme)',
    plateNumber: 'LIVE-GPS-RMX2001',
    type: 'Real Handset GPS (OwnTracks)',
    driver: 'Sonu (Realme Mobile)',
    driverPhone: 'Primary Handset',
    cargo: 'Real-Time Location Tracking',
    consignmentId: 'LIVE-USER-PHONE',
    status: 'stopped',
    lat: 21.805935,
    lon: 87.241813,
    altitude: -28,
    heading: 130,
    speed: 0,
    battery: 97,
    batteryStatus: 'unplugged',
    accuracy: 3,
    lastUpdated: Date.now(),
    source: 'owntracks_mobile',
    isRealDevice: true,
    destination: 'Live Handset Tracking',
    history: [
      { lat: 21.805935, lon: 87.241813, speed: 0, timestamp: Date.now(), battery: 97 }
    ]
  }
};

// Template for mock vehicles if user explicitly toggles demo mode
export const MOCK_VEHICLES = {
  'T1': {
    id: 'T1',
    trackerId: 'T1',
    name: 'Truck-01 (JNPT Express)',
    plateNumber: 'MH-04-TR-8821',
    type: 'Heavy Multi-Axle (16-Wheeler)',
    driver: 'Rajesh Yadav',
    driverPhone: '+91 98201 44512',
    cargo: 'Consumer Electronics & Telecom Gear',
    consignmentId: 'CN-894102',
    status: 'moving',
    lat: 18.9125,
    lon: 73.1840,
    altitude: 142,
    heading: 112,
    speed: 64,
    battery: 89,
    batteryStatus: 'charging',
    accuracy: 8,
    lastUpdated: Date.now(),
    source: 'mock_demo',
    isRealDevice: false,
    destination: 'Chakan MIDC Auto Supply Hub, Pune',
    history: []
  }
};

// Generate realistic route breadcrumbs for initial history
function seedHistoricalBreadcrumbs() {
  if (!vehicles['T1']) return;
  // Mumbai to Pune path for T1
  const m2pPoints = [
    { lat: 18.9498, lon: 72.9510, speed: 20, t: 120, name: 'Departed JNPT Port Terminal' },
    { lat: 18.9800, lon: 73.0300, speed: 55, t: 100, name: 'Panvel Highway Bypass' },
    { lat: 19.0100, lon: 73.1100, speed: 65, t: 80, name: 'Expressway Entry Point' },
    { lat: 18.8475, lon: 73.2842, speed: 12, t: 60, name: 'Khalapur Toll Plaza (FASTag Cleared - ₹680)' },
    { lat: 18.7700, lon: 73.4000, speed: 45, t: 40, name: 'Khandala Ghat Incline' },
    { lat: 18.7500, lon: 73.5500, speed: 72, t: 25, name: 'Lonavala Super Expressway Stretch' },
    { lat: 18.7314, lon: 73.6872, speed: 18, t: 15, name: 'Talegaon Toll Plaza (FASTag Cleared - ₹460)' },
    { lat: 18.9125, lon: 73.1840, speed: 64, t: 0, name: 'Live On Expressway' }
  ];

  const now = Date.now();
  vehicles['T1'].history = m2pPoints.map((pt) => ({
    lat: pt.lat,
    lon: pt.lon,
    speed: pt.speed,
    altitude: 120 + Math.random() * 50,
    heading: 115,
    timestamp: now - pt.t * 60 * 1000,
    battery: Math.round(98 - (pt.t / 120) * 9),
    annotation: pt.name
  }));

  // Bhiwandi delivery route for T2
  const t2Points = [
    { lat: 19.0800, lon: 72.8800, speed: 30, t: 90, name: 'Kurla Logistics Depot Departure' },
    { lat: 19.1600, lon: 72.9500, speed: 48, t: 60, name: 'Eastern Express Highway' },
    { lat: 19.2200, lon: 73.0200, speed: 52, t: 35, name: 'Thane Majiwada Flyover' },
    { lat: 19.2450, lon: 73.1200, speed: 52, t: 0, name: 'Approaching Bhiwandi Hub Gate 4' }
  ];
  vehicles['T2'].history = t2Points.map((pt) => ({
    lat: pt.lat,
    lon: pt.lon,
    speed: pt.speed,
    altitude: 25,
    heading: 50,
    timestamp: now - pt.t * 60 * 1000,
    battery: Math.round(92 - (pt.t / 90) * 14),
    annotation: pt.name
  }));
}
seedHistoricalBreadcrumbs();

// Activity & Security Alerts Log
let alertsLog = [
  {
    id: 'alt-1',
    vehicleId: 'T1',
    vehicleName: 'Truck-01',
    type: 'toll_cleared',
    severity: 'info',
    message: 'FASTag Auto-Debit: ₹680 at Khalapur Toll Plaza',
    time: Date.now() - 3600000,
  },
  {
    id: 'alt-2',
    vehicleId: 'T1',
    vehicleName: 'Truck-01',
    type: 'speed_alert',
    severity: 'warning',
    message: 'Speed Warning: 82 km/h on Expressway (Speed Limit: 80 km/h)',
    time: Date.now() - 2100000,
  },
  {
    id: 'alt-3',
    vehicleId: 'T2',
    vehicleName: 'Truck-02',
    type: 'geofence_entry',
    severity: 'success',
    message: 'Entered Geofence: Bhiwandi Mega Logistics Park Perimeter',
    time: Date.now() - 900000,
  },
  {
    id: 'alt-4',
    vehicleId: 'T3',
    vehicleName: 'Van-03',
    type: 'battery_low',
    severity: 'warning',
    message: 'Phone Battery Below 50% (45%) on Driver handset',
    time: Date.now() - 300000,
  }
];

// Live Raw OwnTracks Packets Log (for UI Inspector)
let rawOwnTracksLogs = [];

// ==========================================
// 1. OwnTracks HTTP Ingestion Webhook
// ==========================================
/**
 * OwnTracks standard HTTP protocol:
 * Accepts POST /api/owntracks or /pub
 * Body payload contains _type, lat, lon, tst, tid, vel, cog, batt, etc.
 */
app.post(['/api/owntracks', '/pub'], (req, res) => {
  const payload = req.body;
  const timestamp = Date.now();

  // Log raw packet for visual inspector in the dashboard
  rawOwnTracksLogs.unshift({
    receivedAt: timestamp,
    data: payload,
    ip: req.ip || req.socket.remoteAddress
  });
  if (rawOwnTracksLogs.length > 50) rawOwnTracksLogs.pop();

  // Validate OwnTracks message
  if (payload && payload._type === 'location') {
    const tid = (payload.tid || (payload.topic ? payload.topic.split('/').pop() : 'OT')).toUpperCase();
    const lat = parseFloat(payload.lat);
    const lon = parseFloat(payload.lon);
    const speed = payload.vel ? Math.round(parseFloat(payload.vel)) : 0;
    const heading = payload.cog ? Math.round(parseFloat(payload.cog)) : 0;
    const battery = payload.batt !== undefined ? Math.round(parseFloat(payload.batt)) : 100;
    const battStatus = payload.bs === 2 ? 'charging' : payload.bs === 3 ? 'full' : 'unplugged';
    const accuracy = payload.acc ? Math.round(parseFloat(payload.acc)) : 10;
    const altitude = payload.alt ? Math.round(parseFloat(payload.alt)) : 0;

    // Check status
    let status = 'stopped';
    if (speed > 5) status = 'moving';
    else if (speed > 0) status = 'idling';

    // Detect phone model or device name from topic or SSID
    const deviceModel = payload.topic ? payload.topic.split('/').pop().toUpperCase() : tid;
    const wifiInfo = payload.SSID ? ` (${payload.SSID})` : '';

    // Update or create vehicle
    if (!vehicles[tid]) {
      vehicles[tid] = {
        id: tid,
        trackerId: tid,
        name: `📱 My Live Phone (${tid}${wifiInfo})`,
        plateNumber: `LIVE-GPS-${deviceModel}`,
        type: 'Real Handset GPS (OwnTracks)',
        driver: `Mobile User (${deviceModel})`,
        driverPhone: 'Primary Handset',
        cargo: 'Live Operational Asset',
        consignmentId: `OT-${Date.now().toString().slice(-6)}`,
        status,
        lat,
        lon,
        altitude,
        heading,
        speed,
        battery,
        batteryStatus: battStatus,
        accuracy,
        lastUpdated: timestamp,
        source: 'owntracks_mobile',
        isRealDevice: true,
        odometerKm: 0,
        tripDistanceKm: 0,
        destination: 'Live Location Tracking',
        eta: 'Real-time Feed',
        routeProgress: 100,
        fuelPct: 100,
        history: []
      };
    } else {
      vehicles[tid].name = vehicles[tid].isRealDevice ? vehicles[tid].name : `📱 My Live Phone (${tid}${wifiInfo})`;
      vehicles[tid].lat = lat;
      vehicles[tid].lon = lon;
      vehicles[tid].altitude = altitude;
      vehicles[tid].heading = heading;
      vehicles[tid].speed = speed;
      vehicles[tid].battery = battery;
      vehicles[tid].batteryStatus = battStatus;
      vehicles[tid].accuracy = accuracy;
      vehicles[tid].status = status;
      vehicles[tid].lastUpdated = timestamp;
      vehicles[tid].source = 'owntracks_mobile';
      vehicles[tid].isRealDevice = true;
    }

    // Append to breadcrumb history
    vehicles[tid].history.push({
      lat,
      lon,
      speed,
      altitude,
      heading,
      timestamp,
      battery
    });
    if (vehicles[tid].history.length > 500) {
      vehicles[tid].history.shift();
    }

    // Geofence & Alert checks
    checkTollAndGeofences(vehicles[tid]);

    // Broadcast update immediately to frontend
    broadcast({
      type: 'OWNTRACKS_PING',
      vehicle: vehicles[tid],
      rawPayload: payload,
      receivedAt: timestamp
    });

    console.log(`[OwnTracks Webhook] Updated vehicle ${tid} -> Lat: ${lat}, Lon: ${lon}, Speed: ${speed} km/h`);
  }

  // OwnTracks protocol requires HTTP 200 response with [] or empty array/json
  return res.status(200).json([]);
});

// Toll and Geofence Proximity Checker
function checkTollAndGeofences(vehicle) {
  // Check Toll Plazas
  for (const toll of TOLL_PLAZAS) {
    const distKm = getDistanceFromLatLonInKm(vehicle.lat, vehicle.lon, toll.lat, toll.lon);
    if (distKm < 0.8) {
      const alreadyAlerted = alertsLog.some(
        a => a.vehicleId === vehicle.id && a.type === 'toll_cleared' && (Date.now() - a.time < 300000)
      );
      if (!alreadyAlerted) {
        const rate = toll.rates.truck || 400;
        const newAlert = {
          id: 'alt-' + Date.now(),
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          type: 'toll_cleared',
          severity: 'info',
          message: `FASTag Plaza Crossed: ${toll.name} (Estimated Auto-Toll: ₹${rate})`,
          time: Date.now()
        };
        alertsLog.unshift(newAlert);
        broadcast({ type: 'NEW_ALERT', alert: newAlert });
      }
    }
  }

  // Speeding Alert (> 80 km/h)
  if (vehicle.speed > 80) {
    const recentSpeedAlert = alertsLog.some(
      a => a.vehicleId === vehicle.id && a.type === 'speed_alert' && (Date.now() - a.time < 120000)
    );
    if (!recentSpeedAlert) {
      const alert = {
        id: 'alt-' + Date.now(),
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        type: 'speed_alert',
        severity: 'danger',
        message: `High Speed Violation: ${vehicle.speed} km/h detected (Threshold: 80 km/h)`,
        time: Date.now()
      };
      alertsLog.unshift(alert);
      broadcast({ type: 'NEW_ALERT', alert });
    }
  }
}

// Distance utility (Haversine formula)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// ==========================================
// 2. REST API Endpoints
// ==========================================

// Get all fleet vehicles (synced from MongoDB)
app.get('/api/vehicles', async (req, res) => {
  if (isDbConnected) {
    try {
      const dbVehicles = await Vehicle.find();
      if (dbVehicles && dbVehicles.length > 0) {
        dbVehicles.forEach(dv => {
          if (!vehicles[dv.trackerId]) {
            vehicles[dv.trackerId] = {
              id: dv.trackerId,
              name: dv.name,
              plateNumber: dv.plateNumber,
              type: dv.type,
              status: dv.status,
              driver: dv.driver,
              battery: dv.battery,
              batteryStatus: dv.batteryStatus,
              speed: dv.speed,
              heading: dv.heading,
              lat: dv.lat,
              lon: dv.lon,
              cargo: dv.cargo,
              destination: dv.destination,
              isRealDevice: dv.isRealDevice,
              source: dv.source,
              lastUpdated: dv.lastUpdated || Date.now(),
              history: dv.history || []
            };
          }
        });
      }
    } catch (e) {
      console.warn('MongoDB vehicle sync fallback:', e.message);
    }
  }
  res.json(Object.values(vehicles));
});

// Clear mock/simulated vehicles so ONLY real OwnTracks phones are tracked
app.post('/api/vehicles/clear-mock', async (req, res) => {
  simulationActive = false;
  const realDevices = {};
  for (const [id, v] of Object.entries(vehicles)) {
    if (v.isRealDevice || v.source === 'owntracks_mobile') {
      realDevices[id] = v;
    }
  }
  vehicles = realDevices;

  if (isDbConnected) {
    try {
      await Vehicle.deleteMany({ isRealDevice: false });
    } catch (e) {}
  }

  broadcast({
    type: 'INIT_STATE',
    vehicles: Object.values(vehicles),
    simulationActive: false
  });
  console.log('[Fleet Server] Cleared mock fleet. Active real units:', Object.keys(vehicles));
  res.json({ success: true, count: Object.keys(vehicles).length });
});

// Get historical breadcrumbs for a vehicle
app.get('/api/history/:id', async (req, res) => {
  const vehicle = vehicles[req.params.id];
  let historyPoints = vehicle ? (vehicle.history || []) : [];

  if (isDbConnected && (!historyPoints || historyPoints.length === 0)) {
    try {
      const dbV = await Vehicle.findOne({ trackerId: req.params.id });
      if (dbV && dbV.history) {
        historyPoints = dbV.history;
      }
    } catch (e) {}
  }

  if (!vehicle && historyPoints.length === 0) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  res.json({
    vehicleId: req.params.id,
    name: vehicle?.name || `Vehicle ${req.params.id}`,
    plateNumber: vehicle?.plateNumber || req.params.id,
    history: historyPoints,
    stops: [
      { name: 'JNPT Port Loading Bay 3', lat: 18.9498, lon: 72.9510, durationMin: 45, type: 'dock' },
      { name: 'Khalapur Food Mall & Rest Stop', lat: 18.8475, lon: 73.2842, durationMin: 25, type: 'rest' }
    ]
  });
});

// Get tolls and hubs (synced from MongoDB)
app.get('/api/metadata', async (req, res) => {
  let tollsList = TOLL_PLAZAS;
  let hubsList = SUPPLY_HUBS;

  if (isDbConnected) {
    try {
      const dbTolls = await TollPlaza.find();
      if (dbTolls.length > 0) {
        tollsList = dbTolls.map(t => ({
          id: t.tollId,
          name: t.name,
          highway: t.highway,
          lat: t.lat,
          lon: t.lon,
          rates: t.rates,
          fastagActive: t.fastagActive,
          avgWaitTimeMin: t.avgWaitTimeMin
        }));
      }
      const dbHubs = await SupplyHub.find();
      if (dbHubs.length > 0) {
        hubsList = dbHubs.map(h => ({
          id: h.hubId,
          name: h.name,
          city: h.city,
          type: h.type,
          lat: h.lat,
          lon: h.lon,
          radiusMeters: h.radiusMeters,
          dockCount: h.dockCount,
          capacity: h.capacity
        }));
      }
    } catch (e) {
      console.warn('MongoDB metadata fetch fallback:', e.message);
    }
  }

  res.json({
    tolls: tollsList,
    hubs: hubsList,
    networkIps: getLocalIpAddresses(),
    port: PORT,
    databaseConnected: isDbConnected
  });
});

// Get recent alerts
app.get('/api/alerts', (req, res) => {
  res.json(alertsLog.slice(0, 30));
});

// Get raw OwnTracks packet inspection logs
app.get('/api/owntracks/raw-logs', (req, res) => {
  res.json(rawOwnTracksLogs);
});

// ==========================================
// 2.1 Google Maps Style Geo Intelligence APIs
// ==========================================
const geoSearchCache = new Map();
const geoReverseCache = new Map();

// Helper: Calculate distance between coordinates in km
function calcHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Location Search (Fleet + Hubs + Tolls + Global Nominatim Geocoding)
app.get('/api/geo/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) {
    return res.json({ results: [] });
  }

  const qLower = query.toLowerCase();
  const results = [];

  // 1. Search local Fleet Vehicles
  for (const v of Object.values(vehicles)) {
    if (
      v.id.toLowerCase().includes(qLower) ||
      (v.name && v.name.toLowerCase().includes(qLower)) ||
      (v.plateNumber && v.plateNumber.toLowerCase().includes(qLower)) ||
      (v.driver && v.driver.toLowerCase().includes(qLower)) ||
      (v.cargo && v.cargo.toLowerCase().includes(qLower))
    ) {
      results.push({
        id: `v-${v.id}`,
        name: `${v.name} (${v.plateNumber})`,
        description: `Vehicle • Driver: ${v.driver} • Speed: ${v.speed} km/h`,
        type: 'vehicle',
        vehicleId: v.id,
        lat: v.lat,
        lon: v.lon,
        status: v.status
      });
    }
  }

  // 2. Search local Supply Hubs
  for (const hub of SUPPLY_HUBS) {
    if (hub.name.toLowerCase().includes(qLower) || hub.city.toLowerCase().includes(qLower)) {
      results.push({
        id: `hub-${hub.id}`,
        name: hub.name,
        description: `Supply Hub • ${hub.city} • ${hub.type}`,
        type: 'hub',
        lat: hub.lat,
        lon: hub.lon
      });
    }
  }

  // 3. Search local Toll Plazas
  for (const toll of TOLL_PLAZAS) {
    if (toll.name.toLowerCase().includes(qLower) || toll.highway.toLowerCase().includes(qLower)) {
      results.push({
        id: `toll-${toll.id}`,
        name: toll.name,
        description: `Toll Plaza • ${toll.highway} • FASTag ₹${toll.rates.truck}`,
        type: 'toll',
        lat: toll.lat,
        lon: toll.lon
      });
    }
  }

  // 4. Query Nominatim for Global / India Places (with memory cache)
  const cacheKey = qLower;
  if (geoSearchCache.has(cacheKey)) {
    const cached = geoSearchCache.get(cacheKey);
    return res.json({ results: [...results, ...cached] });
  }

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=6`;
    const resp = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'FleetProGoogleMapsApp/1.0 (fleetpro@supplytracker.com)',
        'Accept-Language': 'en'
      }
    });

    if (resp.ok) {
      const data = await resp.json();
      const placeResults = (data || []).map((item, idx) => {
        const address = item.address || {};
        const title = item.name || address.city || address.town || address.village || address.suburb || item.display_name.split(',')[0];
        const secondary = item.display_name;

        return {
          id: `osm-${item.place_id || idx}`,
          name: title,
          description: secondary,
          type: item.type === 'city' || item.type === 'administrative' ? 'city' : 'place',
          category: item.category,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          bbox: item.boundingbox
        };
      });

      geoSearchCache.set(cacheKey, placeResults);
      // Auto evict cache after 15 minutes
      setTimeout(() => geoSearchCache.delete(cacheKey), 15 * 60 * 1000);

      return res.json({ results: [...results, ...placeResults] });
    }
  } catch (err) {
    console.warn('[Geo Search Error]', err.message);
  }

  return res.json({ results });
});

// Reverse Geocoding (Convert clicked Map Lat/Lon to Real Address Details)
app.get('/api/geo/reverse', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Valid lat and lon are required' });
  }

  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (geoReverseCache.has(cacheKey)) {
    return res.json(geoReverseCache.get(cacheKey));
  }

  // Check if near any vehicle or hub or toll
  let nearestEntity = null;
  for (const v of Object.values(vehicles)) {
    if (calcHaversineDistanceKm(lat, lon, v.lat, v.lon) < 0.2) {
      nearestEntity = { type: 'vehicle', item: v };
      break;
    }
  }
  if (!nearestEntity) {
    for (const h of SUPPLY_HUBS) {
      if (calcHaversineDistanceKm(lat, lon, h.lat, h.lon) < (h.radiusMeters / 1000)) {
        nearestEntity = { type: 'hub', item: h };
        break;
      }
    }
  }

  try {
    const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const resp = await fetch(reverseUrl, {
      headers: {
        'User-Agent': 'FleetProGoogleMapsApp/1.0 (fleetpro@supplytracker.com)',
        'Accept-Language': 'en'
      }
    });

    if (resp.ok) {
      const data = await resp.json();
      const addr = data.address || {};
      const title = data.name || addr.road || addr.suburb || addr.neighbourhood || addr.city || addr.town || 'Selected Map Location';

      const details = {
        name: title,
        displayName: data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
        lat,
        lon,
        road: addr.road || '',
        suburb: addr.suburb || addr.neighbourhood || '',
        city: addr.city || addr.town || addr.village || addr.county || '',
        state: addr.state || '',
        country: addr.country || '',
        postcode: addr.postcode || '',
        category: data.category || 'location',
        type: data.type || 'point',
        nearestEntity
      };

      geoReverseCache.set(cacheKey, details);
      setTimeout(() => geoReverseCache.delete(cacheKey), 30 * 60 * 1000);
      return res.json(details);
    }
  } catch (err) {
    console.warn('[Reverse Geocode Error]', err.message);
  }

  // Fallback if offline/network issue
  const fallback = {
    name: nearestEntity ? nearestEntity.item.name : `Coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
    displayName: `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`,
    lat,
    lon,
    city: 'Location',
    state: '',
    country: 'India',
    nearestEntity
  };
  res.json(fallback);
});

// Google Maps Style Directions API (OSRM Routing with Turn-by-Turn, Distance, Tolls)
app.post('/api/geo/directions', async (req, res) => {
  const { origin, destination, profile = 'driving' } = req.body;

  if (!origin || !destination || isNaN(origin.lat) || isNaN(origin.lon) || isNaN(destination.lat) || isNaN(destination.lon)) {
    return res.status(400).json({ error: 'Valid origin and destination coordinates are required' });
  }

  // Map user profile to OSRM mode: driving, bike, foot
  let osrmProfile = 'driving';
  if (profile === 'walking') osrmProfile = 'foot';
  else if (profile === 'bike') osrmProfile = 'bike';

  const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&steps=true&annotations=true`;

  try {
    const resp = await fetch(osrmUrl, {
      headers: { 'User-Agent': 'FleetProGoogleMapsApp/1.0' }
    });

    if (resp.ok) {
      const osrmData = await resp.json();
      if (osrmData.routes && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]); // [lat, lon]
        const distanceKm = +(route.distance / 1000).toFixed(2);
        const durationMin = Math.round(route.duration / 60);

        let durationHours = Math.floor(durationMin / 60);
        let durationMinsRem = durationMin % 60;
        let durationFormatted = durationHours > 0 ? `${durationHours} hr ${durationMinsRem} min` : `${durationMinsRem} min`;

        // Calculate toll intersections along this real route
        const tollsOnRoute = [];
        let totalTollCost = 0;
        const rateKey = profile === 'truck' ? 'truck' : 'car';

        for (const toll of TOLL_PLAZAS) {
          // Check if toll is close to any coordinate along the route (within 0.8 km)
          const isNear = coordinates.some(pt => calcHaversineDistanceKm(pt[0], pt[1], toll.lat, toll.lon) < 0.8);
          if (isNear) {
            const fee = toll.rates[rateKey] || toll.rates.truck || 100;
            tollsOnRoute.push({
              name: toll.name,
              highway: toll.highway,
              lat: toll.lat,
              lon: toll.lon,
              fee
            });
            totalTollCost += fee;
          }
        }

        // Parse turn-by-turn steps
        const legs = route.legs || [];
        const steps = [];
        if (legs.length > 0 && legs[0].steps) {
          for (const s of legs[0].steps) {
            const distM = Math.round(s.distance);
            const distText = distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${distM} m`;
            const durText = Math.round(s.duration / 60) > 0 ? `${Math.round(s.duration / 60)} min` : '< 1 min';
            
            // Format maneuver text
            let instruction = '';
            const type = s.maneuver.type;
            const modifier = s.maneuver.modifier;
            const roadName = s.name ? ` onto ${s.name}` : '';

            if (type === 'depart') {
              instruction = `Head ${modifier || 'forward'}${s.name ? ' on ' + s.name : ''}`;
            } else if (type === 'arrive') {
              instruction = `Arrive at destination`;
            } else if (type === 'turn') {
              instruction = `Turn ${modifier || 'ahead'}${roadName}`;
            } else if (type === 'new name') {
              instruction = `Continue${roadName}`;
            } else if (type === 'end of road') {
              instruction = `At the end of road, turn ${modifier || 'left'}${roadName}`;
            } else if (type === 'roundabout') {
              instruction = `At the roundabout, take exit ${s.maneuver.exit || 1}${roadName}`;
            } else if (type === 'merge') {
              instruction = `Merge ${modifier || 'onto highway'}${roadName}`;
            } else if (type === 'fork') {
              instruction = `Take the ${modifier || 'left'} fork${roadName}`;
            } else {
              instruction = `${type} ${modifier || ''}${roadName}`.trim();
            }

            steps.push({
              instruction,
              type,
              modifier,
              distanceM: distM,
              distanceText: distText,
              durationText: durText,
              location: [s.maneuver.location[1], s.maneuver.location[0]] // [lat, lon]
            });
          }
        }

        // Fuel estimation
        const fuelConsumptionPer100Km = profile === 'truck' ? 28 : profile === 'bike' ? 3 : 8;
        const fuelEstLiters = +((distanceKm / 100) * fuelConsumptionPer100Km).toFixed(1);
        const fuelCostInr = Math.round(fuelEstLiters * 95);

        return res.json({
          success: true,
          profile,
          distanceKm,
          durationMin,
          durationFormatted,
          coordinates,
          steps,
          tolls: tollsOnRoute,
          totalTollCost,
          fuelEstLiters,
          fuelCostInr,
          summary: route.legs?.[0]?.summary || ''
        });
      }
    }
  } catch (err) {
    console.warn('[Directions Routing Error]', err.message);
  }

  // Fallback: Haversine straight corridor with intermediate steps
  const directDist = calcHaversineDistanceKm(origin.lat, origin.lon, destination.lat, destination.lon);
  const estKm = +(directDist * 1.25).toFixed(1);
  const avgKmh = profile === 'truck' ? 50 : profile === 'walking' ? 5 : profile === 'bike' ? 35 : 60;
  const estDurationMin = Math.round((estKm / avgKmh) * 60);

  // Generate intermediate points
  const points = [];
  const stepsCount = 10;
  for (let i = 0; i <= stepsCount; i++) {
    const fraction = i / stepsCount;
    points.push([
      origin.lat + (destination.lat - origin.lat) * fraction,
      origin.lon + (destination.lon - origin.lon) * fraction
    ]);
  }

  res.json({
    success: true,
    profile,
    distanceKm: estKm,
    durationMin: estDurationMin,
    durationFormatted: estDurationMin > 60 ? `${Math.floor(estDurationMin / 60)} hr ${estDurationMin % 60} min` : `${estDurationMin} min`,
    coordinates: points,
    steps: [
      { instruction: `Head towards destination`, distanceText: `${(estKm * 0.4).toFixed(1)} km`, durationText: `${Math.round(estDurationMin * 0.4)} min`, modifier: 'straight' },
      { instruction: `Continue straight on main highway corridor`, distanceText: `${(estKm * 0.5).toFixed(1)} km`, durationText: `${Math.round(estDurationMin * 0.5)} min`, modifier: 'straight' },
      { instruction: `Arrive at destination`, distanceText: '0 m', durationText: '0 min', modifier: 'arrive' }
    ],
    tolls: [],
    totalTollCost: 0,
    fuelEstLiters: +((estKm / 100) * 20).toFixed(1),
    fuelCostInr: Math.round(((estKm / 100) * 20) * 95),
    summary: 'Direct Highway Corridor'
  });
});

// Nearby Places (Petrol Pumps, Food/Dhabas, Parking, Hospitals)
app.get('/api/geo/nearby', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const type = req.query.type || 'fuel'; // fuel, restaurant, parking, hospital

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  // Curated Highway amenities + dynamic Nominatim POI search
  try {
    const amenityMap = {
      fuel: 'fuel',
      food: 'restaurant',
      parking: 'parking',
      hospital: 'hospital',
      mechanic: 'car_repair'
    };
    const amenity = amenityMap[type] || 'fuel';

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=[${amenity}]+near+${lat},${lon}&limit=8&addressdetails=1`;
    const resp = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'FleetProGoogleMapsApp/1.0' }
    });

    if (resp.ok) {
      const items = await resp.json();
      if (items && items.length > 0) {
        const mapped = items.map((item, i) => ({
          id: `poi-${item.place_id || i}`,
          name: item.name || item.display_name.split(',')[0],
          address: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          type,
          distanceKm: +calcHaversineDistanceKm(lat, lon, parseFloat(item.lat), parseFloat(item.lon)).toFixed(2)
        }));
        return res.json({ places: mapped });
      }
    }
  } catch (e) {
    console.warn('[Nearby API error]', e.message);
  }

  // Fallback realistic nearby POIs around the given location
  const offsets = [
    { name: type === 'fuel' ? 'IndianOil Swagat Highway Hub' : type === 'food' ? 'Sukh Sagar Grand Highway Dhaba' : type === 'parking' ? 'Safe Express Commercial Truck Yard' : 'Apex Trauma & General Hospital', dLat: 0.008, dLon: 0.006 },
    { name: type === 'fuel' ? 'HP Auto Care Petrol & Diesel' : type === 'food' ? 'McDonalds Highway Drive-Thru' : type === 'parking' ? 'MIDC Heavy Vehicle Parking Bay' : 'LifeCare Emergency Clinic', dLat: -0.012, dLon: 0.009 },
    { name: type === 'fuel' ? 'Bharat Petroleum SPEED Station' : type === 'food' ? 'Pritam Pure Veg Family Restaurant' : type === 'parking' ? 'FASTag Logistics Rest Zone' : 'City General Medical Care', dLat: 0.005, dLon: -0.014 }
  ];

  const places = offsets.map((o, idx) => ({
    id: `poi-mock-${idx}`,
    name: o.name,
    address: `${o.name}, Highway Corridor`,
    lat: lat + o.dLat,
    lon: lon + o.dLon,
    type,
    distanceKm: +calcHaversineDistanceKm(lat, lon, lat + o.dLat, lon + o.dLon).toFixed(2)
  }));

  res.json({ places });
});


// Test Ping Injection (Allows user to test without actual phone in hand)
app.post('/api/test-ping', (req, res) => {
  const { trackerId = 'T1', lat, lon, speed = 58, heading = 120, battery = 82 } = req.body;
  
  const testPayload = {
    _type: 'location',
    tid: trackerId,
    lat: lat || (18.90 + Math.random() * 0.05),
    lon: lon || (73.20 + Math.random() * 0.05),
    tst: Math.floor(Date.now() / 1000),
    vel: speed,
    cog: heading,
    batt: battery,
    bs: 2,
    acc: 5,
    alt: 110,
    topic: `owntracks/supply/${trackerId.toLowerCase()}`
  };

  // Re-route to our OwnTracks handler
  rawOwnTracksLogs.unshift({
    receivedAt: Date.now(),
    data: testPayload,
    ip: '127.0.0.1 (UI Test Beacon)'
  });

  const target = vehicles[trackerId] || vehicles['T1'];
  target.lat = testPayload.lat;
  target.lon = testPayload.lon;
  target.speed = testPayload.vel;
  target.heading = testPayload.cog;
  target.battery = testPayload.batt;
  target.status = testPayload.vel > 5 ? 'moving' : 'idling';
  target.lastUpdated = Date.now();
  target.history.push({
    lat: testPayload.lat,
    lon: testPayload.lon,
    speed: testPayload.vel,
    heading: testPayload.cog,
    battery: testPayload.batt,
    timestamp: Date.now()
  });

  checkTollAndGeofences(target);

  broadcast({
    type: 'OWNTRACKS_PING',
    vehicle: target,
    rawPayload: testPayload,
    receivedAt: Date.now()
  });

  res.json({ success: true, message: 'Test OwnTracks Beacon Emitted', vehicle: target });
});

// ==========================================
// 3. Multi-Route Planning & Toll Calculator
// ==========================================
app.post('/api/routes/calculate', (req, res) => {
  const { origin, destination, vehicleType = 'truck' } = req.body;

  // Curated Highway corridors with realistic coordinates, toll breakdowns, and distances
  const routes = [
    {
      id: 'route-expressway',
      name: 'Mumbai - Pune Yashwantrao Chavan Expressway (Fastest)',
      tag: 'FASTEST HIGHWAY',
      badgeColor: 'emerald',
      distanceKm: 148,
      durationHours: 2.7,
      durationText: '2 hrs 42 mins',
      avgSpeed: 70,
      fuelEstLiters: 42,
      fuelCostInr: 3990,
      tolls: [
        { name: 'Vashi Creek Toll Plaza', fee: 105, lat: 19.0628, lon: 72.9845 },
        { name: 'Khalapur Toll Plaza', fee: 680, lat: 18.8475, lon: 73.2842 },
        { name: 'Talegaon Toll Plaza', fee: 460, lat: 18.7314, lon: 73.6872 }
      ],
      totalTollCost: 1245,
      roadCondition: 'Concrete 6-Lane Expressway (High Speed, Heavy Vehicle Dedicated Lane)',
      highlights: ['Full FASTag coverage', '24/7 CCTV & Highway Patrol', 'Food Court & Emergency Cranes'],
      coordinates: [
        [18.9498, 72.9510],
        [18.9800, 73.0300],
        [19.0628, 72.9845],
        [19.0100, 73.1100],
        [18.8475, 73.2842],
        [18.7700, 73.4000],
        [18.7500, 73.5500],
        [18.7314, 73.6872],
        [18.7612, 73.8344]
      ]
    },
    {
      id: 'route-old-nh48',
      name: 'Old NH-48 Highway (Shortest Distance)',
      tag: 'SHORTEST PATH',
      badgeColor: 'blue',
      distanceKm: 134,
      durationHours: 3.5,
      durationText: '3 hrs 30 mins',
      avgSpeed: 45,
      fuelEstLiters: 36,
      fuelCostInr: 3420,
      tolls: [
        { name: 'Vashi Creek Toll Plaza', fee: 105, lat: 19.0628, lon: 72.9845 },
        { name: 'Khopoli Entry Toll Plaza', fee: 260, lat: 18.7900, lon: 73.3400 }
      ],
      totalTollCost: 365,
      roadCondition: '4-Lane Asphalt National Highway (Moderate Ghat Incline, Market Crossings)',
      highlights: ['Lower Toll Expenses', 'Direct Access to Industrial Townships', 'More Dhaba & Repair Garages'],
      coordinates: [
        [18.9498, 72.9510],
        [18.9900, 73.0800],
        [18.9200, 73.2000],
        [18.7900, 73.3400],
        [18.7500, 73.4800],
        [18.7200, 73.6500],
        [18.7612, 73.8344]
      ]
    },
    {
      id: 'route-toll-free',
      name: 'State Highway via Karjat - Talegaon Link (Toll-Free Route)',
      tag: 'TOLL FREE / ZERO TOLL',
      badgeColor: 'amber',
      distanceKm: 162,
      durationHours: 4.2,
      durationText: '4 hrs 12 mins',
      avgSpeed: 38,
      fuelEstLiters: 48,
      fuelCostInr: 4560,
      tolls: [],
      totalTollCost: 0,
      roadCondition: '2-Lane State Highway (Rural Curves, Single Carriageway)',
      highlights: ['₹0 FASTag Toll Expense', 'Bypasses Major Expressway Blockages', 'Scenic Rural Freight Corridor'],
      coordinates: [
        [18.9498, 72.9510],
        [18.9200, 73.0500],
        [18.9100, 73.3200],
        [18.8200, 73.4800],
        [18.7400, 73.6200],
        [18.7612, 73.8344]
      ]
    }
  ];

  res.json({
    origin: origin || 'JNPT Port Container Terminal',
    destination: destination || 'Chakan MIDC Auto Supply Hub',
    routes
  });
});

// ==========================================
// 4. Live Realistic Fleet Simulation Engine (Disabled by default so ONLY real phone is tracked)
let simulationActive = false;
let simStepIndex = 0;

// Waypoint paths for simulation
const simPathT1 = [
  { lat: 18.9498, lon: 72.9510, heading: 90, speed: 45 },
  { lat: 18.9800, lon: 73.0300, heading: 105, speed: 65 },
  { lat: 19.0100, lon: 73.1100, heading: 110, speed: 74 },
  { lat: 18.9200, lon: 73.1800, heading: 115, speed: 68 },
  { lat: 18.8475, lon: 73.2842, heading: 120, speed: 22 }, // Khalapur Toll
  { lat: 18.8000, lon: 73.3500, heading: 130, speed: 50 },
  { lat: 18.7700, lon: 73.4000, heading: 135, speed: 42 },
  { lat: 18.7500, lon: 73.5500, heading: 110, speed: 76 },
  { lat: 18.7314, lon: 73.6872, heading: 105, speed: 25 }, // Talegaon Toll
  { lat: 18.7612, lon: 73.8344, heading: 90, speed: 40 }   // Chakan MIDC Hub
];

const simPathT2 = [
  { lat: 19.1600, lon: 72.9500, heading: 45, speed: 52 },
  { lat: 19.1900, lon: 72.9800, heading: 50, speed: 58 },
  { lat: 19.2200, lon: 73.0200, heading: 55, speed: 48 },
  { lat: 19.2600, lon: 73.0500, heading: 40, speed: 40 },
  { lat: 19.2967, lon: 73.0631, heading: 30, speed: 15 }  // Bhiwandi Hub
];

setInterval(() => {
  if (!simulationActive) return;

  simStepIndex++;
  const idx1 = simStepIndex % simPathT1.length;
  const pt1 = simPathT1[idx1];

  // Update T1
  const t1 = vehicles['T1'];
  if (t1) {
    t1.lat = pt1.lat + (Math.random() - 0.5) * 0.003;
    t1.lon = pt1.lon + (Math.random() - 0.5) * 0.003;
    t1.heading = pt1.heading;
    t1.speed = Math.max(0, pt1.speed + Math.round((Math.random() - 0.5) * 8));
    t1.status = t1.speed > 5 ? 'moving' : 'idling';
    t1.lastUpdated = Date.now();
    t1.history.push({
      lat: t1.lat,
      lon: t1.lon,
      speed: t1.speed,
      altitude: 150,
      heading: t1.heading,
      timestamp: Date.now(),
      battery: t1.battery
    });
    if (t1.history.length > 500) t1.history.shift();

    checkTollAndGeofences(t1);
    broadcast({ type: 'SIMULATION_UPDATE', vehicle: t1 });
  }

  // Update T2 every 2nd step
  if (simStepIndex % 2 === 0) {
    const idx2 = Math.floor(simStepIndex / 2) % simPathT2.length;
    const pt2 = simPathT2[idx2];
    const t2 = vehicles['T2'];
    if (t2) {
      t2.lat = pt2.lat + (Math.random() - 0.5) * 0.002;
      t2.lon = pt2.lon + (Math.random() - 0.5) * 0.002;
      t2.heading = pt2.heading;
      t2.speed = Math.max(0, pt2.speed + Math.round((Math.random() - 0.5) * 6));
      t2.status = t2.speed > 5 ? 'moving' : 'idling';
      t2.lastUpdated = Date.now();
      t2.history.push({
        lat: t2.lat,
        lon: t2.lon,
        speed: t2.speed,
        altitude: 40,
        heading: t2.heading,
        timestamp: Date.now(),
        battery: t2.battery
      });
      if (t2.history.length > 500) t2.history.shift();
      checkTollAndGeofences(t2);
      broadcast({ type: 'SIMULATION_UPDATE', vehicle: t2 });
    }
  }
}, 4000);

// Simulation Toggle API
app.post('/api/simulate/toggle', (req, res) => {
  simulationActive = !simulationActive;
  broadcast({ type: 'SIMULATION_STATUS', active: simulationActive });
  res.json({ active: simulationActive });
});

// WebSocket Connection Handler (Active on persistent server hosts)
if (wss) {
  wss.on('connection', (ws) => {
    console.log('[WebSocket] Dashboard Client connected');
    // Send current state immediately upon connection
    ws.send(JSON.stringify({
      type: 'INIT_STATE',
      vehicles: Object.values(vehicles),
      alerts: alertsLog.slice(0, 20),
      simulationActive,
      tolls: TOLL_PLAZAS,
      hubs: SUPPLY_HUBS
    }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG' }));
        }
      } catch (e) {
        // ignore
      }
    });

    ws.on('close', () => {
      // client disconnected
    });
  });
}

// Start HTTP Server when running standalone (non-serverless)
if (!process.env.VERCEL && !process.env.NETLIFY) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚛 SUPPLY FLEET TRACKER - ENTERPRISE BACKEND ENGINE 🚀`);
    console.log(`📡 HTTP & OwnTracks Ingestion Port: http://localhost:${PORT}`);
    console.log(`📡 OwnTracks Webhook Endpoint: POST http://localhost:${PORT}/api/owntracks`);
    console.log(`⚡ WebSocket Server Active on ws://localhost:${PORT}`);
    console.log(`=======================================================`);
    console.log(`Available Local Network Addresses for OwnTracks Mobile:`);
    getLocalIpAddresses().forEach((ip) => {
      console.log(`  📱 Mobile Endpoint: http://${ip.address}:${PORT}/api/owntracks`);
    });
    console.log(`=======================================================`);
  });
}

// Export default app for Vercel Serverless Functions
export default app;
