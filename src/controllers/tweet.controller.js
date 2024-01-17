import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.models.js"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const { content } = req.body;

    if (!content) {
        throw new ApiError(400, "Field is empty");
    }

    const createdTweet = await Tweet.create({
        content,
        owner: req.user?._id,
    });

    if (!createdTweet) {
        throw new ApiError(400, "Something wrong while creating tweet");
    }

    return res.status(200).json(new ApiResponse(200, "Tweet created successfully", createdTweet));
});


const getUserTweets = asyncHandler(async (req, res) => {
    const {userId} = req.params

    if(!isValidObjectId(userId)){
        throw new ApiError(400, "Invalid user Id")
    }

    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
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
                        $project: {
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likedBy",
                pipeline: [
                    {
                        $project: {
                            likedBy: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                totalLikes: {
                    $size: "$likedBy"
                },
                ownerDetails: {
                    $first: "$owner"
                }
            }
        },
        {
            $project: {
                content: 1,
                ownerDetails: 1,
                totalLikes: 1,
                createdAt: 1
            }
        }
    ])

    if(!tweets?.length){
        throw new ApiError(400, "User tweets don't exists")
    }

    return res.status(200)
    .json(new ApiResponse(200, "User Tweets fetched successfully", tweets))
})

const updateTweet = asyncHandler(async (req, res) => {
    const {tweetId} = req.params

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400, "Invalid tweet Id")
    }
    
    const {content} = req.body
    
    if(!content){
        throw new ApiError(400, "Field is empty")
    }
    
    const tweet = await Tweet.findById(tweetId)
    
    if(!tweet){
        throw new ApiError(400, "Tweet doesn't exist")
    }
    
    if(tweet?.owner.toString() != req.user?._id){
        throw new ApiError(400, "Only owner can edit tweet")
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(tweetId,
        {
            $set: {
                content
            }
        }, 
        {new: true}
    )

    if(!updatedTweet){
        throw new ApiError(400, "Something wrong while updating tweet")
    }

    return res.status(200)
    .json(new ApiResponse(200, "Tweet updated successfully", updatedTweet))
})

const deleteTweet = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    
    if(!isValidObjectId(tweetId)){
        throw new ApiError(400, "Invalid tweet Id")
    }
    
    const tweet = await Tweet.findById(tweetId)
    
    if(!tweet){
        throw new ApiError(400, "Tweet doesn't exist")
    }
        
    if(tweet?.owner.toString() != req.user?._id){
        throw new ApiError(400, "Only owner can edit tweet")
    }
    
    const deletedTweet = await Tweet.findByIdAndDelete(tweetId)

    if(!deletedTweet){
        throw new ApiError(400, "Something wrong while deleting tweet")
    }
    
    return res.status(200)
    .json(new ApiResponse(200, "Tweet deleted successfully", deletedTweet))
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}
