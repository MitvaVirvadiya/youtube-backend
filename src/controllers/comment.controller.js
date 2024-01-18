import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.models.js"
import {Video} from '../models/video.models.js';
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video Id")
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const comment = Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likedBy"
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likedBy"
                },
                owner: {
                    $first: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likedBy.likedBy"]},
                        then: true,
                        else: false
                    } 
                }
            }
        },
        {
            $project: {
                _id: 1,
                content: 1,
                createdAt: 1,
                owner: {
                    username: 1,
                    fullname: 1,
                    avatar: 1
                },
                likesCount: 1,
                isLiked: 1
            }
        }        
    ])
     

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    }

    const allComments = await Comment.aggregatePaginate(comment, options)

    return res.status(200)
    .json(new ApiResponse(200, "Video comments fetched successfully", allComments))
})

const addComment = asyncHandler(async (req, res) => {    
    const {videoId} = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video Id")
    }

    const {content} = req.body

    if(!content){
        throw new ApiError(400, "Field is empty")
    }

    const createdComment = await Comment.create({
        content,
        video: videoId,
        owner: req.user?._id
    })

    if(!createdComment){
        throw new ApiError(400, "Something went wrong while adding comment")
    }

    return res.status(200)
    .json(new ApiResponse(200, "Comment added successfully", createdComment))
})

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if(!isValidObjectId(commentId)){
        throw new ApiError(400, "Invalid comment Id")
    }
    
    const { content } = req.body

    if(!content){
        throw new ApiError(400, "Field is empty")
    }

    const comment = await Comment.findById(commentId)

    if(!comment){
        throw new ApiError(400, "Comment doesn't exist")
    }

    if(comment?.owner.toString() != req.user?._id){
        throw new ApiError(400, "Only owner can edit comment")
    }

    const updatedComment = await Comment.findByIdAndUpdate(commentId,
        {
            $set: {
                content
            }
        },
        {new: true}    
    )

    if(!updatedComment){
        throw new ApiError(400, "Something went wrong while updating comment")
    }

    return res.status(200)
    .json(new ApiResponse(200, "Comment updated successfully", updatedComment))

})

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if(!isValidObjectId(commentId)){
        throw new ApiError(400, "Invalid comment Id")
    }

    const comment = await Comment.findById(commentId)

    if(!comment){
        throw new ApiError(400, "Comment doesn't exist")
    }

    if(comment?.owner.toString() != req.user?._id){
        throw new ApiError(400, "Only owner can delete comment")
    }

    const deletedComment = await Comment.findByIdAndDelete(commentId)

    if(!deletedComment){
        throw new ApiError(400, "Something went wrong while deleting comment")
    }

    return res.status(200)
    .json(new ApiResponse(200, "Comment deleted successfully", deletedComment))
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }
