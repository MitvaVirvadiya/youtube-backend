import connectDB from "./db/index.js";
import dotenv from "dotenv";
import { app } from "./app.js";

dotenv.config({
    path: './.env'
})

connectDB()
.then(() => {
    app.on("error", (err) => {
        console.log("err: ", err);
        throw err;
    })

    app.listen(process.env.PORT || 8000, () => {
        console.log(`\n⛏️  Server is running at PORT: ${process.env.PORT}`);
    })
})
.catch((err) => {~
    console.log("MongoBD Connection Failes!!", err);
})