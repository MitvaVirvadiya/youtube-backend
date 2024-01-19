import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video Id")
    }

    const likedVideo = await Like.findOne({
        video: videoId,
        likedBy: req.user?._id
    })

    if(likedVideo){
        await Like.findByIdAndDelete(likedVideo?._id)

        return res.status(200)
        .json(new ApiResponse(200, "Video unliked successfully", {}))
    }

    const videoLiked = await Like.create({
        video: videoId,
        likedBy: req.user?._id
    })

    return res.status(200)
    .json(new ApiResponse(200, "Video liked successfully", videoLiked))
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params

    if(!isValidObjectId(commentId)){
        throw new ApiError(400, "Invalid comment Id")
    }

    const likedComment = await Like.findOne({
        comment: commentId,
        likedBy: req.user?._id
    })

    if(likedComment){
        await Like.findByIdAndDelete(likedComment?._id)

        return res.status(200)
        .json(new ApiResponse(200, "comment unliked successfully", {}))
    }

    const commentLiked = await Like.create({
        comment: commentId,
        likedBy: req.user?._id
    })

    return res.status(200)
    .json(new ApiResponse(200, "comment liked successfully", commentLiked))
})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400, "Invalid tweet Id")
    }

    const likedTweet = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user?._id
    })

    if(likedTweet){
        await Like.findByIdAndDelete(likedTweet?._id)

        return res.status(200)
        .json(new ApiResponse(200, "tweet unliked successfully", {}))
    }

    const tweetLiked = await Like.create({
        tweet: tweetId,
        likedBy: req.user?._id
    })

    return res.status(200)
    .json(new ApiResponse(200, "tweet liked successfully", tweetLiked))
})

const getLikedVideos = asyncHandler(async (req, res) => {
    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "videos",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner"
                        }
                    },
                ]
            }
        },
        {
            $addFields: {
                videoCount: {
                    $size: "$videos"
                }
            }
        },
        {
            $unwind: "$videos"
        },
        {
            $project: {
                videos: {
                    _id: 1,
                    videoFile: 1,
                    thumbnail: 1,
                    title: 1,
                    description: 1,
                    duration: 1,
                    updatedAt: 1,
                    views: 1,
                    owner: {
                        username: 1,
                        avatar: 1
                    }
                },
                videoCount: 1,
                updatedAt: 1,
            }
        }
    ])


    return res.status(200)
    .json(new ApiResponse(200, "Liked videos fetched successfully", likedVideos))
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}