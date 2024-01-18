import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Video } from "../models/video.models.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body

    if(!name || !description){
        throw new ApiError(400, "All fields are required")
    }

    const createdPlaylist = await Playlist.create({
        name,
        description,
        owner: req.user?._id
    })

    if(!createdPlaylist){
        throw new ApiError(400, "Something went wrong while creating a playlist")
    }

    return res.status(200)
    .json(new ApiResponse(200, "Playlist created successfully", createdPlaylist))
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    
    if(!isValidObjectId(userId)){
        throw new ApiError(400, "Invalid user Id")
    }

    const userPlaylist = await Playlist.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos"
            }
        },
        {
            $addFields: {
                videoCount: {
                    $size: "$videos"
                },
                videos: {
                    $first: "$videos"
                }
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                description: 1,
                videos: {
                    _id: 1,
                    thumbnail: 1,
                },
                videoCount: 1,
                updatedAt: 1,
                createdAt: 1
            }
        }
    ])

    return res.status(200)
    .json(new ApiResponse(200, "Users playlist fetched successfully", userPlaylist))
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    
    if(!isValidObjectId(playlistId)){
        throw new ApiError(400, "Invalid playlist Id")
    }

    const playlist = await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(400, "Playlist doesn't exist")
    }

    const playlists = await Playlist.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos"
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
            $addFields: {
                videoCount: {
                    $size: "$videos"
                },
                viewsCount: {
                    $sum: "$videos.views"
                },
                owner: {
                    $first: "$owner"
                }
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                description: 1,
                owner: {
                    username: 1,
                    fullname: 1,
                    avatar: 1,
                },
                videos: {
                    _id: 1,
                    videoFile: 1,
                    thumbnail: 1,
                    title: 1,
                    description: 1,
                    duration: 1,
                    createdAt: 1,
                    views: 1
                },
                videoCount: 1,
                viewsCount: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ])

    return res.status(200)
    .json(new ApiResponse(200, "Playlist videos fetched successfully", playlists))
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params

    if(!isValidObjectId(playlistId)){
        throw new ApiError(400, "Invalid playlist Id")
    }

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video Id")
    }

    const playlist = await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(400, "Playlist doesn't exist")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(400, "video doesn't exist")
    }

    if((playlist?.owner.toString()) != req.user?._id){
        throw new ApiError(400, "only owner can add videos to a playlist")
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(playlistId,
        {
            $addToSet: {
                videos: videoId
            }
        },
        {new: true}    
    )

    if(!updatedPlaylist){
        throw new ApiError(400, "Something went wrong while adding video to a playlist")
    }

    return res.status(200)
    .json(new ApiResponse(200, "Video added to Playlist successfully", updatedPlaylist))
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params

    if(!isValidObjectId(playlistId)){
        throw new ApiError(400, "Invalid playlist Id")
    }

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video Id")
    }

    const playlist = await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(400, "Playlist doesn't exist")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(400, "video doesn't exist")
    }

    if((playlist?.owner.toString()) != req.user?._id){
        throw new ApiError(400, "only owner can remove videos from a playlist")
    }

    const deletedPlaylist = await Playlist.findByIdAndUpdate(playlistId,
        {
            $pull: {
                videos: videoId
            }
        },
        {new: true}    
    )

    if(!deletedPlaylist){
        throw new ApiError(400, "Something went wrong while removing video to a playlist")
    }

    return res.status(200)
    .json(new ApiResponse(200, "Video removed from Playlist successfully", deletedPlaylist))
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params

    if(!isValidObjectId(playlistId)){
        throw new ApiError(400, "Invalid playlist Id")
    }

    const playlist = await Playlist.findById(playlistId)
    
    if(!playlist){
        throw new ApiError(400, "Playlist doesn't exist")
    }
    
    if(playlist?.owner.toString() != req.user?._id){
        throw new ApiError(400, "only owner can delete playlist")
    }

    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId)

    if(!deletedPlaylist){
        throw new ApiError(400, "Something went wrong while deleting a playlist")
    }

    return res.status(200)
    .json(new ApiResponse(200, "Playlist deleted successfully", deletedPlaylist))
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body

    if(!isValidObjectId(playlistId)){
        throw new ApiError(400, "Invalid playlist Id")
    }

    if(!(name && description)){
        throw new ApiError(400, "Provide field to be updated")
    }
    
    const playlist = await Playlist.findById(playlistId)
    
    if(!playlist){
        throw new ApiError(400, "Playlist doesn't exist")
    }
    
    if(playlist?.owner.toString() != req.user?._id){
        throw new ApiError(400, "only owner can edit playlist")
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(playlistId,
        {
            $set: {
                name, 
                description
            }
        },
        {new: true}
    )

    if(!updatedPlaylist){
        throw new ApiError(400, "Something went wrong while updating a playlist")
    }

    return res.status(200)
    .json(new ApiResponse(200, "Playlist updated successfully", updatedPlaylist))
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}
