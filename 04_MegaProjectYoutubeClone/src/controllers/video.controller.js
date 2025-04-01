import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  console.log("query", req.query);
  const pipeline = [];

  // for using Full Text based search u need to create a search index in mongoDB atlas
  // you can include field mapppings in search index eg.title, description, as well
  // Field mappings specify which fields within your documents should be indexed for text search.
  // this helps in seraching only in title, desc providing faster search results
  // here the name of search index is 'search-videos'

  if (query) {
    pipeline.push({
      $search: {
        index: "search-videos",
        text: {
          query: query,
          path: ["title", "description"], //search only on title, desc
        },
      },
    });
  }

  if (userId) {
    if (!isValidObjectId(userId)) {
      return new ApiError(400, "Invalid request", "User id is not valid");
    }
    pipeline.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });
  }

  // fetch videos that are published
  pipeline.push({
    $match: { isPublished: true },
  });

  //sortBy can be views, createdAt, duration
  //sortType can be ascending(-1) or descending(1)
  if (sortBy && sortType) {
    pipeline.push({
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    });
  } else {
    pipeline.push({
      $sort: {
        createdAt: -1,
      },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              username: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$ownerDetails",
    }
  );

  const videoAggregate = Video.aggregate(pipeline);
  console.log("videoAggregate: ", videoAggregate);
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };
  const videos = await Video.aggregatePaginate(videoAggregate, options);
  console.log("videos: ", videos);

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if ([title, description].some((field) => field?.trim === "")) {
    return new ApiError(
      400,
      "Invalid request",
      "Title and description are required"
    );
  }

  console.log("req.files", req.files);

  const videoLocalFilePath = req.files?.videoFile[0]?.path;
  const thumbnailLocalFilePath = req.files?.thumbnail[0]?.path;

  if (!videoLocalFilePath || !thumbnailLocalFilePath) {
    return new ApiError(
      400,
      "Invalid request",
      "Video file or thumbnail not found"
    );
  }

  const videoFile = await uploadOnCloudinary(videoLocalFilePath);
  const thumbnailFile = await uploadOnCloudinary(thumbnailLocalFilePath);

  if (!videoFile || !thumbnailFile) {
    return new ApiError(
      500,
      "Error uploading video",
      "Video file or thumbnail not found"
    );
  }

  const video = await Video.create({
    title,
    description,
    duration: videoFile.duration,
    videoFile: {
      url: videoFile.url,
      publicId: videoFile.public_id,
    },
    thumbnail: {
      url: thumbnailFile.url,
      publicId: thumbnailFile.public_id,
    },
    owner: req.user?._id,
    isPublished: false,
  });

  const videoUploaded = await Video.findById(video._id);

  if (!videoUploaded) {
    return new ApiError(
      500,
      "Error uploading video",
      "Video not found after upload"
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, videoUploaded, "Video uploaded successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    return new ApiError(400, "Invalid request", "Video id is not valid");
  }

  if (!isValidObjectId(req.user?._id)) {
    return new ApiError(400, "Invalid request", "User id is not valid");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscriberCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: {
                    $in: [req.user?._id, "$subscribers.subscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              "avatar.url": 1,
              subscriberCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: {
              $in: [req.user?._id, "$likes.likedBy"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        "videoFile.url": 1,
        title: 1,
        description: 1,
        views: 1,
        createdAt: 1,
        duration: 1,
        comments: 1,
        likesCount: 1,
        isLiked: 1,
        owner: 1,
      },
    },
  ]);

  if (!video || video.length === 0) {
    return new ApiError(404, "Not found", "Video not found");
  }

  // increment views count if fetched successfully
  await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });

  // add this video to user's watch history
  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { watchHistory: videoId },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "Video fetched successfully"));
});

// update video details like title, description and thumbnail
const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  if (!isValidObjectId(videoId)) {
    return new ApiError(400, "Invalid VideoId");
  }

  if (!(title && description)) {
    throw new ApiError(
      400,
      "Invalid request",
      "Title and description are required"
    );
  }

  const video = await Video.findById(videoId);
  if (!video) {
    return new ApiError(404, "Not found", "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    return new ApiError(
      403,
      "Forbidden",
      "You are not allowed to update this video"
    );
  }

  // deleting old thumbnail and updating with new one
  const thumbnailToDelete = video.thumbnail.publicId;

  const thumbnailLocalFilePath = req.files?.path;

  if (!thumbnailLocalFilePath) {
    return new ApiError(400, "Invalid request", "Thumbnail not found");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocalFilePath);

  if (!thumbnail) {
    return new ApiError(
      500,
      "Error uploading thumbnail",
      "Thumbnail not found"
    );
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      title,
      description,
      thumbnail: {
        url: thumbnail.url,
        publicId: thumbnail.public_id,
      },
    },
    { new: true }
  );

  if (!updatedVideo) {
    return new ApiError(500, "Error updating video", "failed to update video");
  }

  if (updatedVideo) {
    await deleteOnCloudinary(thumbnailToDelete);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    return new ApiError(400, "Invalid VideoId");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    return new ApiError(404, "Not found", "Video not found");
  }

  if (video?.owner.toString() !== req.user._id.toString()) {
    return new ApiError(
      403,
      "Forbidden",
      "You are not allowed to delete this video"
    );
  }

  const deletedVideo = await Video.findByIdAndDelete(video._id);

  if (!deletedVideo) {
    return new ApiError(500, "Error deleting video", "failed to delete video");
  }

  await deleteOnCloudinary(video.videoFile.publicId, "video"); // specifying type as video
  await deleteOnCloudinary(video.thumbnail.publicId);

  await Like.deleteMany({ video: video._id });
  await Comment.deleteMany({ video: video._id });

  return res
    .status(200)
    .json(new ApiResponse(200, deletedVideo, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    return new ApiError(400, "Invalid VideoId");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    return new ApiError(404, "Not found", "Video not found");
  }

  if (video?.owner.toString() !== req.user._id.toString()) {
    return new ApiError(
      403,
      "Forbidden",
      "You are not allowed to update this video"
    );
  }

  const toggledVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: { isPublished: !video.isPublished },
    },
    { new: true }
  );

  if (!toggledVideo) {
    return new ApiError(500, "Error updating video", "failed to update video");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        toggledVideo,
        `Video is now ${toggledVideo.isPublished ? "published" : "unpublished"}`
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
