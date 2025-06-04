import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRouter from './routes/authRoute.js';
import cookieParser from 'cookie-parser';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Middlewares
app.use(cors({credentials:true}));
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());

// API routes
app.get('/', (req, res) => {
  res.send('API is running...');
});
app.use('/api/auth',authRouter);

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () =>{
    console.log(`Server running on http://localhost:${PORT}`);
    }); 
  })
  .catch((err) => console.error('MongoDB connection failed:', err));

