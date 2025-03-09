import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validate user details - not empty, valid email, etc.
  // check if user already exists: email, username
  // check for images and check for avatar
  // upload image to cloudinary
  // create user object - create user entry in db
  // remove password and refresh token from response
  // check for errors and return response

  const { fullName, email, username, password } = req.body;
  console.table({
    fullName: fullName,
    email: email,
    username: username,
    password: password,
  });

  if (
    [fullName, email, username, password].some((value) => value?.trim() === "")
  ) {
    throw new ApiError(400, "Please provide all details");
  }

  if (!email.includes("@") || !email.includes(".")) {
    throw new ApiError(400, "Please provide a valid email address");
  }

  const existedUser = User.findOne({
    $or: [{ email }, { username }],
  });
  console.log(existedUser);

  if (existedUser) {
    throw new ApiError(409, "User already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  console.log(req.files);

  if (!avatarLocalPath) {
    throw new ApiError(400, "Please provide an avatar image");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(500, "Image upload failed");
  }

  const user = await User.create({
    fullName,
    email,
    username: username.toLowerCase(),
    password,
    avatar: avatar.url,
    coverImage: coverImage.url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "User registration failed");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered Successfully"));
});

export { registerUser };
