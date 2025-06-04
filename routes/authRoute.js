import express from 'express'
import {login, logout, register} from '../controllers/authController.js'

// create authRouter
const authRouter=express.Router();

// API endpoints for router
authRouter.post('/register',register);
authRouter.post('/login',login);
authRouter.post('/logout',logout);

export default authRouter;