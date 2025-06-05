import express from 'express'
import {register,login, logout} from '../controllers/authController.js'

// create authRouter
const authRouter=express.Router();

// API endpoints for router

// Register Route
authRouter.post('/register',register);
// Login Route
authRouter.post('/login',login);
// Logout Route
authRouter.post('/logout',logout);

export default authRouter;