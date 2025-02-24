import dotenv from "dotenv";
import { app } from "./app.js";
import connectDB from "./db/index.js";

dotenv.config({
  path: "../.env",
});
console.log(process.env.PORT);
console.log(process.env.MONGODB_URI);
console.log(typeof process.env.MONGODB_URI);

const port = process.env.PORT || 8000;
connectDB()
  .then(() => {
    try {
      console.log("Connected to the database");
      app.on("error", (error) => {
        console.error("Error: ", error);
        throw error;
      });
      app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
      });
    } catch (error) {
      console.error("Error in starting the server : ", error);
    }
  })
  .catch((err) => {
    console.log("MongoDB connection failed : ", err);
  });

// (async () => {
//   try {
//     await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
//     console.log("Connected to the database");
//     app.on("error", (error) => {
//       console.error("Error: ", error);
//     });
//
//     app.listen(process.env.PORT, () => {
//       console.log(`Server is running on port ${process.env.PORT}`);
//     });
//
//   } catch (error) {
//     console.error("Error: ", error);
//   }
// })();
