import mongoose from "mongoose"
import {Video} from "../models/video.models.js"
import {Subscription} from "../models/subscription.models.js"
import {Like} from "../models/like.models.js"
import { User } from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    const videoStats = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "_id",
                foreignField: "owner",
                as: "videos"
            }
        },
        {
            $unwind: "$videos"
        },
        {
            $lookup: {
                from: "likes",
                localField: "videos._id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $group: {
                _id: "$_id",
                username: { $first: "$username" }, 
                fullname: { $first: "$fullname" }, 
                avatar: { $first: "$avatar" }, 
                videoCount: { $sum: 1 },
                viewCount: { $sum: "$videos.views" },
                likeCount: { $sum: { $size: "$likes" } }
            }
        },
        {
            $project: {
                _id: 1,
                username: 1,
                fullname: 1,
                avatar: 1,
                viewCount: "$viewCount",
                likeCount: "$likeCount",
                videoCount: 1
            }
        }
    ]);    

    const subscriberStats = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $group: {
                _id: null,
                subscriberCount: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0, 
                subscriberCount: 1
            }
        }
    ]);

    const stats = {
        _id: videoStats[0]?._id,
        username: videoStats[0]?.username,
        fullname: videoStats[0]?.fullname,
        avatar: videoStats[0]?.avatar,
        totalLikes: videoStats[0]?.likeCount || 0,
        totalViews: videoStats[0]?.viewCount || 0,
        totalvideos: videoStats[0]?.videoCount || 0,
        totalSubscribers: subscriberStats[0]?.subscriberCount || 0
    };

    return res.status(200)
        .json(new ApiResponse(200, "Channel stats fetched successfully", stats));
});


const getChannelVideos = asyncHandler(async (req, res) => {
    const channelVideos = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "_id",
                foreignField: "owner",
                as: "videos"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribers"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                videoCount: {
                    $size: "$videos"
                }
            }
        },
        {
            $project: {
                _id: 1,
                username: 1,
                fullname: 1,
                avatar: 1,
                coverImage: 1,
                subscriberCount: 1,
                videoCount: 1,
                videos: {
                    videoFile: 1,
                    thumbnail: 1,
                    title: 1,
                    description: 1,
                    duration: 1,
                    views: 1,
                    createdAt: 1
                }
            }
        }
    ])

    return res.status(200)
    .json(new ApiResponse(200, "Channel videos fetched successfully", channelVideos))
})

export {
    getChannelStats, 
    getChannelVideos
    }