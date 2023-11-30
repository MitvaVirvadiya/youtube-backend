import { userRegister } from "../controllers/user.controllers.js";
import { Router } from "express";

const router = Router();

router.route("/register").post(userRegister)

export default router;
