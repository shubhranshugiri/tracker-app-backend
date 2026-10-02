import mongoose from 'mongoose';
import { seedDatabase } from './seed.js';

export let isDbConnected = false;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('<db_password>')) {
    console.warn('⚠️ [MongoDB Warning] MONGODB_URI is either missing or contains placeholder <db_password>.');
    console.warn('⚠️ Please update server/.env with your real MongoDB Atlas password to enable permanent cloud DB storage.');
    console.warn('⚡ Running in In-Memory fallback mode so server works without interruption.');
    return;
  }

  try {
    const conn = await mongoose.connect(uri);
    isDbConnected = true;
    console.log(`✅ [MongoDB Connected] Database Host: ${conn.connection.host}, Name: ${conn.connection.name}`);
    
    // Automatically seed default tables/collections if empty
    await seedDatabase();
  } catch (error) {
    console.error('❌ [MongoDB Connection Error]', error.message);
    console.warn('⚡ Operating with In-Memory fallback storage.');
  }
}
