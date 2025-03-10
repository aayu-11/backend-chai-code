import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const deleteLocalFile = (localFilePath) => {
  if (fs.existsSync(localFilePath)) {
    try {
      fs.unlinkSync(localFilePath);
      // console.log("Successfully deleted:", localFilePath);
    } catch (error) {
      console.error("Error deleting file:", localFilePath, error);
    }
  } else {
    console.log("File does not exist:", localFilePath);
  }
};

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) {
      throw new Error("Local file path not provided");
    }
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // console.log("Uploaded on cloudinary:", response);
    deleteLocalFile(localFilePath);
    return response;
  } catch (error) {
    deleteLocalFile(localFilePath);
    console.error("Error in uploading file on cloudinary:", error);
    return null;
  }
};

export { uploadOnCloudinary };
