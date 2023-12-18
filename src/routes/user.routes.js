import { refreshAccessToken, userLogin, userLogout, userRegister } from "../controllers/user.controllers.js";
import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1,
        },
        {
            name: "coverImage",
            maxCount: 1,
        },
    ]),
    userRegister)

router.route("/login").post(userLogin)


//secured routes
router.route("/logout").post(verifyJWT, userLogout)
router.route("/refreshToken").post(refreshAccessToken)

export default router;