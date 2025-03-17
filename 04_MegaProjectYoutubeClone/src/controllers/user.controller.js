import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({
      validateBeforeSave: false,
    });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Token generation failed");
  }
};

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
  // console.log("req.body : ", req.body);

  if (
    [fullName, email, username, password].some((value) => value?.trim() === "")
  ) {
    throw new ApiError(400, "Please provide all details");
  }

  if (!email.includes("@") || !email.includes(".")) {
    throw new ApiError(400, "Please provide a valid email address");
  }

  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    console.log("User Already Exists in db : ", existedUser);
    throw new ApiError(409, "User already exists");
  }

  const avatarLocalPath = req.files?.avatar?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.coverImage[0]?.path;

  // console.log(req.files);

  if (!avatarLocalPath) {
    throw new ApiError(400, "Please provide an avatar image");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = coverImageLocalPath
    ? await uploadOnCloudinary(coverImageLocalPath)
    : null;

  if (!avatar) {
    throw new ApiError(500, "Image upload failed");
  }

  const user = await User.create({
    fullName,
    email,
    username: username.toLowerCase(),
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "User registration failed");
  }
  // console.log("createdUser : ", createdUser);

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // get user details from req.body
  // username / email
  // find the user in db
  // password check
  // access and refresh token
  // send cookies

  const { username, email, password } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "Please provide username or email");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid password");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // here we are making another db call to get the user details which can be avoided
  // by creating a user object with the required fields and deleting the password and refresh token
  // from the user object before sending the response

  // const loggedInUser = await User.findById(user._id).select(
  //   "-password -refreshToken"
  // );

  const loggedInUser = user.toObject();
  delete loggedInUser.password;
  delete loggedInUser.refreshToken;

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // req.user is added by verifyJWT middleware
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  // get the refresh token from the cookies

  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(400, "Refresh token not found");
  }

  try {
    // verify the refresh token

    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    if (!decodedToken) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // find user in db
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(404, "User not found for the given refresh token");
    }

    // check if the refresh token is valid
    if (user?.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Referesh token is expired or invalid");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    // generate new access and refresh tokens
    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, "Error while refreshing the access token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  // get the current password, new password and confirm password from the req.body

  const { currentPassword, newPassword, confirmPassword } = req.body;

  // validate the new password and confirm password
  if (newPassword !== confirmPassword) {
    throw new ApiError(400, "New password and confirm password do not match");
  }

  // check if the current password is correct
  const user = await User.findById(req.user._id);
  const isPasswordValid = await user.isPasswordCorrect(currentPassword);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid current password");
  }

  // update the password
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User details fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  // get the updated user details from req.body

  const { fullName, email, username } = req.body;

  // check if the email or username is not empty
  if (!email || !username) {
    throw new ApiError(400, "Please provide email or username");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  // get the avatar image from req.files
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Please provide an avatar image");
  }
  // console.log("avatarLocalPath : ", avatarLocalPath);

  // upload the image to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  // console.log("avatar : ", avatar);

  if (!avatar?.url) {
    throw new ApiError(500, "Image upload failed");
  }

  // update the user avatar in db
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  // get the avatar image from req.files
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Please provide an cover image");
  }

  // upload the image to cloudinary
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(500, "Image upload failed");
  }

  // update the user avatar in db
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelDetails = asyncHandler(async (req, res) => {
  // get the user id from the req.params
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username  is required");
  }

  const channel = await User.aggregate([
    {
      $match: { username: username?.toLowerCase() },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscriptions",
      },
    },
    {
      $addFields: {
        subscriberCount: { $size: "$subscribers" },
        subscriptionCount: { $size: "$subscriptions" },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        avatar: 1,
        coverImage: 1,
        subscriberCount: 1,
        subscriptionCount: 1,
        isSubscribed: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "Channel not found");
  }
  console.log("channel : ", channel);

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "Channel details fetched successfully")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(req.user._id) },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: { $first: "$owner" },
            },
          },
        ],
      },
    },
  ]);

  if (!user?.length) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelDetails,
  getWatchHistory,
};
